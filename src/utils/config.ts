export type BooleanLike = boolean | string | undefined;

export interface ConfigOptions {
  apiName?: string;
  apiBaseUrl?: string;
  apiSpecUrl?: string;
  apiSpecPath?: string;
  authType?: string;
  authUsername?: string;
  authPassword?: string;
  authToken?: string;
  authApiKey?: string;
  authApiKeyName?: string;
  authApiKeyIn?: string;
  authCognitoClientId?: string;
  authCognitoUsername?: string;
  authCognitoPassword?: string;
  authCognitoClientSecret?: string;
  authCognitoDomain?: string;
  authCognitoScopes?: string;
  authCognitoUserPoolId?: string;
  authCognitoRegion?: string;
  host?: string;
  port?: number | string;
  debug?: boolean;
  transport?: string;
  messageTimeout?: number | string;
  version?: string;
  includeTags?: string;
  excludeTags?: string;
  validateOutput?: boolean;
  noValidateOutput?: boolean;
  additionalSpecs?: string;
  allowInsecureHttp?: boolean;
  allowPrivateNetworks?: boolean;
  allowedSpecDirs?: string;
}

/** Runtime configuration matching the Python server's Config dataclass. */
export class Config {
  api_name = "awslabs-openapi-mcp-server";
  api_base_url = "https://localhost:8000";
  api_spec_url = "";
  api_spec_path = "";

  auth_type = "none";
  auth_username = "";
  auth_password = "";
  auth_token = "";
  auth_api_key = "";
  auth_api_key_name = "api_key";
  auth_api_key_in = "header";

  auth_cognito_client_id = "";
  auth_cognito_username = "";
  auth_cognito_password = "";
  auth_cognito_client_secret = "";
  auth_cognito_domain = "";
  auth_cognito_scopes = "";
  auth_cognito_user_pool_id = "";
  auth_cognito_region = "us-east-1";

  host = "127.0.0.1";
  port = 8000;
  debug = false;
  transport = "stdio";
  message_timeout = 60;
  version = "1.0.0";

  include_tags = "";
  exclude_tags = "";
  validate_output = true;
  additional_specs = "";
  allow_insecure_http = false;
  allow_private_networks = false;
  allowed_spec_dirs = "";

  constructor(options: ConfigOptions = {}) {
    this.apply(normalizeArgs(options as ConfigOptions & Record<string, unknown>));
  }

  private apply(options: ConfigOptions): void {
    const assignments: Array<[keyof Config, unknown]> = [
      ["api_name", options.apiName],
      ["api_base_url", options.apiBaseUrl],
      ["api_spec_url", options.apiSpecUrl],
      ["api_spec_path", options.apiSpecPath],
      ["auth_type", options.authType],
      ["auth_username", options.authUsername],
      ["auth_password", options.authPassword],
      ["auth_token", options.authToken],
      ["auth_api_key", options.authApiKey],
      ["auth_api_key_name", options.authApiKeyName],
      ["auth_api_key_in", options.authApiKeyIn],
      ["auth_cognito_client_id", options.authCognitoClientId],
      ["auth_cognito_username", options.authCognitoUsername],
      ["auth_cognito_password", options.authCognitoPassword],
      ["auth_cognito_client_secret", options.authCognitoClientSecret],
      ["auth_cognito_domain", options.authCognitoDomain],
      ["auth_cognito_scopes", options.authCognitoScopes],
      ["auth_cognito_user_pool_id", options.authCognitoUserPoolId],
      ["auth_cognito_region", options.authCognitoRegion],
      ["host", options.host],
      ["port", toNumber(options.port)],
      ["debug", options.debug],
      ["transport", options.transport],
      ["message_timeout", toNumber(options.messageTimeout)],
      ["version", options.version],
      ["include_tags", options.includeTags],
      ["exclude_tags", options.excludeTags],
      ["validate_output", options.validateOutput],
      ["additional_specs", options.additionalSpecs],
      ["allow_insecure_http", options.allowInsecureHttp],
      ["allow_private_networks", options.allowPrivateNetworks],
      ["allowed_spec_dirs", options.allowedSpecDirs],
    ];

    for (const [key, value] of assignments) {
      if (value !== undefined && value !== "") {
        (this as unknown as Record<string, unknown>)[key] = value;
      }
    }
    if (options.noValidateOutput) {
      this.validate_output = false;
    }
  }
}

function toNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

function readEnvironment(): ConfigOptions {
  const env = process.env;
  return {
    apiName: env.API_NAME,
    apiBaseUrl: env.API_BASE_URL,
    apiSpecUrl: env.API_SPEC_URL,
    apiSpecPath: env.API_SPEC_PATH,
    authType: env.AUTH_TYPE,
    authUsername: env.AUTH_USERNAME,
    authPassword: env.AUTH_PASSWORD,
    authToken: env.AUTH_TOKEN,
    authApiKey: env.AUTH_API_KEY,
    authApiKeyName: env.AUTH_API_KEY_NAME,
    authApiKeyIn: env.AUTH_API_KEY_IN,
    authCognitoClientId: env.AUTH_COGNITO_CLIENT_ID,
    authCognitoUsername: env.AUTH_COGNITO_USERNAME,
    authCognitoPassword: env.AUTH_COGNITO_PASSWORD,
    authCognitoClientSecret: env.AUTH_COGNITO_CLIENT_SECRET,
    authCognitoDomain: env.AUTH_COGNITO_DOMAIN,
    authCognitoScopes: env.AUTH_COGNITO_SCOPES,
    authCognitoUserPoolId: env.AUTH_COGNITO_USER_POOL_ID,
    authCognitoRegion: env.AUTH_COGNITO_REGION,
    host: env.SERVER_HOST,
    port: env.SERVER_PORT,
    debug: env.SERVER_DEBUG === undefined ? undefined : parseBoolean(env.SERVER_DEBUG, false),
    transport: env.SERVER_TRANSPORT,
    messageTimeout: env.SERVER_MESSAGE_TIMEOUT,
    includeTags: env.INCLUDE_TAGS,
    excludeTags: env.EXCLUDE_TAGS,
    validateOutput: env.VALIDATE_OUTPUT === undefined ? undefined : env.VALIDATE_OUTPUT.toLowerCase() !== "false",
    additionalSpecs: env.ADDITIONAL_SPECS,
    allowInsecureHttp: env.ALLOW_INSECURE_HTTP === undefined ? undefined : parseBoolean(env.ALLOW_INSECURE_HTTP, false),
    allowPrivateNetworks: env.ALLOW_PRIVATE_NETWORKS === undefined ? undefined : parseBoolean(env.ALLOW_PRIVATE_NETWORKS, false),
    allowedSpecDirs: env.ALLOWED_SPEC_DIRS,
  };
}

/** Load configuration with environment values overridden by CLI-like options. */
export function loadConfig(args?: ConfigOptions | Record<string, unknown>): Config {
  const environment = readEnvironment();
  const normalizedArgs = args ? normalizeArgs(args) : {};
  return new Config({ ...environment, ...normalizedArgs });
}

function normalizeArgs(args: ConfigOptions | Record<string, unknown>): ConfigOptions {
  const source = args as Record<string, unknown>;
  return {
    apiName: stringValue(source.apiName ?? source.api_name),
    apiBaseUrl: stringValue(source.apiUrl ?? source.apiBaseUrl ?? source.api_base_url),
    apiSpecUrl: stringValue(source.specUrl ?? source.apiSpecUrl ?? source.api_spec_url),
    apiSpecPath: stringValue(source.specPath ?? source.apiSpecPath ?? source.api_spec_path),
    authType: stringValue(source.authType ?? source.auth_type),
    authUsername: stringValue(source.authUsername ?? source.auth_username),
    authPassword: stringValue(source.authPassword ?? source.auth_password),
    authToken: stringValue(source.authToken ?? source.auth_token ?? source.token),
    authApiKey: stringValue(source.authApiKey ?? source.auth_api_key ?? source.apiKey),
    authApiKeyName: stringValue(source.authApiKeyName ?? source.auth_api_key_name),
    authApiKeyIn: stringValue(source.authApiKeyIn ?? source.auth_api_key_in),
    authCognitoClientId: stringValue(source.authCognitoClientId ?? source.auth_cognito_client_id),
    authCognitoUsername: stringValue(source.authCognitoUsername ?? source.auth_cognito_username),
    authCognitoPassword: stringValue(source.authCognitoPassword ?? source.auth_cognito_password),
    authCognitoClientSecret: stringValue(source.authCognitoClientSecret ?? source.auth_cognito_client_secret),
    authCognitoDomain: stringValue(source.authCognitoDomain ?? source.auth_cognito_domain),
    authCognitoScopes: stringValue(source.authCognitoScopes ?? source.auth_cognito_scopes),
    authCognitoUserPoolId: stringValue(source.authCognitoUserPoolId ?? source.auth_cognito_user_pool_id),
    authCognitoRegion: stringValue(source.authCognitoRegion ?? source.auth_cognito_region),
    host: stringValue(source.host),
    port: numberOrString(source.port),
    debug: booleanValue(source.debug),
    transport: stringValue(source.transport),
    messageTimeout: numberOrString(source.messageTimeout ?? source.message_timeout),
    includeTags: stringValue(source.includeTags ?? source.include_tags),
    excludeTags: stringValue(source.excludeTags ?? source.exclude_tags),
    validateOutput: booleanValue(source.validateOutput ?? source.validate_output),
    noValidateOutput: booleanValue(source.noValidateOutput ?? source.no_validate_output),
    additionalSpecs: stringValue(source.additionalSpecs ?? source.additional_specs),
    allowInsecureHttp: booleanValue(source.allowInsecureHttp ?? source.allow_insecure_http),
    allowPrivateNetworks: booleanValue(source.allowPrivateNetworks ?? source.allow_private_networks),
    allowedSpecDirs: stringValue(source.allowedSpecDirs ?? source.allowed_spec_dirs),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberOrString(value: unknown): number | string | undefined {
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export const config = {
  API_NAME: process.env.API_NAME || "awslabs-openapi-mcp-server",
  API_BASE_URL: process.env.API_BASE_URL || "https://localhost:8000",
  API_SPEC_URL: process.env.API_SPEC_URL || "",
  API_SPEC_PATH: process.env.API_SPEC_PATH || "",
  HOST: process.env.HOST || process.env.SERVER_HOST || "127.0.0.1",
  PORT: Number.parseInt(process.env.PORT || process.env.SERVER_PORT || "8000", 10),
  TRANSPORT: process.env.TRANSPORT || process.env.SERVER_TRANSPORT || "stdio",
  METRICS_MAX_HISTORY: Number.parseInt(process.env.METRICS_MAX_HISTORY || "100", 10),
  ENABLE_PROMETHEUS: process.env.ENABLE_PROMETHEUS === "true",
  PROMETHEUS_PORT: Number.parseInt(process.env.PROMETHEUS_PORT || "9090", 10),
  ENABLE_OPERATION_PROMPTS: process.env.ENABLE_OPERATION_PROMPTS !== "false",
  HTTP_MAX_CONNECTIONS: Number.parseInt(process.env.HTTP_MAX_CONNECTIONS || "100", 10),
  HTTP_MAX_KEEPALIVE: Number.parseInt(process.env.HTTP_MAX_KEEPALIVE || "20", 10),
  USE_TENACITY: process.env.USE_TENACITY !== "false",
  CACHE_MAXSIZE: Number.parseInt(process.env.CACHE_MAXSIZE || "1000", 10),
  CACHE_TTL: Number.parseInt(process.env.CACHE_TTL || "3600", 10),
  USE_CACHETOOLS: process.env.USE_CACHETOOLS !== "false",
  VALIDATE_OUTPUT: process.env.VALIDATE_OUTPUT !== "false",
  ALLOW_INSECURE_HTTP: process.env.ALLOW_INSECURE_HTTP === "true",
  ALLOW_PRIVATE_NETWORKS: process.env.ALLOW_PRIVATE_NETWORKS === "true",
};
