import { describe, expect, it } from "@jest/globals";
import { Config } from "../utils/config.js";
import { getTokenCache } from "./auth_cache.js";
import { BearerAuthProvider } from "./bearer_auth.js";
import { clearProviderCache, getAuthProvider } from "./auth_factory.js";

describe("credential isolation", () => {
  it("does not reuse a Cognito provider when client secrets differ", () => {
    clearProviderCache();
    const first = new Config({ authType: "cognito", authCognitoClientId: "client",
      authCognitoDomain: "domain", authCognitoClientSecret: "first-secret" });
    const second = new Config({ authType: "cognito", authCognitoClientId: "client",
      authCognitoDomain: "domain", authCognitoClientSecret: "second-secret" });
    expect(getAuthProvider(first)).not.toBe(getAuthProvider(second));
  });
  it("does not store raw bearer tokens as process-wide cache keys", () => {
    const secret = "credential-isolation-secret";
    getTokenCache().clear();
    const provider = new BearerAuthProvider(new Config({ authToken: secret }));
    expect(provider.getAuthHeaders()).toEqual({ Authorization: `Bearer ${secret}` });
    expect(getTokenCache().get(`bearer:${secret}`)).toBeUndefined();
  });
});
