import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "fs";
import path from "path";

export function registerUiApp(server: McpServer) {
  const htmlContent = fs.readFileSync(path.join(process.cwd(), "dist-app", "index.html"), "utf8");
  const rawServer = (server as any).server;

  registerAppResource(
    rawServer,
    "OpenAPI UI",
    "api://openapi-app",
    {},
    async () => ({
      contents: [
        {
          uri: "api://openapi-app",
          mimeType: "text/html;profile=mcp-app",
          text: htmlContent,
          _meta: {
            ui: {
              csp: {
                // From CSP Investigation: No external domains needed as the bundle is fully inline
                connectDomains: [],
                resourceDomains: []
              }
            }
          }
        }
      ]
    })
  );

  registerAppTool(
    rawServer,
    "openapi_ui",
    {
      description: "Launch OpenAPI UI App",
      inputSchema: z.object({}),
      _meta: {
        ui: {
          resourceUri: "api://openapi-app"
        }
      }
    },
    async (args: any) => {
      return {
        content: [
          { type: "text", text: "UI Launched successfully" }
        ]
      };
    }
  );
}
