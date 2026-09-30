import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../utils/logger.js";

export interface WorkflowOperation {
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: Array<{ name: string; required?: boolean; description?: string }>;
}

export interface ResourceOperations {
  list?: WorkflowOperation;
  get?: WorkflowOperation;
  create?: WorkflowOperation;
  update?: WorkflowOperation;
  delete?: WorkflowOperation;
  search?: WorkflowOperation;
}

export interface WorkflowDefinition {
  name: string;
  type: "list_get_update" | "search_create";
  resourceType: string;
  operations: {
    list?: WorkflowOperation;
    get?: WorkflowOperation;
    update?: WorkflowOperation;
    search?: WorkflowOperation;
    create?: WorkflowOperation;
  };
}

/**
 * Identifies common workflows from API paths matching Python SOT heuristics.
 */
export function identifyWorkflows(paths: Record<string, Record<string, unknown>>): WorkflowDefinition[] {
  const workflows: WorkflowDefinition[] = [];
  const resourceOperations: Record<string, ResourceOperations> = {};

  for (const [path, pathItem] of Object.entries(paths || {})) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const pathParts = path.trim().replace(/^\/|\/$/g, "").split("/");
    let resourceType: string | undefined;

    for (const part of pathParts) {
      if (part && !part.startsWith("{")) {
        resourceType = part;
        break;
      }
    }

    if (!resourceType) continue;

    if (!resourceOperations[resourceType]) {
      resourceOperations[resourceType] = {};
    }

    const currentOps = resourceOperations[resourceType];

    for (const [method, operationRaw] of Object.entries(pathItem)) {
      if (!operationRaw || typeof operationRaw !== "object") continue;
      const operation = operationRaw as Record<string, unknown>;
      const opId = String(operation.operationId || "");
      const opIdLower = opId.toLowerCase();

      const opDef: WorkflowOperation = {
        operationId: opId || `${method.toLowerCase()}_${resourceType}`,
        summary: operation.summary as string | undefined,
        description: operation.description as string | undefined,
        parameters: operation.parameters as WorkflowOperation["parameters"],
      };

      const m = method.toLowerCase();
      if (m === "get") {
        if (opIdLower.includes("search") || opIdLower.includes("find") || path.toLowerCase().endsWith("/search") || path.toLowerCase().endsWith("/find")) {
          currentOps.search = opDef;
        } else if (opIdLower.includes("list") || opIdLower.includes("getall") || !path.includes("{")) {
          currentOps.list = opDef;
        } else {
          currentOps.get = opDef;
        }
      } else if (m === "post") {
        if (opIdLower.includes("create") || opIdLower.includes("add") || !currentOps.create) {
          currentOps.create = opDef;
        }
      } else if (m === "put" || m === "patch") {
        currentOps.update = opDef;
      } else if (m === "delete") {
        currentOps.delete = opDef;
      }
    }
  }

  for (const [resourceType, operations] of Object.entries(resourceOperations)) {
    if (operations.list && operations.get && operations.update) {
      workflows.push({
        name: `${resourceType}_list_get_update`,
        type: "list_get_update",
        resourceType,
        operations: {
          list: operations.list,
          get: operations.get,
          update: operations.update,
        },
      });
    }

    if (operations.search && operations.create) {
      workflows.push({
        name: `${resourceType}_search_create`,
        type: "search_create",
        resourceType,
        operations: {
          search: operations.search,
          create: operations.create,
        },
      });
    }
  }

  return workflows;
}

/**
 * Generates documentation and example code for a workflow.
 */
export function generateWorkflowDocumentation(workflow: WorkflowDefinition): string {
  const { resourceType, type, operations } = workflow;
  const title = `# ${capitalize(resourceType)} ${type === "list_get_update" ? "List Get Update" : "Search Create"} Workflow`;

  const lines: string[] = [title, "", "## Steps"];

  if (type === "list_get_update") {
    const listId = operations.list?.operationId || `list_${resourceType}`;
    const getId = operations.get?.operationId || `get_${resourceType}`;
    const updateId = operations.update?.operationId || `update_${resourceType}`;

    lines.push(`1. List ${resourceType}s using \`${listId}\``);
    lines.push(`2. Get a specific ${resourceType} using \`${getId}\``);
    lines.push(`3. Update the ${resourceType} using \`${updateId}\``);
    lines.push("");
    lines.push("## Example Code");
    lines.push("```typescript");
    lines.push(`// 1. List all ${resourceType}s`);
    lines.push(`const ${resourceType}List = await ${listId}();`);
    lines.push("");
    lines.push(`// 2. Get a specific ${resourceType}`);
    lines.push(`const ${resourceType}Id = ${resourceType}List[0]?.id;`);
    lines.push(`const ${resourceType}Details = await ${getId}({ id: ${resourceType}Id });`);
    lines.push("");
    lines.push(`// 3. Update the ${resourceType}`);
    lines.push(`const updateData = { /* Required fields */ };`);
    lines.push(`const updated = await ${updateId}({ id: ${resourceType}Id, ...updateData });`);
    lines.push("```");
  } else if (type === "search_create") {
    const searchId = operations.search?.operationId || `search_${resourceType}`;
    const createId = operations.create?.operationId || `create_${resourceType}`;

    lines.push(`1. Search for ${resourceType}s using \`${searchId}\``);
    lines.push(`2. If not found, create a new ${resourceType} using \`${createId}\``);
    lines.push("");
    lines.push("## Example Code");
    lines.push("```typescript");
    lines.push(`// 1. Search for ${resourceType}s`);
    lines.push(`const searchResults = await ${searchId}({ query: "target" });`);
    lines.push("");
    lines.push(`// 2. Create if not found`);
    lines.push(`if (!searchResults || searchResults.length === 0) {`);
    lines.push(`  const createData = { /* Required fields */ };`);
    lines.push(`  const new${capitalize(resourceType)} = await ${createId}(createData);`);
    lines.push(`}`);
    lines.push("```");
  }

  return lines.join("\n");
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/**
 * Registers heuristic workflow prompts with the MCP server.
 */
export function registerWorkflowPrompts(server: McpServer, paths?: Record<string, Record<string, unknown>>): number {
  const workflows = paths ? identifyWorkflows(paths) : [];
  let registeredCount = 0;

  for (const workflow of workflows) {
    const doc = generateWorkflowDocumentation(workflow);
    server.prompt(
      workflow.name,
      `Execute a ${workflow.type.replace(/_/g, " ")} workflow for ${workflow.resourceType}`,
      {
        resource_type: z.string().optional().describe(`The type of resource (${workflow.resourceType})`),
      },
      async () => ({
        messages: [{ role: "user", content: { type: "text", text: doc } }],
      }),
    );
    registeredCount++;
    logger.debug(`Registered workflow prompt: ${workflow.name}`);
  }

  // Register standard fallback workflow prompts if none were generated
  if (registeredCount === 0) {
    server.prompt("list_get_update", "Standard list -> get -> update workflow", async () => ({
      messages: [{ role: "user", content: { type: "text", text: "Here is a standard List -> Get -> Update workflow. Please follow these steps in order:\n1. List resources\n2. Get target resource by identifier\n3. Apply updates to the resource" } }],
    }));
    server.prompt("search_create", "Standard search -> create workflow", async () => ({
      messages: [{ role: "user", content: { type: "text", text: "Here is a standard Search -> Create workflow. Please follow these steps in order:\n1. Search for existing resources matching criteria\n2. If not found, create a new resource with the desired data" } }],
    }));
    registeredCount += 2;
  }

  return registeredCount;
}
