import type { Config } from "../utils/config.js";
import { MissingCredentialsError } from "./auth_errors.js";
import { getTokenCache } from "./auth_cache.js";
import { BaseAuthProvider } from "./base_auth.js";

export class BearerAuthProvider extends BaseAuthProvider {
  readonly providerName: string = "bearer";
  protected token = "";
  readonly tokenTtl: number;

  constructor(config: Config, initialize = true) {
    super(config, false);
    this.token = config.auth_token;
    this.tokenTtl = (config as Config & { auth_token_ttl?: number }).auth_token_ttl ?? 3600;
    if (initialize) this.initializeProvider();
  }

  protected validateConfig(): boolean {
    if (!this.token) {
      throw new MissingCredentialsError("Bearer authentication requires a valid token", {
        help: "Provide a token using --auth-token or AUTH_TOKEN",
      });
    }
    return true;
  }

  protected initializeAuth(): void {
    this.authHeaders = this.generateAuthHeaders(this.token);
  }

  protected handleValidationError(): void {
    console.error("Bearer authentication requires a valid token.");
    super.handleValidationError();
  }

  protected generateAuthHeaders(token: string): Record<string, string> {
    const cacheKey = `bearer:${token}`;
    const cached = getTokenCache().get(cacheKey);
    if (cached) return cached as Record<string, string>;
    const headers = { Authorization: `Bearer ${token}` };
    getTokenCache().set(cacheKey, headers, this.tokenTtl);
    return headers;
  }
}
