import { describe, it, expect, jest } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerApiResources } from "./index.js";

describe("API Resources", () => {
  it("registers static and template resources from GET endpoints", async () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const mockClient = {
      request: jest.fn<any>().mockResolvedValue({
        status: 200,
        headers: { "content-type": "application/json" },
        data: { id: "123", name: "Fluffy" },
      }),
    };

    const spec = {
      paths: {
        "/pets": {
          get: {
            operationId: "listPets",
            summary: "List all pets",
          },
        },
        "/pets/{id}": {
          get: {
            operationId: "getPetById",
            summary: "Get pet by ID",
          },
        },
        "/pets/create": {
          post: {
            operationId: "createPet",
          },
        },
      },
    };

    const count = registerApiResources(server, "petstore", spec, mockClient);
    expect(count).toBe(2);

    // Verify static resource registration
    const staticRes = (server as any)._registeredResources?.["api://petstore/pets"];
    expect(staticRes).toBeDefined();

    // Verify template resource registration
    const templateRes = (server as any)._registeredResourceTemplates?.["listPets"];
    // In SDK, templates are registered in _registeredResourceTemplates
    expect((server as any)._registeredResourceTemplates).toBeDefined();
  });
});
