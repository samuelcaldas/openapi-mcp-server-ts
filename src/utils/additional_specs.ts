import type { Config } from "./config.js";
import { createHttpClient, validateUrlForSpec } from "./httpClient.js";
import { parseOpenApiSpec } from "./openapi.js";
import { configureAuth, type AuthType } from "../auth/index.js";
import type { CredentialProvider } from "../auth/token_exchange.js";
import { prepare_openapi_integration, type OpenApiIntegration } from "../integration/index.js";

export interface PreparedSpecEntry {
  spec: Record<string, unknown>;
  client: ReturnType<typeof createHttpClient>;
  includeTags: string[];
  excludeTags: string[];
  integration: OpenApiIntegration;
}

/** Load every configured spec, rejecting invalid entries rather than dropping them. */
export async function loadAdditionalEntries(configuration: Config, allowedDirs: string[], provider?: CredentialProvider): Promise<PreparedSpecEntry[]> {
  if (!configuration.additional_specs) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(configuration.additional_specs);
  } catch {
    throw new Error("ADDITIONAL_SPECS must be a JSON array");
  }
  if (!Array.isArray(parsed)) throw new Error("ADDITIONAL_SPECS must be a JSON array");
  const entries: PreparedSpecEntry[] = [];
  for (const [index, raw] of parsed.entries()) {
    try {
      entries.push(await loadAdditionalEntry(configuration, raw, allowedDirs, provider));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "invalid entry";
      throw new Error(`Additional spec entry ${index}: ${reason}`, { cause: error });
    }
  }
  return entries;
}

async function loadAdditionalEntry(configuration: Config, raw: unknown, allowedDirs: string[], provider?: CredentialProvider): Promise<PreparedSpecEntry> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("expected an object");
  const entry = raw as Record<string, unknown>;
  const source = stringValue(entry.spec_url) || stringValue(entry.spec_path);
  const baseUrl = stringValue(entry.base_url);
  if (!source || !baseUrl) throw new Error("spec_url or spec_path and base_url are required");
  await validateUrlForSpec(baseUrl, { allowHttp: configuration.allow_insecure_http, allowPrivateNetworks: configuration.allow_private_networks });
  const spec = await parseOpenApiSpec(source, configuration.allow_private_networks, configuration.allow_insecure_http, allowedDirs);
  const client = createHttpClient(configuration.allow_private_networks, configuration.allow_insecure_http);
  if (configuration.delegation_mode !== "user") configureEntryAuth(client, entry);
  const includeTags = splitValues(stringValue(entry.include_tags));
  const excludeTags = splitValues(stringValue(entry.exclude_tags));
  const integration = await prepare_openapi_integration({
    source: spec, base_url: baseUrl, include_tags: includeTags, exclude_tags: excludeTags,
    validate_output: configuration.validate_output, credential_provider: provider, http_client: client,
    network_policy: { allow_private_networks: configuration.allow_private_networks,
      allow_insecure_http: configuration.allow_insecure_http, allowed_spec_dirs: allowedDirs },
  });
  return { spec: { ...spec, servers: [{ url: baseUrl }] }, client, includeTags, excludeTags, integration };
}

function configureEntryAuth(client: ReturnType<typeof createHttpClient>, entry: Record<string, unknown>): void {
  const authType = stringValue(entry.auth_type) || "none";
  const apiKeyIn = stringValue(entry.auth_api_key_in) || "header";
  configureAuth(client, authType as AuthType, {
    token: stringValue(entry.auth_token), username: stringValue(entry.auth_username),
    password: stringValue(entry.auth_password), apiKey: stringValue(entry.auth_api_key),
    apiKeyName: stringValue(entry.auth_api_key_name) || "X-API-Key",
    apiKeyIn: apiKeyIn as "header" | "query" | "cookie",
  });
}

function splitValues(value?: string): string[] {
  return (value ?? "").split(",").map((part) => part.trim()).filter(Boolean);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
