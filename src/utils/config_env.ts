export interface ConfigOptions {
  apiName?: string;
  apiBaseUrl?: string;
  apiSpecUrl?: string;
  apiSpecPath?: string;
  spec?: string;
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
  inboundAuthType?: string;
  inboundBearerToken?: string;
  inboundBearerTokenFile?: string;
  inboundOauthIssuerUrl?: string;
  inboundOauthJwksUri?: string;
  inboundOauthAudience?: string;
  inboundOauthResourceServerUrl?: string;
  inboundOauthScopes?: string;
  delegationMode?: string;
  tokenExchangeUrl?: string;
  tokenExchangeAudience?: string;
  tokenExchangeScopes?: string;
  tokenExchangeClientId?: string;
  tokenExchangeClientSecret?: string;
  tokenExchangeClientSecretFile?: string;
  trustProxy?: string | boolean;
  allowedHosts?: string;
  allowedOrigins?: string;
  logLevel?: string;
  enablePrometheus?: boolean;
  prometheusPort?: number | string;
  useTenacity?: boolean;
  httpMaxRetries?: number | string;
  httpRetryDelay?: number | string;
}

export function readEnvironment(): ConfigOptions {
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
    host: env.SERVER_HOST || env.HOST,
    port: env.SERVER_PORT || env.PORT,
    debug: parseOptionalBoolean(env.SERVER_DEBUG),
    transport: env.SERVER_TRANSPORT || env.TRANSPORT,
    messageTimeout: env.SERVER_MESSAGE_TIMEOUT,
    includeTags: env.INCLUDE_TAGS,
    excludeTags: env.EXCLUDE_TAGS,
    validateOutput: env.VALIDATE_OUTPUT === undefined ? undefined : env.VALIDATE_OUTPUT.toLowerCase() !== "false",
    additionalSpecs: env.ADDITIONAL_SPECS,
    allowInsecureHttp: parseOptionalBoolean(env.ALLOW_INSECURE_HTTP),
    allowPrivateNetworks: parseOptionalBoolean(env.ALLOW_PRIVATE_NETWORKS),
    allowedSpecDirs: env.ALLOWED_SPEC_DIRS,
    inboundAuthType: env.INBOUND_AUTH_TYPE,
    inboundBearerToken: env.INBOUND_BEARER_TOKEN,
    inboundBearerTokenFile: env.INBOUND_BEARER_TOKEN_FILE,
    inboundOauthIssuerUrl: env.INBOUND_OAUTH_ISSUER_URL,
    inboundOauthJwksUri: env.INBOUND_OAUTH_JWKS_URI,
    inboundOauthAudience: env.INBOUND_OAUTH_AUDIENCE,
    inboundOauthResourceServerUrl: env.INBOUND_OAUTH_RESOURCE_SERVER_URL,
    inboundOauthScopes: env.INBOUND_OAUTH_SCOPES,
    delegationMode: env.DELEGATION_MODE,
    tokenExchangeUrl: env.TOKEN_EXCHANGE_URL,
    tokenExchangeAudience: env.TOKEN_EXCHANGE_AUDIENCE,
    tokenExchangeScopes: env.TOKEN_EXCHANGE_SCOPES,
    tokenExchangeClientId: env.TOKEN_EXCHANGE_CLIENT_ID,
    tokenExchangeClientSecret: env.TOKEN_EXCHANGE_CLIENT_SECRET,
    tokenExchangeClientSecretFile: env.TOKEN_EXCHANGE_CLIENT_SECRET_FILE,
    trustProxy: env.TRUST_PROXY,
    allowedHosts: env.ALLOWED_HOSTS,
    allowedOrigins: env.ALLOWED_ORIGINS,
    logLevel: env.LOG_LEVEL,
    enablePrometheus: parseOptionalBoolean(env.ENABLE_PROMETHEUS),
    prometheusPort: env.PROMETHEUS_PORT,
    useTenacity: env.USE_TENACITY === undefined ? undefined : parseOptionalBoolean(env.USE_TENACITY),
    httpMaxRetries: env.HTTP_MAX_RETRIES,
    httpRetryDelay: env.HTTP_RETRY_DELAY,
  };
}

export function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

export function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed;
}

export function numberOrString(value: unknown): number | string | undefined {
  if (typeof value === "number" || typeof value === "string") return value;
  return undefined;
}

export function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}
