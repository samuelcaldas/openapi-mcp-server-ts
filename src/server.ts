import fs from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Config } from "./utils/config.js";
import { createHttpClient, validateUrlForSpec } from "./utils/httpClient.js";
import { parseOpenApiSpec } from "./utils/openapi.js";
import { registerToolsFromOpenApi } from "./tools/index.js";
import { registerPromptsFromOpenApi } from "./prompts/index.js";
import { configureAuth, type AuthType } from "./auth/index.js";
import {
  type CredentialProvider,
  ServiceCredentialProvider,
  UserDelegationCredentialProvider,
} from "./auth/token_exchange.js";
import {
  type PreparedSpecEntry,
  loadAdditionalEntries,
} from "./utils/additional_specs.js";
import { registerUiApp } from "./app.js";

export type { PreparedSpecEntry };

export interface PreparedServerEnvironment {
  configuration: Config;
  specs: PreparedSpecEntry[];
  credentialProvider: CredentialProvider;
}

/**
 * Prepares the server environment by loading OpenAPI specifications and configuring credentials once.
 * @param configuration Validated runtime configuration.
 * @returns Prepared server environment ready for creating McpServer instances.
 */
export async function prepareServerEnvironment(configuration: Config): Promise<PreparedServerEnvironment> {
  const allowedDirs = splitValues(configuration.allowed_spec_dirs);
  await validateBaseUrl(configuration);

  const specs: PreparedSpecEntry[] = [];
  const primaryEntry = await loadPrimaryEntry(configuration, allowedDirs);
  if (primaryEntry) specs.push(primaryEntry);

  const additionalEntries = await loadAdditionalEntries(configuration, allowedDirs);
  specs.push(...additionalEntries);

  const credentialProvider = createCredentialProvider(configuration);
  return { configuration, specs, credentialProvider };
}

/**
 * Creates a fresh McpServer instance registered with tools, prompts, and UI app from the prepared environment.
 * @param environment Prepared environment containing specs and credentials.
 * @returns Configured McpServer instance.
 */
export function createServerInstance(environment: PreparedServerEnvironment): McpServer {
  const server = new McpServer({
    name: environment.configuration.api_name,
    version: environment.configuration.version,
  });

  for (const entry of environment.specs) {
    registerToolsFromOpenApi(
      server,
      entry.spec,
      entry.client,
      entry.includeTags,
      entry.excludeTags,
      environment.credentialProvider
    );
    registerPromptsFromOpenApi(server, entry.spec);
  }

  registerUiApp(server);
  return server;
}

/**
 * Legacy helper creating a single McpServer instance.
 * @param configuration Runtime configuration.
 * @returns Connected or ready McpServer instance.
 */
export async function createMcpServerAsync(configuration: Config): Promise<McpServer> {
  const environment = await prepareServerEnvironment(configuration);
  return createServerInstance(environment);
}

async function validateBaseUrl(configuration: Config): Promise<void> {
  if (!configuration.api_base_url) return;
  await validateUrlForSpec(configuration.api_base_url, {
    allowHttp: configuration.allow_insecure_http,
    allowPrivateNetworks: configuration.allow_private_networks,
  });
}

async function loadPrimaryEntry(configuration: Config, allowedDirs: string[]): Promise<PreparedSpecEntry | undefined> {
  const source = configuration.api_spec_url || configuration.api_spec_path;
  if (!source) return undefined;
  const spec = await parseOpenApiSpec(source, configuration.allow_private_networks, configuration.allow_insecure_http, allowedDirs);
  const client = createConfiguredClient(configuration);
  const configuredSpec = { ...spec, servers: [{ url: configuration.api_base_url }] };
  return {
    spec: configuredSpec,
    client,
    includeTags: splitValues(configuration.include_tags),
    excludeTags: splitValues(configuration.exclude_tags),
  };
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

function createCredentialProvider(configuration: Config): CredentialProvider {
  if (configuration.delegation_mode !== "user") {
    return new ServiceCredentialProvider();
  }
  const clientSecret = resolveTokenExchangeSecret(configuration);
  return new UserDelegationCredentialProvider({
    tokenExchangeUrl: configuration.token_exchange_url,
    targetAudience: configuration.token_exchange_audience,
    targetResource: configuration.inbound_oauth_resource_server_url || undefined,
    targetScopes: configuration.token_exchange_scopes || undefined,
    clientId: configuration.token_exchange_client_id || undefined,
    clientSecret,
    allowInsecureHttp: configuration.allow_insecure_http,
    allowPrivateNetworks: configuration.allow_private_networks,
  });
}

function resolveTokenExchangeSecret(configuration: Config): string | undefined {
  if (configuration.token_exchange_client_secret) return configuration.token_exchange_client_secret;
  if (configuration.token_exchange_client_secret_file && fs.existsSync(configuration.token_exchange_client_secret_file)) {
    return fs.readFileSync(configuration.token_exchange_client_secret_file, "utf8").trim();
  }
  return undefined;
}

function splitValues(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
