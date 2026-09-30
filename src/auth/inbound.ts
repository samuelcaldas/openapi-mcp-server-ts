import crypto from "node:crypto";
import fs from "node:fs";
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { Config } from "../utils/config.js";

export function verifyBearerToken(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function createBearerVerifier(expectedToken: string): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const isValid = verifyBearerToken(token, expectedToken);
      if (!isValid) throw new Error("Invalid bearer token");
      return { token, clientId: "bearer-client", scopes: [] };
    },
  };
}

export interface OAuthJwtVerifierOptions {
  issuerUrl: string;
  audience: string;
  requiredScopes?: string[];
  jwksUri?: string;
  keyResolver?: JWTVerifyGetKey;
}

export function createOAuthJwtVerifier(options: OAuthJwtVerifierOptions): OAuthTokenVerifier {
  const getKey = options.keyResolver ?? createRemoteJWKSet(new URL(options.jwksUri ?? `${options.issuerUrl}/.well-known/jwks.json`));
  const requiredScopes = options.requiredScopes ?? [];

  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const { payload } = await jwtVerify(token, getKey, {
        issuer: options.issuerUrl,
        audience: options.audience,
      });
      const scopes = extractScopes(payload);
      assertRequiredScopes(scopes, requiredScopes);
      const clientId = String(payload.client_id ?? payload.sub ?? "unknown");
      return {
        token,
        clientId,
        scopes,
        expiresAt: payload.exp,
        extra: payload as Record<string, unknown>,
      };
    },
  };
}

function extractScopes(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.scp)) return payload.scp.map(String);
  if (Array.isArray(payload.scope)) return payload.scope.map(String);
  if (typeof payload.scope === "string") return payload.scope.split(" ").filter(Boolean);
  if (typeof payload.scp === "string") return payload.scp.split(" ").filter(Boolean);
  return [];
}

function assertRequiredScopes(tokenScopes: string[], requiredScopes: string[]): void {
  for (const required of requiredScopes) {
    if (!tokenScopes.includes(required)) {
      throw new Error(`Missing required scope: ${required}`);
    }
  }
}

export function resolveBearerSecret(configuration: Config): string {
  if (configuration.inbound_bearer_token) return configuration.inbound_bearer_token;
  if (configuration.inbound_bearer_token_file) {
    return fs.readFileSync(configuration.inbound_bearer_token_file, "utf8").trim();
  }
  return "";
}

export function createInboundAuthMiddleware(configuration: Config, verifier?: OAuthTokenVerifier): RequestHandler {
  const authType = configuration.inbound_auth_type.toLowerCase();
  if (authType === "none") {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  const resolvedVerifier = verifier ?? resolveVerifier(configuration, authType);
  return createAuthHandler(resolvedVerifier, configuration);
}

function resolveVerifier(configuration: Config, authType: string): OAuthTokenVerifier {
  if (authType === "bearer") {
    return createBearerVerifier(resolveBearerSecret(configuration));
  }
  return createOAuthJwtVerifier({
    issuerUrl: configuration.inbound_oauth_issuer_url,
    audience: configuration.inbound_oauth_audience || configuration.inbound_oauth_resource_server_url,
    jwksUri: configuration.inbound_oauth_jwks_uri || undefined,
    requiredScopes: configuration.inbound_oauth_scopes.split(",").map((s) => s.trim()).filter(Boolean),
  });
}

function createAuthHandler(verifier: OAuthTokenVerifier, configuration: Config): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      sendUnauthorized(res, configuration, "missing_token");
      return;
    }
    const token = authHeader.slice(7).trim();
    try {
      const authInfo = await verifier.verifyAccessToken(token);
      (req as Request & { auth?: AuthInfo }).auth = authInfo;
      next();
    } catch {
      sendUnauthorized(res, configuration, "invalid_token");
    }
  };
}

function sendUnauthorized(res: Response, configuration: Config, error: string): void {
  const resourceUrl = configuration.inbound_oauth_resource_server_url;
  const challenge = resourceUrl
    ? `Bearer error="${error}", resource_metadata="${resourceUrl}/.well-known/oauth-protected-resource/mcp"`
    : `Bearer error="${error}"`;
  res.setHeader("WWW-Authenticate", challenge);
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized: Invalid or missing token" },
    id: null,
  });
}
