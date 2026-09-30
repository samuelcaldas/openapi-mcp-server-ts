import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import type { AddressInfo } from "net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Config } from "../utils/config.js";
import { prepareServerEnvironment } from "../server.js";
import { startHttpServer } from "./http.js";

describe("Streamable HTTP Transport", () => {
  it("rejects unauthenticated programmatic non-loopback listeners before binding", async () => {
    const configuration = new Config({
      transport: "http", host: "0.0.0.0", port: 0,
      inboundAuthType: "none", allowPrivateNetworks: true,
    });
    const environment = await prepareServerEnvironment(configuration);
    const outcome = await startHttpServer(environment).then(async (handle) => {
      await handle.close();
      return "listener started";
    }, (error: Error) => error.message);
    expect(outcome).toContain("Inbound authentication 'none' is forbidden on non-loopback");
  });
  let serverHandle: Awaited<ReturnType<typeof startHttpServer>>;
  let serverUrl: string;
  const bearerSecret = "test-bearer-secret-777";

  beforeAll(async () => {
    const config = new Config({
      apiName: "test-http-api",
      transport: "http",
      host: "127.0.0.1",
      port: 0, // dynamic port
      allowPrivateNetworks: true,
      inboundAuthType: "bearer",
      inboundBearerToken: bearerSecret,
      inboundOauthIssuerUrl: "https://auth.example.com",
      inboundOauthAudience: "https://mcp.example.com/mcp",
    });

    const env = await prepareServerEnvironment(config);
    serverHandle = await startHttpServer(env);
    serverUrl = serverHandle.url;
  });

  afterAll(async () => {
    if (serverHandle) {
      await serverHandle.close();
    }
  });

  it("returns 405 Method Not Allowed with Allow: POST for GET /mcp", async () => {
    const response = await fetch(`${serverUrl}/mcp`, { method: "GET" });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("returns 405 Method Not Allowed for DELETE /mcp", async () => {
    const response = await fetch(`${serverUrl}/mcp`, { method: "DELETE" });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("serves OAuth protected resource metadata at /.well-known/oauth-protected-resource/mcp", async () => {
    const response = await fetch(`${serverUrl}/.well-known/oauth-protected-resource/mcp`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.authorization_servers).toContain("https://auth.example.com");
  });

  it("returns 401 Unauthorized for unauthenticated POST /mcp", async () => {
    const response = await fetch(`${serverUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  it("allows MCP Client to connect, initialize, and list tools via Streamable HTTP", async () => {
    const client = new Client({ name: "streamable-test-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${serverUrl}/mcp`), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${bearerSecret}`,
        },
      },
    });

    await client.connect(transport);
    const toolsResult = await client.listTools();
    expect(toolsResult).toBeDefined();
    expect(Array.isArray(toolsResult.tools)).toBe(true);

    await client.close();
  });

  it("handles two concurrent clients simultaneously without interference", async () => {
    const createTestClient = async (name: string) => {
      const client = new Client({ name, version: "1.0.0" });
      const transport = new StreamableHTTPClientTransport(new URL(`${serverUrl}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${bearerSecret}` } },
      });
      await client.connect(transport);
      return client;
    };

    const [client1, client2] = await Promise.all([
      createTestClient("client-1"),
      createTestClient("client-2"),
    ]);

    const [tools1, tools2] = await Promise.all([
      client1.listTools(),
      client2.listTools(),
    ]);

    expect(tools1.tools).toBeDefined();
    expect(tools2.tools).toBeDefined();

    await Promise.all([client1.close(), client2.close()]);
  });
});
