# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Main Goal
Fully recreate the Python MCP server in `docs/sot/openapi-mcp-server-SOT` natively in TypeScript.

## High-Level Architecture (Target)
The TypeScript implementation should mirror the architecture of the Python source-of-truth while leveraging standard Node.js/TypeScript idioms and the official `@modelcontextprotocol/sdk`. 
Key architectural components:
- **Server Entrypoint**: Configures and initializes the MCP Server using `McpServer` and `StdioServerTransport` from the official SDK. Parses CLI arguments to setup the server.
- **API / Config** (`src/api`): Environment variable mapping, routing configurations, and spec fetching logic.
- **Authentication** (`src/auth`): Pluggable auth methods supporting API Key, Bearer, Basic, and Cognito. Should implement a cache for auth tokens.
- **Prompts** (`src/prompts`): Dynamic generation of MCP prompts from the OpenAPI spec, including operation-specific prompts and general API documentation prompts.
- **Utils** (`src/utils`):
  - **OpenAPI**: Parsing and validating OpenAPI 3.x specifications (JSON/YAML).
  - **HTTP Client**: Resilience mechanisms (retries, timeouts) using a modern HTTP client, strictly fortified with SSRF protections (DNS pinning, IP allowlisting).
  - **Metrics & Caching**: Basic in-memory caching and Prometheus-compatible metrics tracking.
- **Route Patching**: Logic to map GET operations with query parameters into MCP TOOLS instead of RESOURCES.

## Development Commands
*(Note: Use these commands once the TypeScript project is bootstrapped)*
- **Install dependencies**: `npm install`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Run all tests**: `npm run test`
- **Run a single test**: `npm run test -- <path-to-test-file>`
- **Typecheck**: `npm run typecheck`

## Core Porting Context
- **SDK Usage**: Use `@modelcontextprotocol/sdk` (e.g., `McpServer`, `StdioServerTransport`). Do not use the legacy `Server` class unless absolutely necessary for advanced features not yet in `McpServer`.
- **Source of Truth**: The Python SOT (`docs/sot/openapi-mcp-server-SOT`) is the reference for correct behavior, metrics naming, authentication implementations, and SSRF security restrictions.
- Read `docs/sot/openapi-mcp-server-SOT/README.md` for specific functionality toggles like `--include-tags`, `--no-validate-output`, and multi-spec composition.
- Follow the global rules (SOLID principles, Object Calisthenics, fail-fast). Enforce small, modular TypeScript classes and functions.
