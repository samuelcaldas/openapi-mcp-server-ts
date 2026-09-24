import { Config, loadConfig } from "./config.js";
import { validateConfig } from "./config_validator.js";

describe("Config and ConfigValidator", () => {
  it("creates default configuration with valid defaults", () => {
    const cfg = new Config();
    expect(cfg.transport).toBe("stdio");
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.port).toBe(8000);
    expect(cfg.inbound_auth_type).toBe("none");
    expect(cfg.delegation_mode).toBe("service");
  });

  it("normalizes CLI arguments and aliases correctly", () => {
    const cfg = loadConfig({
      spec: "https://api.example.com/openapi.json",
      host: "0.0.0.0",
      port: "9000",
      transport: "http",
      inboundAuthType: "bearer",
      inboundBearerToken: "secret-token",
    });
    expect(cfg.api_spec_url).toBe("https://api.example.com/openapi.json");
    expect(cfg.host).toBe("0.0.0.0");
    expect(cfg.port).toBe(9000);
    expect(cfg.transport).toBe("http");
    expect(cfg.inbound_auth_type).toBe("bearer");
    expect(cfg.inbound_bearer_token).toBe("secret-token");
  });

  it("rejects discontinued transport 'sse' with migration message", () => {
    const cfg = new Config({ transport: "sse", apiBaseUrl: "https://api.example.com" });
    expect(() => validateConfig(cfg)).toThrow(
      "Transport 'sse' has been discontinued. Please use '--transport http' which provides the Streamable HTTP transport at /mcp."
    );
  });

  it("rejects unknown transport", () => {
    const cfg = new Config({ transport: "websocket", apiBaseUrl: "https://api.example.com" });
    expect(() => validateConfig(cfg)).toThrow("Invalid transport 'websocket'. Supported transports are 'stdio' and 'http'.");
  });

  it("rejects invalid port numbers", () => {
    const cfg = new Config({ port: 70000, apiBaseUrl: "https://api.example.com" });
    expect(() => validateConfig(cfg)).toThrow("Invalid port: 70000");
  });

  it("rejects missing spec location", () => {
    const cfg = new Config({ apiBaseUrl: "" });
    cfg.api_base_url = "";
    expect(() => validateConfig(cfg)).toThrow("Must provide either --spec-url, --spec-path, or API_BASE_URL");
  });

  it("rejects inbound auth none on non-loopback host", () => {
    const cfg = new Config({
      transport: "http",
      host: "0.0.0.0",
      inboundAuthType: "none",
      apiBaseUrl: "https://api.example.com",
    });
    expect(() => validateConfig(cfg)).toThrow("Inbound authentication 'none' is forbidden on non-loopback host '0.0.0.0'.");
  });

  it("rejects bearer auth without token or token file", () => {
    const cfg = new Config({
      transport: "http",
      host: "127.0.0.1",
      inboundAuthType: "bearer",
      apiBaseUrl: "https://api.example.com",
    });
    expect(() => validateConfig(cfg)).toThrow("Inbound bearer authentication requires INBOUND_BEARER_TOKEN or INBOUND_BEARER_TOKEN_FILE.");
  });

  it("rejects oauth without issuer URL", () => {
    const cfg = new Config({
      transport: "http",
      host: "127.0.0.1",
      inboundAuthType: "oauth",
      inboundOauthAudience: "https://mcp.example.com/mcp",
      apiBaseUrl: "https://api.example.com",
    });
    expect(() => validateConfig(cfg)).toThrow("Inbound OAuth authentication requires INBOUND_OAUTH_ISSUER_URL.");
  });

  it("rejects non-HTTPS remote OAuth resource server URL", () => {
    const cfg = new Config({
      transport: "http",
      host: "0.0.0.0",
      inboundAuthType: "oauth",
      inboundOauthIssuerUrl: "https://auth.example.com",
      inboundOauthResourceServerUrl: "http://insecure.example.com/mcp",
      apiBaseUrl: "https://api.example.com",
    });
    expect(() => validateConfig(cfg)).toThrow("Remote OAuth resource server URL must use HTTPS");
  });

  it("rejects user delegation on stdio transport", () => {
    const cfg = new Config({
      transport: "stdio",
      delegationMode: "user",
      inboundAuthType: "oauth",
      inboundOauthIssuerUrl: "https://auth.example.com",
      inboundOauthAudience: "https://mcp.example.com/mcp",
      tokenExchangeUrl: "https://auth.example.com/oauth/token",
      tokenExchangeAudience: "https://api.example.com",
      apiBaseUrl: "https://api.example.com",
    });
    expect(() => validateConfig(cfg)).toThrow("Delegation mode 'user' is not supported on stdio transport.");
  });

  it("rejects user delegation with bearer inbound auth", () => {
    const cfg = new Config({
      transport: "http",
      host: "127.0.0.1",
      delegationMode: "user",
      inboundAuthType: "bearer",
      inboundBearerToken: "secret",
      tokenExchangeUrl: "https://auth.example.com/oauth/token",
      tokenExchangeAudience: "https://api.example.com",
      apiBaseUrl: "https://api.example.com",
    });
    expect(() => validateConfig(cfg)).toThrow("Delegation mode 'user' requires inbound OAuth authentication.");
  });

  it("passes validation for valid stdio config", () => {
    const cfg = new Config({ apiBaseUrl: "https://api.example.com" });
    expect(() => validateConfig(cfg)).not.toThrow();
  });
});
