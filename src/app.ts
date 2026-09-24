import fs from "fs";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

/**
 * Registers the OpenAPI UI app as an MCP resource and launch tool.
 * Resolves the bundled inline HTML relative to the installed package.
 * @param server Target McpServer instance.
 */
export function registerUiApp(server: McpServer): void {
  const htmlContent = resolveUiHtml();
  if (!htmlContent) return;

  registerResource(server, htmlContent);
  registerTool(server);
}

function resolveUiHtml(): string | undefined {
  const candidatePaths = [
    fileURLToPath(new URL("../dist-app/index.html", import.meta.url)),
    fileURLToPath(new URL("./dist-app/index.html", import.meta.url)),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, "utf8");
    }
  }
  return undefined;
}

function registerResource(server: McpServer, htmlContent: string): void {
  registerAppResource(
    server,
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
                connectDomains: [],
                resourceDomains: [],
              },
            },
          },
        },
      ],
    })
  );
}

function registerTool(server: McpServer): void {
  registerAppTool(
    server,
    "openapi_ui",
    {
      description: "Launch OpenAPI UI App",
      inputSchema: z.object({}),
      _meta: {
        ui: {
          resourceUri: "api://openapi-app",
        },
      },
    },
    async () => ({
      content: [{ type: "text", text: "UI Launched successfully" }],
    })
  );
}
