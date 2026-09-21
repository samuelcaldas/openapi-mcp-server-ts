import { createHash } from "node:crypto";
import type { Config } from "../utils/config.js";
import { ConfigurationError, MissingCredentialsError } from "./auth_errors.js";
import { getTokenCache } from "./auth_cache.js";
import { BaseAuthProvider } from "./base_auth.js";

export type ApiKeyLocation = "header" | "query" | "cookie";

export class ApiKeyAuthProvider extends BaseAuthProvider {
  readonly providerName = "api_key";
  protected apiKey = "";
  protected apiKeyName = "api_key";
  protected apiKeyIn: ApiKeyLocation | string = "header";
  protected apiKeyHash = "";

  constructor(config: Config) {
    super(config, false);
    this.apiKey = config.auth_api_key;
    this.apiKeyName = config.auth_api_key_name || "api_key";
    this.apiKeyIn = config.auth_api_key_in || "header";
    this.initializeProvider();
  }

  protected validateConfig(): boolean {
    if (!this.apiKey) {
      throw new MissingCredentialsError("API Key authentication requires a valid API key", {
        help: "Provide it using --auth-api-key or AUTH_API_KEY",
      });
    }
    if (!["header", "query", "cookie"].includes(this.apiKeyIn)) {
      throw new ConfigurationError(`Invalid API key location: ${this.apiKeyIn}`, {
        validLocations: ["header", "query", "cookie"],
      });
    }
    this.apiKeyHash = ApiKeyAuthProvider.hashApiKey(this.apiKey);
    return true;
  }

  protected initializeAuth(): void {
    if (this.apiKeyIn === "header") this.authHeaders = this.generateAuthHeaders(this.apiKeyHash, this.apiKeyName);
    if (this.apiKeyIn === "query") this.authParams = this.generateAuthParams(this.apiKeyHash, this.apiKeyName);
    if (this.apiKeyIn === "cookie") this.authCookies = this.generateAuthCookies(this.apiKeyHash, this.apiKeyName);
  }

  static hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  protected generateAuthHeaders(hash: string, name: string): Record<string, string> {
    return this.cachedAuthData(`api-key-header:${hash}:${name}`, { [name]: this.apiKey });
  }

  protected generateAuthParams(hash: string, name: string): Record<string, string> {
    return this.cachedAuthData(`api-key-query:${hash}:${name}`, { [name]: this.apiKey });
  }

  protected generateAuthCookies(hash: string, name: string): Record<string, string> {
    return this.cachedAuthData(`api-key-cookie:${hash}:${name}`, { [name]: this.apiKey });
  }

  private cachedAuthData(key: string, value: Record<string, string>): Record<string, string> {
    const cached = getTokenCache().get(key);
    if (cached) return cached as Record<string, string>;
    getTokenCache().set(key, value, 3600);
    return value;
  }
}
