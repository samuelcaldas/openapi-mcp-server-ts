import { registerAuthProvider } from "./auth_factory.js";
import { ApiKeyAuthProvider } from "./api_key_auth.js";
import { BasicAuthProvider } from "./basic_auth.js";
import { BearerAuthProvider } from "./bearer_auth.js";
import { CognitoAuthProvider } from "./cognito_auth.js";
import type { AuthProviderConstructor } from "./auth_factory.js";

export function registerProviderByType(authType: string): void {
  const normalized = authType.toLowerCase();
  const providers = new Map<string, AuthProviderConstructor>([
    ["bearer", BearerAuthProvider],
    ["basic", BasicAuthProvider],
    ["api_key", ApiKeyAuthProvider],
    ["apikey", ApiKeyAuthProvider],
    ["cognito", CognitoAuthProvider],
  ]);
  const provider = providers.get(normalized);
  if (!provider) return registerAllProviders();
  try {
    registerAuthProvider(normalized, provider);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("already registered")) throw error;
  }
}

export function registerAllProviders(): void {
  for (const type of ["bearer", "basic", "api_key", "cognito"]) registerProviderByType(type);
}

export function registerAuthProviders(): void {
  const type = process.env.AUTH_TYPE;
  if (type) registerProviderByType(type);
  else registerAllProviders();
}
