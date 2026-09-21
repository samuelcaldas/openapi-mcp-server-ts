import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Config } from "./utils/config.js";
import { createHttpClient, validateUrlForSpec } from "./utils/httpClient.js";
import { loadOpenApiSpec, parseOpenApiSpec } from "./utils/openapi.js";
import { registerToolsFromOpenApi } from "./tools/index.js";
import { registerPromptsFromOpenApi } from "./prompts/index.js";
import { configureAuth, type AuthType } from "./auth/index.js";

export async function createMcpServerAsync(configuration: Config): Promise<McpServer> {
  const server = new McpServer({ name: configuration.api_name, version: configuration.version });
  const allowedDirs = splitValues(configuration.allowed_spec_dirs);
  if (configuration.api_base_url) {
    await validateUrlForSpec(configuration.api_base_url, {
      allowHttp: configuration.allow_insecure_http,
      allowPrivateNetworks: configuration.allow_private_networks,
    });
  }
  const primarySpec = await loadPrimarySpec(configuration, allowedDirs);
  const primaryClient = createConfiguredClient(configuration);
  if (primarySpec) {
    const configuredSpec = { ...primarySpec, servers: [{ url: configuration.api_base_url }] };
    registerToolsFromOpenApi(server, configuredSpec, primaryClient, splitValues(configuration.include_tags), splitValues(configuration.exclude_tags));
    registerPromptsFromOpenApi(server, configuredSpec);
  }
  await registerAdditionalSpecs(server, configuration, allowedDirs);
  return server;
}

async function loadPrimarySpec(configuration: Config, allowedDirs: string[]): Promise<any | undefined> {
  const source = configuration.api_spec_url || configuration.api_spec_path;
  if (!source) return undefined;
  return parseOpenApiSpec(source, configuration.allow_private_networks, configuration.allow_insecure_http, allowedDirs);
}

function createConfiguredClient(configuration: Config): ReturnType<typeof createHttpClient> {
  const client = createHttpClient(configuration.allow_private_networks, configuration.allow_insecure_http);
  configureAuth(client, configuration.auth_type as AuthType, {
    token: configuration.auth_token,
    username: configuration.auth_username,
    password: configuration.auth_password,
    apiKey: configuration.auth_api_key,
    apiKeyName: configuration.auth_api_key_name,
    apiKeyIn: configuration.auth_api_key_in as "header" | "query" | "cookie",
    cognitoClientId: configuration.auth_cognito_client_id,
    cognitoDomain: configuration.auth_cognito_domain,
    cognitoRegion: configuration.auth_cognito_region,
    cognitoScopes: configuration.auth_cognito_scopes,
    cognitoPoolId: configuration.auth_cognito_user_pool_id,
  });
  return client;
}

async function registerAdditionalSpecs(server: McpServer, configuration: Config, allowedDirs: string[]): Promise<void> {
  if (!configuration.additional_specs) return;
  let entries: unknown;
  try {
    entries = JSON.parse(configuration.additional_specs);
  } catch {
    return;
  }
  if (!Array.isArray(entries)) return;
  for (const rawEntry of entries) {
    if (!isRecord(rawEntry)) continue;
    await registerAdditionalSpec(server, configuration, rawEntry, allowedDirs);
  }
}

async function registerAdditionalSpec(server: McpServer, configuration: Config, entry: Record<string, unknown>, allowedDirs: string[]): Promise<void> {
  const source = stringValue(entry.spec_url) || stringValue(entry.spec_path);
  const baseUrl = stringValue(entry.base_url);
  if (!source || !baseUrl) return;
  try {
    await validateUrlForSpec(baseUrl, { allowHttp: configuration.allow_insecure_http, allowPrivateNetworks: configuration.allow_private_networks });
    const specUrl = stringValue(entry.spec_url);
    const validatedSpecUrl = specUrl
      ? await validateUrlForSpec(specUrl, { allowHttp: configuration.allow_insecure_http, allowPrivateNetworks: configuration.allow_private_networks })
      : undefined;
    const spec = validatedSpecUrl
      ? await loadOpenApiSpec({ validatedUrl: validatedSpecUrl, allowHttp: configuration.allow_insecure_http })
      : await parseOpenApiSpec(source, configuration.allow_private_networks, configuration.allow_insecure_http, allowedDirs);
    const client = createHttpClient(configuration.allow_private_networks, configuration.allow_insecure_http);
    const entryAuthType = stringValue(entry.auth_type) || "none";
    const entryApiKeyIn = stringValue(entry.auth_api_key_in) || "header";
    const effectiveAuthType = entryAuthType === "api_key" && entryApiKeyIn === "query" ? "none" : entryAuthType;
    configureAuth(client, effectiveAuthType as AuthType, {
      token: stringValue(entry.auth_token),
      username: stringValue(entry.auth_username),
      password: stringValue(entry.auth_password),
      apiKey: entryAuthType === "api_key" && entryApiKeyIn === "query" ? undefined : stringValue(entry.auth_api_key),
      apiKeyName: stringValue(entry.auth_api_key_name) || "X-API-Key",
      apiKeyIn: entryApiKeyIn as "header" | "query" | "cookie",
    });
    const includeTags = splitValues(stringValue(entry.include_tags));
    const excludeTags = splitValues(stringValue(entry.exclude_tags));
    const renamedSpec = { ...spec, servers: [{ url: baseUrl }] };
    registerToolsFromOpenApi(server, renamedSpec, client, includeTags, excludeTags);
    registerPromptsFromOpenApi(server, renamedSpec);
  } catch {
    // Optional additional specifications must not prevent the primary server from starting.
  }
}

function splitValues(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
