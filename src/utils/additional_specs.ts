import type { Config } from "./config.js";
import { createHttpClient, validateUrlForSpec } from "./httpClient.js";
import { loadOpenApiSpec, parseOpenApiSpec } from "./openapi.js";
import { configureAuth, type AuthType } from "../auth/index.js";

export interface PreparedSpecEntry {
  spec: any;
  client: ReturnType<typeof createHttpClient>;
  includeTags: string[];
  excludeTags: string[];
}

/**
 * Loads additional OpenAPI specs defined in additional_specs JSON configuration.
 * @param configuration Server configuration.
 * @param allowedDirs Whitelisted spec directories.
 * @returns Array of prepared spec entries.
 */
export async function loadAdditionalEntries(configuration: Config, allowedDirs: string[]): Promise<PreparedSpecEntry[]> {
  if (!configuration.additional_specs) return [];
  let entries: unknown;
  try {
    entries = JSON.parse(configuration.additional_specs);
  } catch {
    return [];
  }
  if (!Array.isArray(entries)) return [];
  const result: PreparedSpecEntry[] = [];
  for (const rawEntry of entries) {
    if (!isRecord(rawEntry)) continue;
    const entry = await loadAdditionalEntry(configuration, rawEntry, allowedDirs);
    if (entry) result.push(entry);
  }
  return result;
}

async function loadAdditionalEntry(configuration: Config, entry: Record<string, unknown>, allowedDirs: string[]): Promise<PreparedSpecEntry | undefined> {
  const source = stringValue(entry.spec_url) || stringValue(entry.spec_path);
  const baseUrl = stringValue(entry.base_url);
  if (!source || !baseUrl) return undefined;
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
    return {
      spec: { ...spec, servers: [{ url: baseUrl }] },
      client,
      includeTags: splitValues(stringValue(entry.include_tags)),
      excludeTags: splitValues(stringValue(entry.exclude_tags)),
    };
  } catch {
    return undefined;
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
