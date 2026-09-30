# OpenAPI MCP Server

A TypeScript Model Context Protocol (MCP) server that dynamically bridges OpenAPI 3.x specifications (JSON or YAML) into MCP tools and resources for Large Language Models.

This project recreates the upstream [AWS Labs OpenAPI MCP Server](https://awslabs.github.io/mcp/servers/openapi-mcp-server) natively in TypeScript using the official `@modelcontextprotocol/sdk`, with Streamable HTTP transport, inbound OAuth 2.1 / Bearer security, RFC 8693 user identity delegation, interactive MCP App UI, and MCPB bundling.

## Features

- **Standard Transports**: Supports both local `stdio` (default, for desktop agents like Claude Desktop) and remote Streamable HTTP (`POST /mcp` in stateless mode).
- **Dynamic Tool & Resource Generation**: Automatically parses OpenAPI 3.x specs (JSON/YAML) and exposes operations as MCP tools and resources.
- **Intelligent Route Mapping**: Maps GET endpoints with query parameters to executable MCP Tools (instead of passive resources), allowing LLMs to perform filtered searches and parameterized queries.
- **Inbound Authentication & OAuth 2.1**: Protects remote `POST /mcp` endpoints via `bearer` (constant-time verification) or `oauth` (JWT/JWKS verification), advertising RFC 9728 Protected Resource Metadata at `/.well-known/oauth-protected-resource/mcp`.
- **User Identity Delegation (RFC 8693)**: Preserves individual caller identity to target APIs via OAuth 2.0 Token Exchange (`DELEGATION_MODE=user`), failing closed without token passthrough or accidental fallback to shared credentials.
- **Pluggable Outbound Auth**: Supports API Key, Bearer Token, HTTP Basic, and AWS Cognito user pool / OAuth2 client credentials flows with in-memory token caching.
- **Fortified SSRF Protections**: Custom resilient HTTP client featuring DNS pinning (mitigating TOCTOU DNS rebinding) and IP allowlisting/blocklisting (rejecting loopback, private RFC 1918 subnets, and cloud metadata endpoints).
- **Dynamic Prompts**: Generates operation-specific and API overview prompts with token-efficient schema compaction.
- **MCP App & MCPB Support**: Bundled with an interactive MCP App interface (built with Vite singlefile) and packaged `.mcpb` bundle.
- **Python Source of Truth Included**: The reference Python implementation is preserved under `docs/sot/openapi-mcp-server-SOT/`.

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x

## Quick Start (CLI / npx)

### Stdio Transport (Local / Claude Desktop)

```bash
# Run directly via npx
npx openapi-mcp-server --spec https://api.example.com/openapi.json --api-url https://api.example.com/v1

# Or with a local specification file
npx openapi-mcp-server --spec-path ./openapi.yaml --api-url https://api.example.com/v1
```

### Streamable HTTP Transport (Remote Server)

```bash
# Run HTTP server with constant-time Bearer authentication
INBOUND_BEARER_TOKEN="your-secure-token" \
npx openapi-mcp-server \
  --transport http \
  --host 127.0.0.1 \
  --port 8000 \
  --inbound-auth-type bearer \
  --spec https://api.example.com/openapi.json \
  --api-url https://api.example.com/v1
```

> **Migration Notice**: The legacy SSE transport (`/sse` and `/message`) has been discontinued. Please use `--transport http`, which mounts the standard MCP Streamable HTTP transport at `POST /mcp`.

For advanced configurations (OAuth 2.1, RFC 8693 Token Exchange, Nginx Proxy Manager integration), see [docs/streamable-http.md](docs/streamable-http.md) and [.env.example](.env.example).

## Embed the SDK in an existing MCP server

Importing the package root does not start the CLI or install signal handlers. Your host owns its transport and inbound authentication:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prepare_openapi_integration } from "openapi-mcp-server";

const server = new McpServer({ name: "my-host", version: "1.0.0" });
const integration = await prepare_openapi_integration({
    source: "./openapi.yaml",
    base_url: "https://api.example.com/v1",
});
integration.register_tools(server, { prefix: "api" });

const result = await integration.execute_operation("getItem", { id: "123" });
console.log(result.status, result.data);
```

Use a distinct prefix for each integration registered on the same MCP server. SDK registration adds tools only; the standalone CLI adds prompts and the optional UI. See [the SDK guide](docs/sdk-integration.md) for multiple specifications, validation, credentials, and network policy.

## Development

```bash
# Install dependencies
npm install

# Build UI bundle and TypeScript
npm run build

# Run tests
npm test

# Run full validation (lint + typecheck + test)
npm run validate
```

## Upstream Reference

- Upstream Documentation: [awslabs.github.io/mcp/servers/openapi-mcp-server](https://awslabs.github.io/mcp/servers/openapi-mcp-server)
- Reference Source of Truth: `docs/sot/openapi-mcp-server-SOT`
