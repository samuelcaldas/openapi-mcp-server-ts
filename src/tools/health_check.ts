import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { metricsManager } from "../metrics/index.js";
import { logger } from "../utils/logger.js";

export interface HealthCheckOptions {
  apiName: string;
  version: string;
  apiBaseUrl?: string;
  client?: { request: (config: { method: string; url: string }) => Promise<{ status?: number; data?: unknown }> };
  startTime?: number;
}

export interface HealthCheckResult {
  server: {
    status: string;
    version: string;
    uptime: number | string;
  };
  api: {
    name: string;
    status: "healthy" | "unhealthy";
    message: string;
    base_url?: string;
  };
  metrics: ReturnType<typeof metricsManager.getSummary>;
}

export async function checkHealth(options: HealthCheckOptions): Promise<HealthCheckResult> {
  const startTime = options.startTime ?? Date.now();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  let apiHealth = true;
  let apiMessage = "API is reachable";

  if (options.client && options.apiBaseUrl) {
    try {
      const response = await options.client.request({ method: "GET", url: "/" });
      const statusCode = response.status ?? 200;
      if (statusCode >= 400) {
        apiHealth = false;
        apiMessage = `API returned status code ${statusCode}`;
      }
    } catch (error) {
      apiHealth = false;
      apiMessage = `Error connecting to API: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return {
    server: {
      status: "healthy",
      version: options.version,
      uptime,
    },
    api: {
      name: options.apiName,
      status: apiHealth ? "healthy" : "unhealthy",
      message: apiMessage,
      base_url: options.apiBaseUrl,
    },
    metrics: metricsManager.getSummary(),
  };
}

export function registerHealthCheckTool(server: McpServer, options: HealthCheckOptions): void {
  server.tool(
    "health_check",
    "Check the health of the MCP server, underlying API, and operational metrics.",
    {},
    async () => {
      logger.debug("Executing health_check tool");
      const result = await checkHealth(options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
