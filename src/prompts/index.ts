import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Register operation prompts and optionally the shared workflow prompts. */
export function registerPromptsFromOpenApi(server: McpServer, apiSpec: any, includeWorkflow = true): void {
  if (process.env.ENABLE_OPERATION_PROMPTS === "false") return;
  if (includeWorkflow) registerWorkflowPrompts(server);
  for (const [path, pathItem] of Object.entries(apiSpec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem as Record<string, any>)) {
      if (!operation?.operationId) continue;
      registerOperationPrompt(server, path, method, operation);
    }
  }
}

function registerWorkflowPrompts(server: McpServer): void {
  server.prompt("list_get_update", "Standard list -> get -> update workflow", async () => ({
    messages: [{ role: "user", content: { type: "text", text: "Here is a standard List -> Get -> Update workflow. Please follow these steps in order." } }],
  }));
  server.prompt("search_create", "Standard search -> create workflow", async () => ({
    messages: [{ role: "user", content: { type: "text", text: "Here is a standard Search -> Create workflow. Please follow these steps in order." } }],
  }));
}

function registerOperationPrompt(server: McpServer, path: string, method: string, operation: any): void {
  const args: Record<string, any> = {};
  for (const parameter of operation.parameters || []) args[parameter.name] = { type: "string" };
  server.prompt(operation.operationId, operation.summary || operation.description || `Operation ${operation.operationId}`, args, async (provided) => ({
    messages: [{ role: "user", content: { type: "text", text: describeOperation(path, method, operation, provided) } }],
  }));
}

function describeOperation(path: string, method: string, operation: any, provided: Record<string, unknown>): string {
  const description = operation.summary || operation.description || `Operation ${method.toUpperCase()} ${path}`;
  let text = `# ${operation.operationId}\n\n**Method:** ${method.toUpperCase()}\n**Path:** ${path}\n\n${description}\n`;
  if (Object.keys(provided || {}).length) text += `\n**Args provided:**\n${JSON.stringify(provided, null, 2)}`;
  return text;
}
