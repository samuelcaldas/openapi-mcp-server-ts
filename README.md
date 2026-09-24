# OpenAPI MCP Server

A TypeScript Model Context Protocol (MCP) server that dynamically bridges OpenAPI 3.x specifications (JSON or YAML) into MCP tools and resources for Large Language Models.

This project recreates the upstream [AWS Labs OpenAPI MCP Server](https://awslabs.github.io/mcp/servers/openapi-mcp-server) natively in TypeScript using the official `@modelcontextprotocol/sdk`, with added MCP App interactive UI support and MCPB bundling.

## Features

- **Dynamic Tool & Resource Generation**: Automatically parses OpenAPI 3.x specs (JSON/YAML) and exposes operations as MCP tools and resources.
- **Intelligent Route Mapping**: Maps GET endpoints with query parameters to executable MCP Tools (instead of passive resources), allowing LLMs to perform filtered searches and parameterized queries.
- **Pluggable Authentication**: Supports API Key, Bearer Token (with refresh), HTTP Basic, and AWS Cognito user pool / OAuth2 client credentials flows, backed by in-memory token caching.
- **Fortified SSRF Protections**: Custom resilient HTTP client featuring DNS pinning (mitigating TOCTOU DNS rebinding) and IP allowlisting/blocklisting (rejecting loopback, private RFC 1918 subnets, and cloud metadata endpoints).
- **Dynamic Prompts**: Generates operation-specific and API overview prompts with token-efficient schema compaction.
- **MCP App & MCPB Support**: Bundled with an interactive MCP App interface (built with Vite singlefile) and packaged `.mcpb` bundle.
- **Python Source of Truth Included**: The reference Python implementation is preserved under `docs/sot/openapi-mcp-server-SOT/`.

## Prerequisites

- Node.js >= 20.x
- npm >= 10.x

## Getting Started

### Installation

```bash
npm install
```

### Build & Validate

```bash
# Build TypeScript to dist/
npm run build

# Run linting, typechecking, and tests
npm run validate
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov
```

## Upstream Reference

- Upstream Documentation: [awslabs.github.io/mcp/servers/openapi-mcp-server](https://awslabs.github.io/mcp/servers/openapi-mcp-server)
- Reference Source of Truth: `docs/sot/openapi-mcp-server-SOT`
