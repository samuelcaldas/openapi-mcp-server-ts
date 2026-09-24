import axios from "axios";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { validateUrlForSpec } from "../utils/httpClient.js";

export interface TokenExchangeOptions {
  tokenExchangeUrl: string;
  targetAudience: string;
  targetResource?: string;
  targetScopes?: string;
  clientId?: string;
  clientSecret?: string;
  allowInsecureHttp?: boolean;
  allowPrivateNetworks?: boolean;
}

export interface CredentialProvider {
  resolveAuthHeaders(authInfo?: AuthInfo): Promise<Record<string, string>>;
}

export async function exchangeToken(
  userToken: string,
  options: TokenExchangeOptions,
  httpClient: { post: (url: string, data: string, config: any) => Promise<any> } = axios
): Promise<string> {
  await validateUrlForSpec(options.tokenExchangeUrl, {
    allowHttp: options.allowInsecureHttp,
    allowPrivateNetworks: options.allowPrivateNetworks,
  });

  const body = buildExchangeBody(userToken, options);
  const headers = buildExchangeHeaders(options);

  try {
    const response = await httpClient.post(options.tokenExchangeUrl, body, { headers });
    const accessToken = response.data?.access_token;
    if (!accessToken || typeof accessToken !== "string") {
      throw new Error("Token exchange response did not contain access_token.");
    }
    return accessToken;
  } catch (error: any) {
    const reason = error.response?.data?.error || error.message || "Unknown error";
    throw new Error(`Token exchange failed: ${reason}`, { cause: error });
  }
}

function buildExchangeBody(userToken: string, options: TokenExchangeOptions): string {
  const params = new URLSearchParams();
  params.append("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange");
  params.append("subject_token", userToken);
  params.append("subject_token_type", "urn:ietf:params:oauth:token-type:access_token");
  params.append("audience", options.targetAudience);
  if (options.targetResource) params.append("resource", options.targetResource);
  if (options.targetScopes) params.append("scope", options.targetScopes);
  return params.toString();
}

function buildExchangeHeaders(options: TokenExchangeOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (!options.clientId || !options.clientSecret) return headers;
  const credentials = `${options.clientId}:${options.clientSecret}`;
  headers.Authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
  return headers;
}

export class ServiceCredentialProvider implements CredentialProvider {
  async resolveAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }
}

export class UserDelegationCredentialProvider implements CredentialProvider {
  private readonly options: TokenExchangeOptions;
  private readonly exchangeFn: typeof exchangeToken;

  constructor(options: TokenExchangeOptions, exchangeFn: typeof exchangeToken = exchangeToken) {
    this.options = options;
    this.exchangeFn = exchangeFn;
  }

  async resolveAuthHeaders(authInfo?: AuthInfo): Promise<Record<string, string>> {
    if (!authInfo || !authInfo.token) {
      throw new Error("User delegation requires an authenticated user token.");
    }
    const targetToken = await this.exchangeFn(authInfo.token, this.options, undefined);
    return { Authorization: `Bearer ${targetToken}` };
  }
}
