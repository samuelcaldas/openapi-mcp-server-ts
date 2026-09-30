import {
  ConfigOptions,
  stringValue,
  numberOrString,
  booleanValue,
} from "./config_env.js";

/**
 * Normalizes user-supplied arguments into standard ConfigOptions.
 * @param args Raw argument dictionary.
 * @returns Normalized options.
 */
export function normalizeArgs(args: ConfigOptions | Record<string, unknown>): ConfigOptions {
  const source = args as Record<string, unknown>;
  const spec = stringValue(source.spec);
  const specUrl = stringValue(source.specUrl ?? source.apiSpecUrl ?? source.api_spec_url) || (spec && isUrl(spec) ? spec : undefined);
  const specPath = stringValue(source.specPath ?? source.apiSpecPath ?? source.api_spec_path) || (spec && !isUrl(spec) ? spec : undefined);

  return {
    apiName: stringValue(source.apiName ?? source.api_name),
    apiBaseUrl: stringValue(source.apiUrl ?? source.apiBaseUrl ?? source.api_base_url),
    apiSpecUrl: specUrl,
    apiSpecPath: specPath,
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
    inboundAuthType: stringValue(source.inboundAuthType ?? source.inbound_auth_type),
    inboundBearerToken: stringValue(source.inboundBearerToken ?? source.inbound_bearer_token),
    inboundBearerTokenFile: stringValue(source.inboundBearerTokenFile ?? source.inbound_bearer_token_file),
    inboundOauthIssuerUrl: stringValue(source.inboundOauthIssuerUrl ?? source.inbound_oauth_issuer_url),
    inboundOauthJwksUri: stringValue(source.inboundOauthJwksUri ?? source.inbound_oauth_jwks_uri),
    inboundOauthAudience: stringValue(source.inboundOauthAudience ?? source.inbound_oauth_audience),
    inboundOauthResourceServerUrl: stringValue(source.inboundOauthResourceServerUrl ?? source.inbound_oauth_resource_server_url),
    inboundOauthScopes: stringValue(source.inboundOauthScopes ?? source.inbound_oauth_scopes),
    delegationMode: stringValue(source.delegationMode ?? source.delegation_mode),
    tokenExchangeUrl: stringValue(source.tokenExchangeUrl ?? source.token_exchange_url),
    tokenExchangeAudience: stringValue(source.tokenExchangeAudience ?? source.token_exchange_audience),
    tokenExchangeScopes: stringValue(source.tokenExchangeScopes ?? source.token_exchange_scopes),
    tokenExchangeClientId: stringValue(source.tokenExchangeClientId ?? source.token_exchange_client_id),
    tokenExchangeClientSecret: stringValue(source.tokenExchangeClientSecret ?? source.token_exchange_client_secret),
    tokenExchangeClientSecretFile: stringValue(source.tokenExchangeClientSecretFile ?? source.token_exchange_client_secret_file),
    trustProxy: stringValue(source.trustProxy ?? source.trust_proxy),
    allowedHosts: stringValue(source.allowedHosts ?? source.allowed_hosts),
    allowedOrigins: stringValue(source.allowedOrigins ?? source.allowed_origins),
  };
}

function isUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
