import {
  ConfigOptions,
  readEnvironment,
  stringValue,
} from "./config_env.js";
import { normalizeArgs } from "./config_normalizer.js";

export type { ConfigOptions };

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

  inbound_auth_type = "none";
  inbound_bearer_token = "";
  inbound_bearer_token_file = "";
  inbound_oauth_issuer_url = "";
  inbound_oauth_jwks_uri = "";
  inbound_oauth_audience = "";
  inbound_oauth_resource_server_url = "";
  inbound_oauth_scopes = "";

  delegation_mode = "service";
  token_exchange_url = "";
  token_exchange_audience = "";
  token_exchange_scopes = "";
  token_exchange_client_id = "";
  token_exchange_client_secret = "";
  token_exchange_client_secret_file = "";

  trust_proxy = "";
  allowed_hosts = "";
  allowed_origins = "";

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
      ["inbound_auth_type", options.inboundAuthType],
      ["inbound_bearer_token", options.inboundBearerToken],
      ["inbound_bearer_token_file", options.inboundBearerTokenFile],
      ["inbound_oauth_issuer_url", options.inboundOauthIssuerUrl],
      ["inbound_oauth_jwks_uri", options.inboundOauthJwksUri],
      ["inbound_oauth_audience", options.inboundOauthAudience],
      ["inbound_oauth_resource_server_url", options.inboundOauthResourceServerUrl],
      ["inbound_oauth_scopes", options.inboundOauthScopes],
      ["delegation_mode", options.delegationMode],
      ["token_exchange_url", options.tokenExchangeUrl],
      ["token_exchange_audience", options.tokenExchangeAudience],
      ["token_exchange_scopes", options.tokenExchangeScopes],
      ["token_exchange_client_id", options.tokenExchangeClientId],
      ["token_exchange_client_secret", options.tokenExchangeClientSecret],
      ["token_exchange_client_secret_file", options.tokenExchangeClientSecretFile],
      ["trust_proxy", stringValue(options.trustProxy)],
      ["allowed_hosts", options.allowedHosts],
      ["allowed_origins", options.allowedOrigins],
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

export function loadConfig(args?: ConfigOptions | Record<string, unknown>): Config {
  const environment = readEnvironment();
  const normalizedArgs = args ? normalizeArgs(args) : {};
  const suppliedArgs = Object.fromEntries(
    Object.entries(normalizedArgs).filter(([, value]) => value !== undefined)
  );
  return new Config({ ...environment, ...suppliedArgs });
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
