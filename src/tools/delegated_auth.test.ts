import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHttpClient } from "../utils/httpClient.js";
import type { CredentialProvider } from "../auth/token_exchange.js";
import { registerToolsFromOpenApi } from "./index.js";

const spec = {
  openapi: "3.0.0", info: { title: "Delegated", version: "1.0.0" },
  servers: [{ url: "" }],
  paths: { "/secure": { get: {
    operationId: "secure", parameters: [{ name: "filter", in: "query", schema: { type: "string" } }],
    responses: { "200": { description: "OK" } },
  } } },
};

describe("Legacy tool registration with delegated credentials", () => {
  let api: http.Server;
  let requests = 0;
  beforeAll(async () => {
    api = http.createServer((request, response) => {
      requests += 1;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ authorization: request.headers.authorization, path: request.url }));
    });
    await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
    spec.servers[0].url = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => api.close(() => resolve()));
  });

  it("rejects case-insensitive Authorization parameters before registering tools", () => {
    const server = new McpServer({ name: "headers", version: "1.0.0" });
    const unsafe = { ...spec, paths: { "/secure": { get: {
      ...spec.paths["/secure"].get,
      parameters: [{ name: "authorization", in: "header", schema: { type: "string" } }],
    } } } };
    expect(() => registerToolsFromOpenApi(server, unsafe, createHttpClient(true, true)))
      .toThrow("Authorization parameter is forbidden");
  });

  it("sends the resolved destination token through a real MCP tool call", async () => {
    const provider: CredentialProvider = {
      async resolveAuthHeaders() { return { Authorization: "Bearer destination-token" }; },
    };
    const response = await callRegisteredTool(provider, { filter: "active" });
    expect(response.isError).not.toBe(true);
    expect(response.content).toEqual([{ type: "text", text: JSON.stringify({ authorization: "Bearer destination-token", path: "/secure?filter=active" }, null, 2) }]);
  });

  it("fails closed without contacting the destination on credential failure", async () => {
    const before = requests;
    const provider: CredentialProvider = {
      async resolveAuthHeaders() { throw new Error("Token exchange failed"); },
    };
    const response = await callRegisteredTool(provider, { filter: "active" });
    expect(response.isError).toBe(true);
    expect(requests).toBe(before);
    expect(JSON.stringify(response.content)).not.toContain("destination-token");
  });
});

async function callRegisteredTool(provider: CredentialProvider, args: Record<string, unknown>) {
  const server = new McpServer({ name: "delegation", version: "1.0.0" });
  registerToolsFromOpenApi(server, spec, createHttpClient(true, true), [], [], provider);
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "caller", version: "1.0.0" });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return await client.callTool({ name: "secure", arguments: args });
  } finally {
    await client.close();
    await server.close();
  }
}
