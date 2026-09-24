import { describe, it, expect } from "@jest/globals";
import {
  createMcpServerAsync,
  prepareServerEnvironment,
  createServerInstance,
} from "./server.js";
import { Config } from "./utils/config.js";
import { ServiceCredentialProvider, UserDelegationCredentialProvider } from "./auth/token_exchange.js";

describe("Server Environment and Instance Lifecycle", () => {
  it("should create server with tools and prompts when spec is provided", async () => {
    const config = new Config({ apiName: "test-api", allowPrivateNetworks: true });
    const server = await createMcpServerAsync(config);
    expect(server).toBeDefined();
  });

  it("prepares environment once and creates independent McpServer instances", async () => {
    const config = new Config({ apiName: "test-api", allowPrivateNetworks: true });
    const environment = await prepareServerEnvironment(config);

    expect(environment).toBeDefined();
    expect(environment.specs).toBeDefined();
    expect(environment.credentialProvider).toBeInstanceOf(ServiceCredentialProvider);

    const instance1 = createServerInstance(environment);
    const instance2 = createServerInstance(environment);

    expect(instance1).not.toBe(instance2);
    expect((instance1 as any).server).toBeDefined();
    expect((instance2 as any).server).toBeDefined();
  });

  it("creates UserDelegationCredentialProvider when delegation mode is user", async () => {
    const config = new Config({
      apiName: "test-api",
      allowPrivateNetworks: true,
      delegationMode: "user",
      inboundAuthType: "oauth",
      tokenExchangeUrl: "http://127.0.0.1:8080/oauth/token",
      tokenExchangeAudience: "https://api.example.com",
    });

    const environment = await prepareServerEnvironment(config);
    expect(environment.credentialProvider).toBeInstanceOf(UserDelegationCredentialProvider);
  });
});
