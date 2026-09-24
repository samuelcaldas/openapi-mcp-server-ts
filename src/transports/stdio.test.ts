import { jest, describe, it, expect } from "@jest/globals";
import { Config } from "../utils/config.js";
import { prepareServerEnvironment } from "../server.js";
import { startStdioServer } from "./stdio.js";

describe("Stdio Transport", () => {
  it("connects McpServer to StdioServerTransport", async () => {
    const config = new Config({
      apiName: "test-stdio-api",
      transport: "stdio",
      allowPrivateNetworks: true,
    });

    const env = await prepareServerEnvironment(config);
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await startStdioServer(env);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("MCP Server running (name: test-stdio-api) via stdio")
    );

    consoleSpy.mockRestore();
  });
});
