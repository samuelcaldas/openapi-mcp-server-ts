# Implementation Plan: Full TypeScript Port of OpenAPI MCP Server

## Context
Recreate the Python MCP server (`docs/sot/openapi-mcp-server-SOT`) natively in TypeScript using `@modelcontextprotocol/sdk`. The TypeScript implementation mirrors the SOT architecture, CLI flags, configuration mapping, pluggable authentication (Bearer, Basic, API Key, Cognito with caching), SSRF protections (IP/URL validation, DNS pinning), OpenAPI parsing, route patching, operation prompts, and metrics, while strictly adhering to code standards (Object Calisthenics, SOLID, fail-fast, zero compiler/test errors). Per user decision, focus is scoped to CLI & Server.

## Key Changes & Architecture

### 1. Fix Jest & Test Configuration
- Update `jest.config.js` to properly support ESM and jest globals (`@types/jest`).
- Fix `src/auth/cognito_auth.test.ts` to use `import { jest } from "@jest/globals"` for ESM compatibility.
- Fix `src/tools/index.test.ts` schema expectation for Zod enums (`_def.values` or `options`).

### 2. Configuration & CLI Parity (`src/utils/config.ts`, `src/index.ts`)
- Mirror all Python SOT config properties and environment variables:
  - API configuration: `api_name`, `api_base_url`, `api_spec_url`, `api_spec_path`
  - Authentication: `auth_type`, `auth_username`, `auth_password`, `auth_token`, `auth_api_key`, `auth_api_key_name`, `auth_api_key_in`
  - Cognito: `auth_cognito_client_id`, `auth_cognito_username`, `auth_cognito_password`, `auth_cognito_client_secret`, `auth_cognito_domain`, `auth_cognito_scopes`, `auth_cognito_user_pool_id`, `auth_cognito_region`
  - Tag filtering: `include_tags`, `exclude_tags`
  - Security: `allow_insecure_http`, `allow_private_networks`, `allowed_spec_dirs`
  - Output validation: `validate_output` (`--no-validate-output`)
  - Multi-spec: `additional_specs`
- Ensure CLI options in `src/index.ts` accept both snake-case and kebab-case variants matching the SOT.

### 3. Server Architecture (`src/server.ts`)
- Implement `createMcpServerAsync(config: Config): Promise<McpServer>` cleanly:
  - Validate base URL and primary spec location early (fail-fast).
  - Load and parse primary OpenAPI spec with SSRF & directory traversal checks.
  - Setup authenticated HTTP client with DNS pinning and token caching.
  - Register MCP tools from OpenAPI operations, respecting include/exclude tags.
  - Register route patching (mapping GET operations with query parameters into MCP tools).
  - Register prompts via prompt generator (operation prompts and API overview prompt).
  - Process `additional_specs` safely without breaking the server on partial spec failure.

### 4. Authentication Module (`src/auth/*`)
- Ensure all auth providers implement `AuthProvider`:
  - `ApiKeyAuthProvider` (header, query, cookie)
  - `BasicAuthProvider`
  - `BearerAuthProvider`
  - `CognitoAuthProvider` (OAuth2 client credentials and SRP/password grants with cache)
  - `AuthCache` with TTL handling
  - `AuthFactory` to resolve providers based on `auth_type`

### 5. Utilities & Security (`src/utils/*`)
- `httpClient.ts`: Axios/Fetch wrapper enforcing timeout, retries, and strict SSRF protections (IP pinning, blocking loopback/private/link-local/cloud metadata unless explicitly allowed).
- `url_validator.ts`: Comprehensive IP and hostname validation matching Python `url_validator.py`.
- `openapi_validator.ts`: OpenAPI schema validation.
- `metrics.ts`: Prometheus-compatible metrics provider mirroring Python metrics names and counts.
- `cache_provider.ts`: In-memory caching for specs and HTTP responses.

### 6. Tools & Prompts (`src/tools/*`, `src/prompts/*`)
- Tool generation: map operations into McpServer tools with schema parsing via Zod.
- Output validation against response schemas when `validate_output` is enabled.
- Prompt generation: dynamic prompts for operations and general API documentation matching Python prompt generator.

## Verification
1. Run `npm run typecheck` (zero TypeScript errors).
2. Run `npm run lint` (clean linting).
3. Run `npm run test` (all unit and integration tests passing).
4. Build dist with `npm run build`.
5. Execute end-to-end smoke test against a sample OpenAPI spec via stdio.
