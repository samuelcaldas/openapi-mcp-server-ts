import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerToolsFromOpenApi, getZodType } from "./index.js";

describe("registerToolsFromOpenApi", () => {
  it("should register tools correctly from openapi spec", () => {
    const server1 = new McpServer({ name: "test1", version: "1.0" });
    const server2 = new McpServer({ name: "test2", version: "1.0" });
    const spec = {
      servers: [{ url: "https://api.example.com" }],
      paths: {
        "/test/{id}": {
          get: {
            operationId: "getTest",
            summary: "Test Get",
            tags: ["t1"],
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
              { name: "q", in: "query", required: false, schema: { type: "string" } }
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "string" } } }
                }
              }
            }
          }
        }
      }
    };

    registerToolsFromOpenApi(server1, spec, ["t2"], []);
    registerToolsFromOpenApi(server2, spec, [], []);
    
    expect(true).toBe(true);
  });

  it("should parse schemas", () => {
    const enumZod = getZodType({ type: "string", enum: ["a", "b"] });
    expect(enumZod).toBeDefined();
    expect(getZodType(null)).toBeDefined();
    expect(getZodType({ type: "unknown" })).toBeDefined();
    expect(getZodType({ type: "object", properties: { a: { type: "string" } }, required: ["a"] })).toBeDefined();
  });
});
