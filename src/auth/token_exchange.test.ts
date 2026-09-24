import { jest } from "@jest/globals";
import {
  exchangeToken,
  UserDelegationCredentialProvider,
  ServiceCredentialProvider,
} from "./token_exchange.js";

describe("OAuth 2.0 Token Exchange and Credential Provider", () => {
  describe("exchangeToken (RFC 8693)", () => {
    it("successfully exchanges user token for API-specific token", async () => {
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue({
          status: 200,
          data: {
            access_token: "api-exchanged-token-xyz",
            issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
            token_type: "Bearer",
          },
        }),
      };

      const result = await exchangeToken(
        "mcp-user-token-123",
        {
          tokenExchangeUrl: "http://127.0.0.1:8080/oauth/token",
          targetAudience: "https://api.example.com",
          targetScopes: "api:read api:write",
          allowInsecureHttp: true,
          allowPrivateNetworks: true,
        },
        mockHttpClient
      );

      expect(result).toBe("api-exchanged-token-xyz");
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        "http://127.0.0.1:8080/oauth/token",
        expect.stringContaining("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        })
      );
    });

    it("fails closed when IdP returns an error response", async () => {
      const mockHttpClient = {
        post: jest.fn().mockRejectedValue({
          response: { status: 400, data: { error: "invalid_grant", error_description: "Token expired" } },
        }),
      };

      await expect(
        exchangeToken(
          "expired-token",
          {
            tokenExchangeUrl: "http://127.0.0.1:8080/oauth/token",
            targetAudience: "https://api.example.com",
            allowInsecureHttp: true,
            allowPrivateNetworks: true,
          },
          mockHttpClient
        )
      ).rejects.toThrow("Token exchange failed: invalid_grant");
    });
  });

  describe("Credential Providers", () => {
    it("UserDelegationCredentialProvider exchanges token and returns Authorization header", async () => {
      const mockExchange = jest.fn().mockResolvedValue("target-token-999");
      const provider = new UserDelegationCredentialProvider(
        {
          tokenExchangeUrl: "https://auth.example.com/oauth/token",
          targetAudience: "https://api.example.com",
        },
        mockExchange as any
      );

      const headers = await provider.resolveAuthHeaders({
        token: "inbound-user-token",
        clientId: "user-1",
        scopes: [],
      });

      expect(headers).toEqual({ Authorization: "Bearer target-token-999" });
      expect(mockExchange).toHaveBeenCalledWith("inbound-user-token", expect.any(Object), undefined);
    });

    it("UserDelegationCredentialProvider fails closed when authInfo is missing", async () => {
      const provider = new UserDelegationCredentialProvider({
        tokenExchangeUrl: "https://auth.example.com/oauth/token",
        targetAudience: "https://api.example.com",
      });

      await expect(provider.resolveAuthHeaders(undefined)).rejects.toThrow(
        "User delegation requires an authenticated user token."
      );
    });

    it("ServiceCredentialProvider returns empty headers for delegated request", async () => {
      const provider = new ServiceCredentialProvider();
      const headers = await provider.resolveAuthHeaders();
      expect(headers).toEqual({});
    });
  });
});
