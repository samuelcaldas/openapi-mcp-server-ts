import type { Config } from "../utils/config.js";
import { AuthError, ConfigurationError, formatErrorMessage } from "./auth_errors.js";
import { AuthProvider } from "./auth_provider.js";

export abstract class BaseAuthProvider extends AuthProvider {
  protected readonly config: Config;
  protected valid = false;
  protected authHeaders: Record<string, string> = {};
  protected authParams: Record<string, string> = {};
  protected authCookies: Record<string, string> = {};
  protected validationError?: AuthError;

  protected constructor(config: Config, initialize = true) {
    super();
    this.config = config;
    if (initialize) this.initializeProvider();
  }

  protected initializeProvider(): void {
    try {
      this.valid = this.validateConfig();
      if (this.valid) this.initializeAuth();
      else this.handleValidationError();
    } catch (error) {
      const authError = error instanceof AuthError
        ? error
        : new ConfigurationError(`Unexpected error during authentication provider initialization: ${String(error)}`);
      this.validationError = authError;
      this.valid = false;
      this.logAuthError(authError);
      throw authError;
    }
  }

  protected abstract validateConfig(): boolean;
  protected initializeAuth(): void {}

  protected handleValidationError(): void {
    this.validationError = new ConfigurationError(`Invalid configuration for ${this.providerName} authentication provider`);
    this.logAuthError(this.validationError);
  }

  protected logAuthError(error: AuthError): void {
    console.error(formatErrorMessage(this.providerName, error.errorType, error.message));
  }

  isConfigured(): boolean { return this.valid; }
  getValidationError(): AuthError | undefined { return this.validationError; }
  getAuthHeaders(): Record<string, string> { return this.valid ? { ...this.authHeaders } : {}; }
  getAuthParams(): Record<string, string> { return this.valid ? { ...this.authParams } : {}; }
  getAuthCookies(): Record<string, string> { return this.valid ? { ...this.authCookies } : {}; }
  getHttpxAuth(): unknown { return undefined; }
}
