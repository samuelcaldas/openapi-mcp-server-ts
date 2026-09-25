import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prepare_openapi_integration } from "../public.js";

const spec = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/items/{id}": {
      get: {
        operationId: "readItem",
        tags: ["items"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "filter", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Item", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } } } },
      },
    },
  },
};

describe("OpenAPI integration", () => {
  const observedHeaders = new Map<string, string | undefined>();
  let api: http.Server;
  let base_url: string;
  beforeAll(async () => {
    api = http.createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      observedHeaders.set(request.url ?? "", request.headers.authorization);
      if (request.url === "/items/bad") {
        response.end(JSON.stringify({ id: 123 }));
        return;
      }
      response.end(JSON.stringify({ id: request.url, authorization: request.headers.authorization }));
    });
    await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
    base_url = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => api.close(() => resolve()));
  });

  it("registers prefixed tools on an existing MCP server without prompts", async () => {
    const integration = await prepare_openapi_integration({
      source: spec, base_url,
      network_policy: { allow_private_networks: true, allow_insecure_http: true },
    });
    const server = new McpServer({ name: "host", version: "1.0.0" });
    integration.register_tools(server, { prefix: "catalog" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "consumer", version: "1.0.0" });
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name)).toEqual(["catalog_readItem"]);
      expect(client.getServerCapabilities()?.prompts).toBeUndefined();
      const response = await client.callTool({ name: "catalog_readItem", arguments: { id: "x", filter: "now" } });
      expect(response.isError).not.toBe(true);
      expect(response.content).toEqual([{ type: "text", text: JSON.stringify({ id: "/items/x?filter=now" }, null, 2) }]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("does not expose sensitive destination errors through the public error cause", async () => {
    const integration = await prepare_openapi_integration({ source: spec, base_url,
      network_policy: { allow_private_networks: true, allow_insecure_http: true },
      http_client: { request: async () => { throw new Error("Bearer sensitive-destination-token"); } },
    });
    try {
      await integration.execute_operation("readItem", { id: "x" });
      throw new Error("Expected a destination failure");
    } catch (error) {
      const failure = error as Error & { cause?: Error };
      expect(failure.message).toContain("Operation readItem failed");
      expect(failure.cause?.message ?? "").not.toContain("sensitive-destination-token");
    }
  });

  it("rejects Swagger 2 documents instead of publishing them as OpenAPI 3 tools", async () => {
    await expect(prepare_openapi_integration({
      source: { swagger: "2.0", info: { title: "Legacy", version: "1" }, paths: {} }, base_url,
      network_policy: { allow_private_networks: true, allow_insecure_http: true },
    })).rejects.toThrow("Invalid OpenAPI specification");
  });

  it("keeps prepared operations independent from later source mutation", async () => {
    const mutable = structuredClone(spec);
    const integration = await prepare_openapi_integration({ source: mutable, base_url,
      network_policy: { allow_private_networks: true, allow_insecure_http: true } });
    mutable.paths["/items/{id}"].get.parameters[0].name = "changed";
    const result = await integration.execute_operation("readItem", { id: "stable" });
    expect(result).toEqual({ status: 200, data: { id: "/items/stable" } });
  });

  it("executes an operation with encoded path and query parameters", async () => {
    const integration = await prepare_openapi_integration({
      source: spec, base_url,
      network_policy: { allow_private_networks: true, allow_insecure_http: true },
    });
    const result = await integration.execute_operation("readItem", { id: "a b", filter: "recent" });
    expect(result).toEqual({ status: 200, data: { id: "/items/a%20b?filter=recent" } });
  });

  it("isolates concurrent integrations with different credentials and validation choices", async () => {
    const network_policy = { allow_private_networks: true, allow_insecure_http: true };
    const first = await prepare_openapi_integration({ source: spec, base_url, network_policy,
      credential_provider: { resolveAuthHeaders: async () => ({ Authorization: "Bearer first" }) },
    });
    const second = await prepare_openapi_integration({ source: spec, base_url, network_policy,
      validate_output: false,
      credential_provider: { resolveAuthHeaders: async () => ({ Authorization: "Bearer second" }) },
    });
    const [firstResult, secondResult] = await Promise.all([
      first.execute_operation("readItem", { id: "first" }),
      second.execute_operation("readItem", { id: "second" }),
    ]);
    expect(firstResult.data).toEqual({ id: "/items/first" });
    expect(secondResult.data).toEqual({ id: "/items/second", authorization: "Bearer second" });
    expect(observedHeaders.get("/items/first")).toBe("Bearer first");
    expect(observedHeaders.get("/items/second")).toBe("Bearer second");
  });

  it("honors response-validation and tag-filter choices independently", async () => {
    const network_policy = { allow_private_networks: true, allow_insecure_http: true };
    const filtered = await prepare_openapi_integration({ source: spec, base_url, network_policy, exclude_tags: ["items"] });
    expect(filtered.list_operations()).toEqual([]);
    const validated = await prepare_openapi_integration({ source: spec, base_url, network_policy, include_tags: ["items"] });
    await expect(validated.execute_operation("readItem", { id: "bad" })).rejects.toThrow("Response validation failed");
    const unchecked = await prepare_openapi_integration({ source: spec, base_url, network_policy, validate_output: false });
    expect((await unchecked.execute_operation("readItem", { id: "bad" })).data).toEqual({ id: 123 });
  });
});
