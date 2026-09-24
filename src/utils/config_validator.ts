import { Config } from "./config.js";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function validateConfig(configuration: Config): void {
  validateTransport(configuration.transport);
  validateHostAndPort(configuration.host, configuration.port);
  validateSpecLocation(configuration);
  validateInboundAuth(configuration);
  validateDelegation(configuration);
}

function validateTransport(transport: string): void {
  const normalized = transport.trim().toLowerCase();
  if (normalized === "sse") {
    throw new Error(
      "Transport 'sse' has been discontinued. Please use '--transport http' which provides the Streamable HTTP transport at /mcp."
    );
  }
  if (!["stdio", "http"].includes(normalized)) {
    throw new Error(`Invalid transport '${transport}'. Supported transports are 'stdio' and 'http'.`);
  }
}

function validateHostAndPort(host: string, port: number): void {
  if (!host || host.trim().length === 0) {
    throw new Error("Host cannot be empty.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${port}. Must be an integer between 1 and 65535.`);
  }
}

function validateSpecLocation(configuration: Config): void {
  const hasPrimary = Boolean(configuration.api_spec_url || configuration.api_spec_path || configuration.api_base_url);
  const hasAdditional = Boolean(configuration.additional_specs);
  if (!hasPrimary && !hasAdditional) {
    throw new Error("Must provide either --spec-url, --spec-path, or API_BASE_URL environment variable.");
  }
}

function validateInboundAuth(configuration: Config): void {
  const authType = configuration.inbound_auth_type.trim().toLowerCase();
  if (!["none", "oauth", "bearer"].includes(authType)) {
    throw new Error(`Invalid inbound authentication type '${configuration.inbound_auth_type}'.`);
  }
  if (configuration.transport !== "http") return;

  const isLoopback = LOOPBACK_HOSTS.has(configuration.host.toLowerCase());
  if (!isLoopback && authType === "none") {
    throw new Error(
      `Inbound authentication 'none' is forbidden on non-loopback host '${configuration.host}'. Configure OAuth or Bearer inbound authentication.`
    );
  }
  if (authType === "bearer") validateBearerConfig(configuration);
  if (authType === "oauth") validateOAuthConfig(configuration, isLoopback);
}

function validateBearerConfig(configuration: Config): void {
  const hasSecret = Boolean(configuration.inbound_bearer_token || configuration.inbound_bearer_token_file);
  if (!hasSecret) {
    throw new Error("Inbound bearer authentication requires INBOUND_BEARER_TOKEN or INBOUND_BEARER_TOKEN_FILE.");
  }
}

function validateOAuthConfig(configuration: Config, isLoopback: boolean): void {
  if (!configuration.inbound_oauth_issuer_url) {
    throw new Error("Inbound OAuth authentication requires INBOUND_OAUTH_ISSUER_URL.");
  }
  const hasTarget = Boolean(configuration.inbound_oauth_audience || configuration.inbound_oauth_resource_server_url);
  if (!hasTarget) {
    throw new Error("Inbound OAuth authentication requires INBOUND_OAUTH_AUDIENCE or INBOUND_OAUTH_RESOURCE_SERVER_URL.");
  }
  const resourceUrl = configuration.inbound_oauth_resource_server_url;
  if (!isLoopback && resourceUrl && !resourceUrl.startsWith("https://")) {
    throw new Error(`Remote OAuth resource server URL must use HTTPS: ${resourceUrl}`);
  }
}

function validateDelegation(configuration: Config): void {
  const mode = configuration.delegation_mode.trim().toLowerCase();
  if (!["service", "user"].includes(mode)) {
    throw new Error(`Invalid delegation mode: '${configuration.delegation_mode}'. Supported modes are 'service' and 'user'.`);
  }
  if (mode !== "user") return;

  if (configuration.transport === "stdio") {
    throw new Error("Delegation mode 'user' is not supported on stdio transport. Stdio only supports 'service' delegation.");
  }
  if (configuration.inbound_auth_type !== "oauth") {
    throw new Error("Delegation mode 'user' requires inbound OAuth authentication. Bearer and none cannot identify individual users.");
  }
  if (!configuration.token_exchange_url) {
    throw new Error("Delegation mode 'user' requires TOKEN_EXCHANGE_URL.");
  }
  if (!configuration.token_exchange_audience) {
    throw new Error("Delegation mode 'user' requires TOKEN_EXCHANGE_AUDIENCE.");
  }
}
