import type { AxiosRequestConfig } from "axios";
import type { Config } from "../utils/config.js";

export interface AuthProviderProtocol {
  readonly providerName: string;
  isConfigured(): boolean;
  getAuthHeaders(): Record<string, string>;
  getAuthParams(): Record<string, string>;
  getAuthCookies(): Record<string, string>;
  getHttpxAuth(): unknown;
  apply(request: AxiosRequestConfig): AxiosRequestConfig;
}

export abstract class AuthProvider implements AuthProviderProtocol {
  abstract readonly providerName: string;
  abstract isConfigured(): boolean;
  abstract getAuthHeaders(): Record<string, string>;
  abstract getAuthParams(): Record<string, string>;
  abstract getAuthCookies(): Record<string, string>;
  abstract getHttpxAuth(): unknown;

  apply(request: AxiosRequestConfig): AxiosRequestConfig {
    const headers = { ...(request.headers as Record<string, string> | undefined), ...this.getAuthHeaders() };
    const params = { ...(request.params as Record<string, unknown> | undefined), ...this.getAuthParams() };
    const cookies = this.getAuthCookies();
    return {
      ...request,
      headers,
      params,
      ...(Object.keys(cookies).length > 0 ? { headers: { ...headers, Cookie: Object.entries(cookies).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("; ") } } : {}),
    };
  }
}

export class NullAuthProvider extends AuthProvider {
  readonly providerName = "none";

  constructor(_config?: Config) {
    super();
  }

  isConfigured(): boolean { return true; }
  getAuthHeaders(): Record<string, string> { return {}; }
  getAuthParams(): Record<string, string> { return {}; }
  getAuthCookies(): Record<string, string> { return {}; }
  getHttpxAuth(): unknown { return undefined; }
}
