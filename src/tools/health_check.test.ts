import { describe, it, expect, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkHealth, registerHealthCheckTool } from "./health_check.js";

describe("Health Check Tool", () => {
  it("returns healthy server and api status on success", async () => {
    const mockClient = {
      request: jest.fn<any>().mockResolvedValue({ status: 200, data: { status: "ok" } }),
    };

    const result = await checkHealth({
      apiName: "test-api",
      version: "1.2.3",
      apiBaseUrl: "https://api.example.com",
      client: mockClient,
      startTime: Date.now() - 5000,
    });

    expect(result.server.status).toBe("healthy");
    expect(result.server.version).toBe("1.2.3");
    expect(result.server.uptime).toBeGreaterThanOrEqual(4);
    expect(result.api.status).toBe("healthy");
    expect(result.api.message).toBe("API is reachable");
    expect(result.metrics).toBeDefined();
  });

  it("handles api failure gracefully", async () => {
    const mockClient = {
      request: jest.fn<any>().mockRejectedValue(new Error("Connection refused")),
    };

    const result = await checkHealth({
      apiName: "test-api",
      version: "1.0.0",
      apiBaseUrl: "https://api.example.com",
      client: mockClient,
    });

    expect(result.server.status).toBe("healthy");
    expect(result.api.status).toBe("unhealthy");
    expect(result.api.message).toContain("Connection refused");
  });

  it("registers tool on McpServer", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerHealthCheckTool(server, {
      apiName: "test",
      version: "1.0.0",
    });

    // Check internal registered tool map or existence
    expect((server as any)._registeredTools?.["health_check"]).toBeDefined();
  });
});
