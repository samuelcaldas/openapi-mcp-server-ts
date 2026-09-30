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

  log_level = "info";
  enable_prometheus = false;
  prometheus_port = 9090;
  use_tenacity = true;
  http_max_retries = 3;
  http_retry_delay = 1000;

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
      ["log_level", options.logLevel],
      ["enable_prometheus", options.enablePrometheus],
      ["prometheus_port", toNumber(options.prometheusPort)],
      ["use_tenacity", options.useTenacity],
      ["http_max_retries", toNumber(options.httpMaxRetries)],
      ["http_retry_delay", toNumber(options.httpRetryDelay)],
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

const configOverrides: Record<string, unknown> = {};

export const config = {
  get API_NAME(): string { return (configOverrides.API_NAME as string) ?? (process.env.API_NAME || "awslabs-openapi-mcp-server"); },
  set API_NAME(v: string) { configOverrides.API_NAME = v; },
  get API_BASE_URL(): string { return (configOverrides.API_BASE_URL as string) ?? (process.env.API_BASE_URL || "https://localhost:8000"); },
  set API_BASE_URL(v: string) { configOverrides.API_BASE_URL = v; },
  get API_SPEC_URL(): string { return (configOverrides.API_SPEC_URL as string) ?? (process.env.API_SPEC_URL || ""); },
  set API_SPEC_URL(v: string) { configOverrides.API_SPEC_URL = v; },
  get API_SPEC_PATH(): string { return (configOverrides.API_SPEC_PATH as string) ?? (process.env.API_SPEC_PATH || ""); },
  set API_SPEC_PATH(v: string) { configOverrides.API_SPEC_PATH = v; },
  get HOST(): string { return (configOverrides.HOST as string) ?? (process.env.HOST || process.env.SERVER_HOST || "127.0.0.1"); },
  set HOST(v: string) { configOverrides.HOST = v; },
  get PORT(): number { return (configOverrides.PORT as number) ?? Number.parseInt(process.env.PORT || process.env.SERVER_PORT || "8000", 10); },
  set PORT(v: number) { configOverrides.PORT = v; },
  get TRANSPORT(): string { return (configOverrides.TRANSPORT as string) ?? (process.env.TRANSPORT || process.env.SERVER_TRANSPORT || "stdio"); },
  set TRANSPORT(v: string) { configOverrides.TRANSPORT = v; },
  get METRICS_MAX_HISTORY(): number { return (configOverrides.METRICS_MAX_HISTORY as number) ?? Number.parseInt(process.env.METRICS_MAX_HISTORY || "100", 10); },
  set METRICS_MAX_HISTORY(v: number) { configOverrides.METRICS_MAX_HISTORY = v; },
  get ENABLE_PROMETHEUS(): boolean { return (configOverrides.ENABLE_PROMETHEUS as boolean) ?? (process.env.ENABLE_PROMETHEUS === "true"); },
  set ENABLE_PROMETHEUS(v: boolean) { configOverrides.ENABLE_PROMETHEUS = v; },
  get PROMETHEUS_PORT(): number { return (configOverrides.PROMETHEUS_PORT as number) ?? Number.parseInt(process.env.PROMETHEUS_PORT || "9090", 10); },
  set PROMETHEUS_PORT(v: number) { configOverrides.PROMETHEUS_PORT = v; },
  get ENABLE_OPERATION_PROMPTS(): boolean { return (configOverrides.ENABLE_OPERATION_PROMPTS as boolean) ?? (process.env.ENABLE_OPERATION_PROMPTS !== "false"); },
  set ENABLE_OPERATION_PROMPTS(v: boolean) { configOverrides.ENABLE_OPERATION_PROMPTS = v; },
  get HTTP_MAX_CONNECTIONS(): number { return (configOverrides.HTTP_MAX_CONNECTIONS as number) ?? Number.parseInt(process.env.HTTP_MAX_CONNECTIONS || "100", 10); },
  set HTTP_MAX_CONNECTIONS(v: number) { configOverrides.HTTP_MAX_CONNECTIONS = v; },
  get HTTP_MAX_KEEPALIVE(): number { return (configOverrides.HTTP_MAX_KEEPALIVE as number) ?? Number.parseInt(process.env.HTTP_MAX_KEEPALIVE || "20", 10); },
  set HTTP_MAX_KEEPALIVE(v: number) { configOverrides.HTTP_MAX_KEEPALIVE = v; },
  get USE_TENACITY(): boolean { return (configOverrides.USE_TENACITY as boolean) ?? (process.env.USE_TENACITY !== "false"); },
  set USE_TENACITY(v: boolean) { configOverrides.USE_TENACITY = v; },
  get CACHE_MAXSIZE(): number { return (configOverrides.CACHE_MAXSIZE as number) ?? Number.parseInt(process.env.CACHE_MAXSIZE || "1000", 10); },
  set CACHE_MAXSIZE(v: number) { configOverrides.CACHE_MAXSIZE = v; },
  get CACHE_TTL(): number { return (configOverrides.CACHE_TTL as number) ?? Number.parseInt(process.env.CACHE_TTL || "3600", 10); },
  set CACHE_TTL(v: number) { configOverrides.CACHE_TTL = v; },
  get USE_CACHETOOLS(): boolean { return (configOverrides.USE_CACHETOOLS as boolean) ?? (process.env.USE_CACHETOOLS !== "false"); },
  set USE_CACHETOOLS(v: boolean) { configOverrides.USE_CACHETOOLS = v; },
  get VALIDATE_OUTPUT(): boolean { return (configOverrides.VALIDATE_OUTPUT as boolean) ?? (process.env.VALIDATE_OUTPUT !== "false"); },
  set VALIDATE_OUTPUT(v: boolean) { configOverrides.VALIDATE_OUTPUT = v; },
  get ALLOW_INSECURE_HTTP(): boolean { return (configOverrides.ALLOW_INSECURE_HTTP as boolean) ?? (process.env.ALLOW_INSECURE_HTTP === "true"); },
  set ALLOW_INSECURE_HTTP(v: boolean) { configOverrides.ALLOW_INSECURE_HTTP = v; },
  get ALLOW_PRIVATE_NETWORKS(): boolean { return (configOverrides.ALLOW_PRIVATE_NETWORKS as boolean) ?? (process.env.ALLOW_PRIVATE_NETWORKS === "true"); },
  set ALLOW_PRIVATE_NETWORKS(v: boolean) { configOverrides.ALLOW_PRIVATE_NETWORKS = v; },
};
