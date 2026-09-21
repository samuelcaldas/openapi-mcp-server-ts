import { createHash } from "node:crypto";
import type { Config } from "../utils/config.js";
import { MissingCredentialsError } from "./auth_errors.js";
import { getTokenCache } from "./auth_cache.js";
import { BaseAuthProvider } from "./base_auth.js";

export class BasicAuthProvider extends BaseAuthProvider {
  readonly providerName = "basic";
  protected username = "";
  protected password = "";
  private httpxAuth?: { username: string; password: string };
  protected credentialsHash = "";

  constructor(config: Config) {
    super(config, false);
    this.username = config.auth_username;
    this.password = config.auth_password;
    this.initializeProvider();
  }

  protected validateConfig(): boolean {
    if (!this.username) throw new MissingCredentialsError("Basic authentication requires a username");
    if (!this.password) throw new MissingCredentialsError("Basic authentication requires a password");
    this.credentialsHash = BasicAuthProvider.hashCredentials(this.username, this.password);
    return true;
  }

  protected initializeAuth(): void {
    this.authHeaders = this.generateAuthHeaders(this.credentialsHash);
    this.httpxAuth = this.generateHttpxAuth(this.username, this.password);
  }

  protected handleValidationError(): void {
    console.error("Basic authentication requires both username and password.");
    super.handleValidationError();
  }

  static hashCredentials(username: string, password: string): string {
    return createHash("sha256").update(`${username}:${password}`).digest("hex");
  }

  protected generateAuthHeaders(_hash: string): Record<string, string> {
    const key = `basic:${this.credentialsHash}`;
    const cached = getTokenCache().get(key);
    if (cached) return cached as Record<string, string>;
    const token = Buffer.from(`${this.username}:${this.password}`, "utf8").toString("base64");
    const headers = { Authorization: `Basic ${token}` };
    getTokenCache().set(key, headers, 3600);
    return headers;
  }

  protected generateHttpxAuth(username: string, password: string): { username: string; password: string } {
    return { username, password };
  }

  override getHttpxAuth(): unknown {
    return this.httpxAuth;
  }
}
