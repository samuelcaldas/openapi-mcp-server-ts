import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../utils/logger.js";

export interface HttpClientLike {
  request: (config: { method: string; url: string }) => Promise<{ status?: number; data?: unknown; headers?: Record<string, unknown> }>;
}

/**
 * Registers GET endpoints from an OpenAPI specification as MCP Resources and Resource Templates.
 * Uses the URI scheme `api://{apiName}{path}`.
 *
 * @param server McpServer instance to register resources on.
 * @param apiName Logical name of the API.
 * @param spec Parsed OpenAPI specification.
 * @param client HTTP client for executing GET requests.
 * @returns Total count of registered resources and resource templates.
 */
export function registerApiResources(
  server: McpServer,
  apiName: string,
  spec: Record<string, unknown>,
  client: HttpClientLike,
): number {
  if (!spec || !spec.paths || typeof spec.paths !== "object") return 0;

  const normalizedApiName = apiName.replace(/[^a-zA-Z0-9_-]/g, "_") || "api";
  let count = 0;

  for (const [rawPath, pathItem] of Object.entries(spec.paths as Record<string, Record<string, unknown>>)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const getOperation = pathItem.get as Record<string, unknown> | undefined;
    if (!getOperation || typeof getOperation !== "object") continue;

    const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const uriPattern = `api://${normalizedApiName}${normalizedPath}`;
    const resourceName = (getOperation.operationId as string) || `get_${normalizedPath.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const description = (getOperation.summary as string) || (getOperation.description as string) || `GET ${normalizedPath}`;

    const hasTemplateVariables = /\{[^}]+\}/.test(normalizedPath);

    if (hasTemplateVariables) {
      const template = new ResourceTemplate(uriPattern, { list: undefined });
      server.resource(
        resourceName,
        template,
        { description, mimeType: "application/json" },
        async (uri, variables) => {
          let resolvedPath = normalizedPath;
          for (const [key, value] of Object.entries(variables)) {
            resolvedPath = resolvedPath.replace(new RegExp(`\\{${key}\\}`, "g"), encodeURIComponent(String(value)));
          }

          try {
            logger.debug(`Reading resource template: ${uri.href} -> ${resolvedPath}`);
            const response = await client.request({ method: "GET", url: resolvedPath });
            const mimeType = (response.headers?.["content-type"] as string) || "application/json";
            const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2);
            return {
              contents: [{ uri: uri.href, mimeType, text }],
            };
          } catch (error) {
            logger.error(`Error reading resource ${uri.href}: ${error}`);
            return {
              contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            };
          }
        },
      );
      count++;
    } else {
      server.resource(
        resourceName,
        uriPattern,
        { description, mimeType: "application/json" },
        async (uri) => {
          try {
            logger.debug(`Reading static resource: ${uri.href} -> ${normalizedPath}`);
            const response = await client.request({ method: "GET", url: normalizedPath });
            const mimeType = (response.headers?.["content-type"] as string) || "application/json";
            const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2);
            return {
              contents: [{ uri: uri.href, mimeType, text }],
            };
          } catch (error) {
            logger.error(`Error reading resource ${uri.href}: ${error}`);
            return {
              contents: [{ uri: uri.href, mimeType: "text/plain", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            };
          }
        },
      );
      count++;
    }
  }

  logger.info(`Registered ${count} MCP resources for API: ${apiName}`);
  return count;
}
