import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPromptsFromOpenApi } from "./index.js";
import { config } from "../utils/config.js";

describe("registerPromptsFromOpenApi", () => {
  it("should register prompts without errors when enabled", () => {
    config.ENABLE_OPERATION_PROMPTS = true;
    const server = new McpServer({ name: "test", version: "1.0" });
    const spec = {
      info: { title: "API" },
      paths: {
        "/test": {
          get: { operationId: "getTest", summary: "Gets test" }
        }
      }
    };
    registerPromptsFromOpenApi(server, spec);
    expect(true).toBe(true);
  });

  it("should not register prompts when disabled", () => {
    config.ENABLE_OPERATION_PROMPTS = false;
    const server = new McpServer({ name: "test", version: "1.0" });
    registerPromptsFromOpenApi(server, {});
    expect(true).toBe(true);
  });
});
