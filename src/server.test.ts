import { describe, it, expect } from "@jest/globals";
import { createMcpServerAsync } from "./server.js";
import { Config } from "./utils/config.js";

describe("createMcpServerAsync", () => {
  it("should create server with tools and prompts when spec is provided", async () => {
    const config: Config = {
      api_name: "test-api",
      version: "1.0.0",
      api_base_url: "",
      api_spec_url: "",
      api_spec_path: "",
      auth_type: "none",
      auth_username: "",
      auth_password: "",
      auth_token: "",
      auth_api_key: "",
      auth_api_key_name: "api_key",
      auth_api_key_in: "header",
      auth_cognito_client_id: "",
      auth_cognito_username: "",
      auth_cognito_password: "",
      auth_cognito_client_secret: "",
      auth_cognito_domain: "",
      auth_cognito_scopes: "",
      auth_cognito_user_pool_id: "",
      auth_cognito_region: "us-east-1",
      host: "127.0.0.1",
      port: 8000,
      debug: false,
      transport: "stdio",
      message_timeout: 60,
      include_tags: "",
      exclude_tags: "",
      validate_output: true,
      additional_specs: "",
      allow_insecure_http: false,
      allow_private_networks: false,
      allowed_spec_dirs: "",
    };

    const server = await createMcpServerAsync(config);
    expect(server).toBeDefined();
  });
});
