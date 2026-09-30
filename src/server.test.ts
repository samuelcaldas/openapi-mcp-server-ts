import { describe, it, expect } from "@jest/globals";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createMcpServerAsync,
  prepareServerEnvironment,
  createServerInstance,
} from "./server.js";
import { Config, loadConfig } from "./utils/config.js";
import { ServiceCredentialProvider, UserDelegationCredentialProvider } from "./auth/token_exchange.js";

describe("Server Environment and Instance Lifecycle", () => {
  it("rejects malformed additional spec entries with their index", async () => {
    const configuration = new Config({
      apiBaseUrl: "http://127.0.0.1:8080", allowPrivateNetworks: true, allowInsecureHttp: true,
      additionalSpecs: JSON.stringify([{ spec_path: "/missing.json" }]),
    });
    await expect(prepareServerEnvironment(configuration)).rejects.toThrow("Additional spec entry 0");
  });
  it("uses standalone instance validation settings rather than global defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openapi-validation-"));
    const path = join(directory, "spec.json");
    const api = http.createServer((_request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ value: 42 }));
    });
    await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
    try {
      await writeFile(path, JSON.stringify({
        openapi: "3.0.0", info: { title: "Validation", version: "1" },
        paths: { "/value": { get: { operationId: "getValue", responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { value: { type: "string" } } } } } } } } } },
      }));
      const baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
      const configuration = new Config({ apiSpecPath: path, apiBaseUrl: baseUrl,
        allowPrivateNetworks: true, allowInsecureHttp: true, validateOutput: false });
      const environment = await prepareServerEnvironment(configuration);
      const server = createServerInstance(environment);
      const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "validation-consumer", version: "1.0.0" });
      try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const response = await client.callTool({ name: "getValue", arguments: {} });
        expect(response.isError).not.toBe(true);
        expect(response.content).toEqual([{ type: "text", text: JSON.stringify({ value: 42 }, null, 2) }]);
      } finally {
        await client.close();
        await server.close();
      }
    } finally {
      await new Promise<void>((resolve) => api.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("disables standalone operation prompts through its environment configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openapi-prompts-"));
    const path = join(directory, "spec.json");
    const previous = process.env.ENABLE_OPERATION_PROMPTS;
    try {
      process.env.ENABLE_OPERATION_PROMPTS = "false";
      await writeFile(path, JSON.stringify({ openapi: "3.0.0", info: { title: "Prompts", version: "1" },
        paths: { "/item": { get: { operationId: "readItem", responses: { "200": { description: "OK" } } } } } }));
      const configuration = loadConfig({ apiSpecPath: path, apiBaseUrl: "http://127.0.0.1:8080",
        allowPrivateNetworks: true, allowInsecureHttp: true });
      const server = createServerInstance(await prepareServerEnvironment(configuration));
      const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "prompts-consumer", version: "1.0.0" });
      try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        expect(client.getServerCapabilities()?.prompts).toBeUndefined();
        expect((await client.listTools()).tools.some((tool) => tool.name === "readItem")).toBe(true);
      } finally {
        await client.close();
        await server.close();
      }
    } finally {
      if (previous === undefined) delete process.env.ENABLE_OPERATION_PROMPTS;
      if (previous !== undefined) process.env.ENABLE_OPERATION_PROMPTS = previous;
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("registers shared workflow prompts only once for multiple specs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openapi-mcp-specs-"));
    const firstPath = join(directory, "first.json");
    const secondPath = join(directory, "second.json");
    const document = (id: string) => ({
      openapi: "3.0.0", info: { title: id, version: "1.0.0" },
      paths: { [`/${id}`]: { get: { operationId: id, responses: { "200": { description: "OK" } } } } },
    });
    try {
      await writeFile(firstPath, JSON.stringify(document("first")));
      await writeFile(secondPath, JSON.stringify(document("second")));
      const configuration = new Config({
        apiSpecPath: firstPath, apiBaseUrl: "http://127.0.0.1:8080",
        allowPrivateNetworks: true, allowInsecureHttp: true,
        additionalSpecs: JSON.stringify([{ spec_path: secondPath, base_url: "http://127.0.0.1:8080" }]),
      });
      const environment = await prepareServerEnvironment(configuration);
      const server = createServerInstance(environment);
      const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "spec-consumer", version: "1.0.0" });
      try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const prompts = await client.listPrompts();
        expect(prompts.prompts.map((entry) => entry.name).sort()).toEqual(["first", "list_get_update", "search_create", "second"]);
      } finally {
        await client.close();
        await server.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("should create server with tools and prompts when spec is provided", async () => {
    const config = new Config({ apiName: "test-api", allowPrivateNetworks: true });
    const server = await createMcpServerAsync(config);
    expect(server).toBeDefined();
  });

  it("prepares environment once and creates independent McpServer instances", async () => {
    const config = new Config({ apiName: "test-api", allowPrivateNetworks: true });
    const environment = await prepareServerEnvironment(config);

    expect(environment).toBeDefined();
    expect(environment.specs).toBeDefined();
    expect(environment.credentialProvider).toBeInstanceOf(ServiceCredentialProvider);

    const instance1 = createServerInstance(environment);
    const instance2 = createServerInstance(environment);

    expect(instance1).not.toBe(instance2);
    expect((instance1 as any).server).toBeDefined();
    expect((instance2 as any).server).toBeDefined();
  });

  it("creates UserDelegationCredentialProvider when delegation mode is user", async () => {
    const config = new Config({
      apiName: "test-api",
      allowPrivateNetworks: true,
      delegationMode: "user",
      inboundAuthType: "oauth",
      tokenExchangeUrl: "http://127.0.0.1:8080/oauth/token",
      tokenExchangeAudience: "https://api.example.com",
    });

    const environment = await prepareServerEnvironment(config);
    expect(environment.credentialProvider).toBeInstanceOf(UserDelegationCredentialProvider);
  });
});
