import { jest, describe, it, expect } from "@jest/globals";
import { buildCliProgram, parseCliArgs, runCli, setupCliSignalHandlers } from "./cli.js";

describe("CLI Program and Argument Parsing", () => {
  it("builds CLI program with expected name and description", () => {
    const program = buildCliProgram();
    expect(program.name()).toBe("openapi-mcp-server");
  });

  it("parses CLI flags correctly into options object", () => {
    const program = buildCliProgram();
    const args = [
      "node",
      "openapi-mcp-server",
      "--spec-path",
      "/tmp/spec.json",
      "--api-name",
      "my-test-api",
      "--transport",
      "http",
      "--port",
      "9000",
      "--host",
      "127.0.0.1",
      "--allow-private-networks",
    ];

    const options = parseCliArgs(program, args);
    expect(options.specPath).toBe("/tmp/spec.json");
    expect(options.apiName).toBe("my-test-api");
    expect(options.transport).toBe("http");
    expect(options.port).toBe("9000");
    expect(options.host).toBe("127.0.0.1");
    expect(options.allowPrivateNetworks).toBe(true);
  });

  it("handles --no-validate-output flag", () => {
    const program = buildCliProgram();
    const args = ["node", "openapi-mcp-server", "--no-validate-output"];
    const options = parseCliArgs(program, args);
    expect(options.validateOutput).toBe(false);
  });

  it("fails fast when discontinued transport sse is provided", async () => {
    const args = ["node", "openapi-mcp-server", "--transport", "sse"];
    await expect(runCli(args)).rejects.toThrow("Transport 'sse' has been discontinued");
  });

  it("fails fast when none auth is used on non-loopback host", async () => {
    const args = [
      "node",
      "openapi-mcp-server",
      "--transport",
      "http",
      "--host",
      "10.250.50.165",
      "--inbound-auth-type",
      "none",
    ];
    await expect(runCli(args)).rejects.toThrow("Inbound authentication 'none' is forbidden on non-loopback");
  });

  it("registers signal handlers via setupCliSignalHandlers", () => {
    const sigintBefore = process.listenerCount("SIGINT");
    const sigtermBefore = process.listenerCount("SIGTERM");

    setupCliSignalHandlers(false);

    expect(process.listenerCount("SIGINT")).toBe(sigintBefore + 1);
    expect(process.listenerCount("SIGTERM")).toBe(sigtermBefore + 1);

    // Clean up
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });
});
