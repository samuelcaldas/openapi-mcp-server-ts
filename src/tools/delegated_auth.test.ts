import { jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolsFromOpenApi } from "./index.js";
import type { CredentialProvider } from "../auth/token_exchange.js";

describe("Tool execution with CredentialProvider", () => {
  const dummySpec = {
    openapi: "3.0.0",
    info: { title: "Test API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/secure-data": {
        get: {
          operationId: "getSecureData",
          parameters: [
            {
              name: "Authorization",
              in: "header",
              schema: { type: "string" },
            },
            {
              name: "filter",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    },
  };

  it("injects delegated Authorization header from CredentialProvider and prevents operation override", async () => {
    const mockHttpClient = {
      request: jest.fn<any>().mockResolvedValue({ status: 200, data: { success: true } }),
    };

    const credentialProvider: CredentialProvider = {
      resolveAuthHeaders: jest.fn<any>().mockResolvedValue({ Authorization: "Bearer delegated-token-456" }),
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerToolsFromOpenApi(
      server,
      dummySpec,
      mockHttpClient,
      [],
      [],
      credentialProvider
    );

    // Get the registered tool callback from McpServer
    const registeredTool = (server as any)._registeredTools["getSecureData"];
    expect(registeredTool).toBeDefined();

    const extra = {
      authInfo: {
        token: "incoming-user-jwt",
        clientId: "user-123",
        scopes: [],
      },
    };

    // User attempts to override Authorization with their own parameter
    const result = await registeredTool.handler(
      { Authorization: "Bearer attacker-provided-header", filter: "active" },
      extra
    );

    expect(result.isError).toBeFalsy();
    expect(mockHttpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer delegated-token-456",
        }),
        params: { filter: "active" },
      })
    );
  });

  it("fails closed when CredentialProvider rejects", async () => {
    const mockHttpClient = {
      request: jest.fn<any>(),
    };

    const credentialProvider: CredentialProvider = {
      resolveAuthHeaders: jest.fn<any>().mockRejectedValue(new Error("Token exchange failed: invalid_grant")),
    };

    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerToolsFromOpenApi(
      server,
      dummySpec,
      mockHttpClient,
      [],
      [],
      credentialProvider
    );

    const registeredTool = (server as any)._registeredTools["getSecureData"];
    const result = await registeredTool.handler({ filter: "active" }, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Token exchange failed: invalid_grant");
    expect(mockHttpClient.request).not.toHaveBeenCalled();
  });
});
