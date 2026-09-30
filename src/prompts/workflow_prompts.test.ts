import { describe, it, expect } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  identifyWorkflows,
  generateWorkflowDocumentation,
  registerWorkflowPrompts,
} from "./workflow_prompts.js";

describe("Workflow Prompts", () => {
  it("identifies list_get_update workflow", () => {
    const paths = {
      "/users": {
        get: { operationId: "listUsers" },
      },
      "/users/{id}": {
        get: { operationId: "getUser" },
        put: { operationId: "updateUser" },
      },
    };

    const workflows = identifyWorkflows(paths);
    expect(workflows.length).toBe(1);
    expect(workflows[0].name).toBe("users_list_get_update");
    expect(workflows[0].type).toBe("list_get_update");

    const doc = generateWorkflowDocumentation(workflows[0]);
    expect(doc).toContain("# Users List Get Update Workflow");
    expect(doc).toContain("listUsers");
    expect(doc).toContain("getUser");
    expect(doc).toContain("updateUser");
  });

  it("identifies search_create workflow", () => {
    const paths = {
      "/items/search": {
        get: { operationId: "searchItems" },
      },
      "/items": {
        post: { operationId: "createItem" },
      },
    };

    const workflows = identifyWorkflows(paths);
    expect(workflows.length).toBe(1);
    expect(workflows[0].name).toBe("items_search_create");
    expect(workflows[0].type).toBe("search_create");

    const doc = generateWorkflowDocumentation(workflows[0]);
    expect(doc).toContain("# Items Search Create Workflow");
    expect(doc).toContain("searchItems");
    expect(doc).toContain("createItem");
  });

  it("registers fallback prompts when no workflows identified", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const count = registerWorkflowPrompts(server, {});
    expect(count).toBe(2);
    expect((server as any)._registeredPrompts?.["list_get_update"]).toBeDefined();
    expect((server as any)._registeredPrompts?.["search_create"]).toBeDefined();
  });
});
