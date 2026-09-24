import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServerInstance, type PreparedServerEnvironment } from "../server.js";

export interface StdioServerHandle {
  server: McpServer;
  transport: StdioServerTransport;
  close: () => Promise<void>;
}

/**
 * Starts the MCP Server connected to stdio transport.
 * @param environment Prepared server environment with specs and credentials.
 * @returns Handle containing running server instance and transport.
 */
export async function startStdioServer(environment: PreparedServerEnvironment): Promise<StdioServerHandle> {
  const server = createServerInstance(environment);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logStdioStart(environment.configuration.api_name);
  return {
    server,
    transport,
    close: async () => {
      await server.close();
    },
  };
}

function logStdioStart(apiName: string): void {
  console.error(`MCP Server running (name: ${apiName}) via stdio`);
}
