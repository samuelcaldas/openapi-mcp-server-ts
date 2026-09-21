import { createHash } from "node:crypto";
import type { Config } from "../utils/config.js";
import { ApiKeyAuthProvider } from "./api_key_auth.js";
import { BasicAuthProvider } from "./basic_auth.js";
import { BearerAuthProvider } from "./bearer_auth.js";
import { CognitoAuthProvider } from "./cognito_auth.js";
import { AuthProviderProtocol, NullAuthProvider } from "./auth_provider.js";

export type AuthProviderConstructor = new (config: Config) => AuthProviderProtocol;

export const authProviders = new Map<string, AuthProviderConstructor>([
  ["none", NullAuthProvider],
  ["bearer", BearerAuthProvider],
  ["basic", BasicAuthProvider],
  ["api_key", ApiKeyAuthProvider],
  ["apikey", ApiKeyAuthProvider],
  ["cognito", CognitoAuthProvider],
]);

const providerCache = new Map<string, AuthProviderProtocol>();

export function registerAuthProvider(authType: string, providerClass: AuthProviderConstructor): void {
  const normalized = authType.toLowerCase();
  if (authProviders.has(normalized)) throw new Error(`Authentication provider for type '${normalized}' already registered`);
  authProviders.set(normalized, providerClass);
}

export function isAuthTypeAvailable(authType: string): boolean {
  return authProviders.has(authType.toLowerCase());
}

export function clearProviderCache(): void {
  providerCache.clear();
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function getAuthProvider(config: Config): AuthProviderProtocol {
  const requested = config.auth_type.toLowerCase();
  const authType = authProviders.has(requested) ? requested : "none";
  const key = JSON.stringify({
    authType,
    token: hashSecret(config.auth_token),
    username: config.auth_username,
    password: hashSecret(config.auth_password),
    apiKey: hashSecret(config.auth_api_key),
    apiKeyName: config.auth_api_key_name,
    apiKeyIn: config.auth_api_key_in,
    cognito: [hashSecret(config.auth_cognito_client_id), config.auth_cognito_username, config.auth_cognito_domain],
  });
  const cached = providerCache.get(key);
  if (cached) return cached;
  const Provider = authProviders.get(authType) ?? NullAuthProvider;
  const provider = new Provider(config);
  providerCache.set(key, provider);
  return provider;
}
