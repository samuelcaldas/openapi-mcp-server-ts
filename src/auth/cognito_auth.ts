import type { Config } from "../utils/config.js";
import { ExpiredTokenError, InvalidCredentialsError, MissingCredentialsError, NetworkError } from "./auth_errors.js";
import { BearerAuthProvider } from "./bearer_auth.js";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";

export class CognitoAuthProvider extends BearerAuthProvider {
  readonly providerName: string = "cognito";
  private clientId = "";
  private username = "";
  private password = "";
  private clientSecret = "";
  private domain = "";
  private scopes: string[] = [];
  private region = "us-east-1";
  private tokenExpiresAt = 0;
  private refreshTokenValue?: string;
  readonly grantType: "client_credentials" | "password";
  private cognitoClient?: CognitoIdentityProviderClient;

  constructor(config: Config) {
    super(config, false);
    this.clientId = config.auth_cognito_client_id;
    this.username = config.auth_cognito_username;
    this.password = config.auth_cognito_password;
    this.clientSecret = config.auth_cognito_client_secret;
    this.domain = config.auth_cognito_domain;
    this.scopes = config.auth_cognito_scopes.split(",").map((scope) => scope.trim()).filter(Boolean);
    this.region = config.auth_cognito_region || "us-east-1";
    this.grantType = this.determineGrantType();
    
    if (this.grantType === "password") {
      this.cognitoClient = new CognitoIdentityProviderClient({ region: this.region });
    }

    if (this.token) this.tokenExpiresAt = this.extractTokenExpiry(this.token);
    this.initializeProvider();
  }

  private determineGrantType(): "client_credentials" | "password" {
    if (this.clientId && this.clientSecret && this.domain) return "client_credentials";
    return "password";
  }

  protected override validateConfig(): boolean {
    if (!this.clientId) throw new MissingCredentialsError("Cognito authentication requires a client ID");
    if (this.grantType === "client_credentials") {
      if (!this.clientSecret) throw new MissingCredentialsError("Client credentials flow requires a client secret");
      if (!this.domain) throw new MissingCredentialsError("Client credentials flow requires a domain");
      return true;
    }
    if (!this.username) throw new MissingCredentialsError("Password flow requires a username");
    if (!this.password) throw new MissingCredentialsError("Password flow requires a password");
    return true; // Password flow doesn't strictly need auth_token as it can fetch it
  }

  override getAuthHeaders(): Record<string, string> {
    return super.getAuthHeaders();
  }

  isTokenExpiredOrExpiringSoon(bufferSeconds = 300): boolean {
    return Date.now() / 1000 + bufferSeconds >= this.tokenExpiresAt;
  }

  async refreshToken(): Promise<void> {
    try {
      const token = this.grantType === "client_credentials"
        ? await this.getTokenClientCredentials()
        : await this.getTokenPassword();
      if (!token) throw new ExpiredTokenError("Token refresh failed");
      this.token = token;
      this.authHeaders = this.generateAuthHeaders(token);
    } catch (error) {
      if (error instanceof ExpiredTokenError) throw error;
      throw new ExpiredTokenError("Token refresh failed", { error: String(error) });
    }
  }

  async getTokenClientCredentials(): Promise<string | undefined> {
    const endpoint = `https://${this.domain}.auth.${this.region}.amazoncognito.com/oauth2/token`;
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`, "utf8").toString("base64");
    const body = new URLSearchParams({ grant_type: "client_credentials" });
    if (this.scopes.length > 0) body.set("scope", this.scopes.join(" "));
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (error) {
      throw new NetworkError("Cognito authentication failed", { error: String(error) });
    }
    if (!response.ok) throw new InvalidCredentialsError("Failed to obtain token with client credentials", { status: response.status });
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return undefined;
    this.tokenExpiresAt = Date.now() / 1000 + (data.expires_in ?? 3600);
    return data.access_token;
  }

  async getTokenPassword(): Promise<string | undefined> {
    if (this.config.auth_token) {
       this.tokenExpiresAt = this.extractTokenExpiry(this.config.auth_token);
       return this.config.auth_token;
    }
    
    if (!this.cognitoClient) throw new NetworkError("Cognito client not initialized");
    
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: this.username,
          PASSWORD: this.password
        }
      });
      const response = await this.cognitoClient.send(command);
      const token = response.AuthenticationResult?.AccessToken || response.AuthenticationResult?.IdToken;
      if (!token) throw new InvalidCredentialsError("No token received from Cognito");
      
      this.tokenExpiresAt = Date.now() / 1000 + (response.AuthenticationResult?.ExpiresIn ?? 3600);
      return token;
    } catch (err: any) {
      if (err.name === 'NotAuthorizedException') {
        throw new InvalidCredentialsError("Invalid Cognito credentials");
      }
      throw new NetworkError("Cognito password authentication failed", { error: err.message });
    }
  }

  extractTokenExpiry(token: string): number {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT token format");
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString("utf8")) as { exp?: number };
      return payload.exp ?? Math.floor(Date.now() / 1000) + 3600;
    } catch {
      return Math.floor(Date.now() / 1000) + 3600;
    }
  }
}
