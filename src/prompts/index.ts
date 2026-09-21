import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "../utils/config.js";

export function registerPromptsFromOpenApi(server: McpServer, apiSpec: any) {
  if (!config.ENABLE_OPERATION_PROMPTS) return;

  const paths = apiSpec.paths || {};
  
  // Workflow prompts
  server.prompt(
    "list_get_update",
    "Standard list -> get -> update workflow",
    async () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Here is a standard List -> Get -> Update workflow. Please follow these steps in order."
            }
          }
        ]
      };
    }
  );
  
  server.prompt(
    "search_create",
    "Standard search -> create workflow",
    async () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Here is a standard Search -> Create workflow. Please follow these steps in order."
            }
          }
        ]
      };
    }
  );

  for (const path in paths) {
    for (const method in paths[path]) {
      const operation = paths[path][method];
      if (!operation.operationId) continue;
      
      const args: Record<string, any> = {};
      const params = operation.parameters || [];
      for (const p of params) {
        args[p.name] = { type: "string" };
      }
      
      server.prompt(
        operation.operationId,
        operation.summary || operation.description || `Operation ${operation.operationId}`,
        args,
        async (reqArgs) => {
          const desc = operation.summary || operation.description || `Operation ${method.toUpperCase()} ${path}`;
          let text = `# ${operation.operationId}\n\n**Method:** ${method.toUpperCase()}\n**Path:** ${path}\n\n${desc}\n`;
          if (Object.keys(reqArgs || {}).length > 0) {
             text += `\n**Args provided:**\n${JSON.stringify(reqArgs, null, 2)}`;
          }
          
          return {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text
                }
              }
            ]
          };
        }
      );
    }
  }
}
