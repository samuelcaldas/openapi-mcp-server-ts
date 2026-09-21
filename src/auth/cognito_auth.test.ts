import { jest, describe, it, expect } from "@jest/globals";
import { Config } from "../utils/config.js";

// Mock the AWS SDK
jest.unstable_mockModule("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send() {
      return Promise.resolve({
        AuthenticationResult: {
          AccessToken: "mock-token",
          ExpiresIn: 3600
        }
      });
    }
  },
  InitiateAuthCommand: class {}
}));

const { CognitoAuthProvider } = await import("./cognito_auth.js");

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ access_token: "mock-cc-token", expires_in: 3600 }),
  } as Response)
) as any;

describe("CognitoAuthProvider", () => {
  const baseConfig: Config = {
    auth_cognito_client_id: "client",
    auth_cognito_username: "user",
    auth_cognito_password: "password",
    auth_cognito_client_secret: "",
    auth_cognito_domain: "",
    auth_cognito_scopes: "",
    auth_cognito_region: "us-east-1",
    auth_type: "cognito"
  } as any;

  it("should determine password grant type and fetch token", async () => {
    const provider = new CognitoAuthProvider(baseConfig);
    expect(provider.grantType).toBe("password");
    await provider.refreshToken();
    expect(provider.getAuthHeaders()).toEqual({ Authorization: "Bearer mock-token" });
  });

  it("should determine client_credentials grant type and fetch token", async () => {
    const ccConfig = { ...baseConfig, auth_cognito_client_secret: "secret", auth_cognito_domain: "domain.com" };
    const provider = new CognitoAuthProvider(ccConfig);
    expect(provider.grantType).toBe("client_credentials");
    await provider.refreshToken();
    expect(provider.getAuthHeaders()).toEqual({ Authorization: "Bearer mock-cc-token" });
  });
});
