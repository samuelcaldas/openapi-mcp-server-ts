import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CredentialProvider } from "../auth/token_exchange.js";
import { createHttpClient } from "../utils/httpClient.js";
import { createPreparedIntegration } from "../integration/index.js";

export { getZodType } from "../integration/schema.js";
export { buildRouteMaps, type RouteMap } from "./route_map.js";

type HttpClientLike = { request: (configuration: Record<string, unknown>) => Promise<{ data: unknown; status?: number }> };

/** Register tools from an already loaded spec using the legacy positional API. */
export function registerToolsFromOpenApi(
  server: McpServer,
  apiSpec: any,
  httpClientOrIncludeTags: HttpClientLike | string[] = createHttpClient(),
  includeTagsOrExcludeTags: string[] = [],
  excludeTags: string[] = [],
  credentialProvider?: CredentialProvider,
): void {
  const legacyTags = Array.isArray(httpClientOrIncludeTags);
  const client = legacyTags ? createHttpClient() : httpClientOrIncludeTags;
  const includeTags = legacyTags ? httpClientOrIncludeTags : includeTagsOrExcludeTags;
  const excluded = legacyTags ? includeTagsOrExcludeTags : excludeTags;
  const integration = createPreparedIntegration(apiSpec, {
    client: client as ReturnType<typeof createHttpClient>,
    base_url: apiSpec.servers?.[0]?.url || "http://localhost",
    credential_provider: credentialProvider,
    validate_output: true,
  }, includeTags, excluded);
  integration.register_tools(server);
}
