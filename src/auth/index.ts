import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { getAuthProvider, isAuthTypeAvailable, registerAuthProvider, clearProviderCache } from "./auth_factory.js";
import { AuthProvider, NullAuthProvider } from "./auth_provider.js";
import { ApiKeyAuthProvider } from "./api_key_auth.js";
import { BasicAuthProvider } from "./basic_auth.js";
import { BearerAuthProvider } from "./bearer_auth.js";
import { CognitoAuthProvider } from "./cognito_auth.js";
import * as errors from "./auth_errors.js";

export type AuthType = "none" | "bearer" | "basic" | "apikey" | "api_key" | "cognito";
export interface AuthOptions {
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyName?: string;
  apiKeyIn?: "header" | "query" | "cookie";
  cognitoClientId?: string;
  cognitoDomain?: string;
  cognitoRegion?: string;
  cognitoScopes?: string;
  cognitoPoolId?: string;
}

export { AuthProvider, NullAuthProvider, ApiKeyAuthProvider, BasicAuthProvider, BearerAuthProvider, CognitoAuthProvider };
export { getAuthProvider, isAuthTypeAvailable, registerAuthProvider, clearProviderCache };
export * from "./auth_errors.js";
export * from "./auth_cache.js";
export * from "./auth_provider.js";

export function configureAuth(client: AxiosInstance, authType: AuthType, options: AuthOptions): void {
  client.interceptors.request.use((request: InternalAxiosRequestConfig) => {
    const provider = createProvider(authType, options);
    return applyProvider(request, provider);
  });
}

function createProvider(authType: AuthType, options: AuthOptions): AuthProvider {
  const config = {
    auth_type: authType,
    auth_token: options.token ?? (authType === "cognito" ? "cognito-token" : ""),
    auth_username: options.username ?? "",
    auth_password: options.password ?? "",
    auth_api_key: options.apiKey ?? "",
    auth_api_key_name: options.apiKeyName ?? "x-api-key",
    auth_api_key_in: options.apiKeyIn ?? "header",
    auth_cognito_client_id: options.cognitoClientId ?? "",
    auth_cognito_domain: options.cognitoDomain ?? "",
    auth_cognito_region: options.cognitoRegion ?? "us-east-1",
    auth_cognito_scopes: options.cognitoScopes ?? "",
    auth_cognito_user_pool_id: options.cognitoPoolId ?? "",
    auth_cognito_username: options.username ?? "",
    auth_cognito_password: options.password ?? "",
  } as any;
  if (authType === "none") return new NullAuthProvider(config);
  return getAuthProvider(config);
}

function applyProvider(request: InternalAxiosRequestConfig, provider: AuthProvider): InternalAxiosRequestConfig {
  const headers = request.headers;
  for (const [name, value] of Object.entries(provider.getAuthHeaders())) {
    if (typeof headers.set === "function") headers.set(name, value);
    else (headers as unknown as Record<string, string>)[name] = value;
  }
  request.params = { ...(request.params as Record<string, unknown> | undefined), ...provider.getAuthParams() };
  const cookies = provider.getAuthCookies();
  if (Object.keys(cookies).length > 0) {
    const cookieHeader = Object.entries(cookies).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
    if (typeof headers.set === "function") headers.set("Cookie", cookieHeader);
    else (headers as unknown as Record<string, string>).Cookie = cookieHeader;
  }
  return request;
}

void errors;
