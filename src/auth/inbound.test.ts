import { jest } from "@jest/globals";
import { generateKeyPair, SignJWT } from "jose";
import type { Request, Response } from "express";
import {
  createBearerVerifier,
  createOAuthJwtVerifier,
  createInboundAuthMiddleware,
  verifyBearerToken,
} from "./inbound.js";
import { Config } from "../utils/config.js";

describe("Inbound Authentication", () => {
  describe("Bearer Token Verification", () => {
    it("verifies matching token in constant time", () => {
      const secret = "super-secret-mcp-token-12345";
      expect(verifyBearerToken(secret, secret)).toBe(true);
      expect(verifyBearerToken("wrong-token", secret)).toBe(false);
      expect(verifyBearerToken("", secret)).toBe(false);
    });

    it("creates bearer verifier returning AuthInfo", async () => {
      const verifier = createBearerVerifier("valid-secret");
      const authInfo = await verifier.verifyAccessToken("valid-secret");
      expect(authInfo.token).toBe("valid-secret");
      expect(authInfo.clientId).toBe("bearer-client");

      await expect(verifier.verifyAccessToken("invalid")).rejects.toThrow("Invalid bearer token");
    });
  });

  describe("OAuth JWT Verifier", () => {
    let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
    const issuer = "https://auth.example.com";
    const audience = "https://mcp.example.com/mcp";

    beforeAll(async () => {
      keyPair = await generateKeyPair("ES256");
    });

    it("verifies valid signed JWT with matching issuer, audience and scopes", async () => {
      const jwt = await new SignJWT({
        sub: "user-123",
        client_id: "client-abc",
        scope: "mcp:tools mcp:prompts",
      })
        .setProtectedHeader({ alg: "ES256" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setExpirationTime("1h")
        .setIssuedAt()
        .sign(keyPair.privateKey);

      const verifier = createOAuthJwtVerifier({
        issuerUrl: issuer,
        audience,
        requiredScopes: ["mcp:tools"],
        keyResolver: async () => keyPair.publicKey,
      });

      const authInfo = await verifier.verifyAccessToken(jwt);
      expect(authInfo.clientId).toBe("client-abc");
      expect(authInfo.scopes).toContain("mcp:tools");
      expect(authInfo.scopes).toContain("mcp:prompts");
    });

    it("rejects token with missing required scope", async () => {
      const jwt = await new SignJWT({
        sub: "user-123",
        scope: "read:only",
      })
        .setProtectedHeader({ alg: "ES256" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setExpirationTime("1h")
        .sign(keyPair.privateKey);

      const verifier = createOAuthJwtVerifier({
        issuerUrl: issuer,
        audience,
        requiredScopes: ["mcp:tools"],
        keyResolver: async () => keyPair.publicKey,
      });

      await expect(verifier.verifyAccessToken(jwt)).rejects.toThrow("Missing required scope: mcp:tools");
    });

    it("rejects token with invalid audience", async () => {
      const jwt = await new SignJWT({ sub: "user-123", scope: "mcp:tools" })
        .setProtectedHeader({ alg: "ES256" })
        .setIssuer(issuer)
        .setAudience("https://wrong-audience.com")
        .setExpirationTime("1h")
        .sign(keyPair.privateKey);

      const verifier = createOAuthJwtVerifier({
        issuerUrl: issuer,
        audience,
        keyResolver: async () => keyPair.publicKey,
      });

      await expect(verifier.verifyAccessToken(jwt)).rejects.toThrow();
    });
  });

  describe("createInboundAuthMiddleware", () => {
    function createMockRes(): { res: Response; status: jest.Mock; json: jest.Mock; setHeader: jest.Mock } {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const setHeader = jest.fn();
      return { res: { status, json, setHeader } as unknown as Response, status, json, setHeader };
    }

    it("passes through for auth type none", () => {
      const cfg = new Config({ inboundAuthType: "none" });
      const middleware = createInboundAuthMiddleware(cfg);
      const next = jest.fn();
      middleware({} as Request, {} as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("returns 401 when Authorization header is missing for bearer auth", async () => {
      const cfg = new Config({ inboundAuthType: "bearer", inboundBearerToken: "secret123" });
      const middleware = createInboundAuthMiddleware(cfg);
      const { res, status, setHeader } = createMockRes();
      const next = jest.fn();

      await middleware({ headers: {} } as Request, res, next);
      expect(status).toHaveBeenCalledWith(401);
      expect(setHeader).toHaveBeenCalledWith("WWW-Authenticate", 'Bearer error="missing_token"');
      expect(next).not.toHaveBeenCalled();
    });

    it("attaches req.auth and calls next for valid bearer token", async () => {
      const cfg = new Config({ inboundAuthType: "bearer", inboundBearerToken: "secret123" });
      const middleware = createInboundAuthMiddleware(cfg);
      const { res } = createMockRes();
      const next = jest.fn();
      const req = { headers: { authorization: "Bearer secret123" } } as any;

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.auth?.clientId).toBe("bearer-client");
    });
  });
});
