# Plan: TypeScript Recreation of OpenAPI MCP Server

## Context
The goal is to fully recreate the Python-based OpenAPI MCP server (located in `docs/sot/openapi-mcp-server-SOT`) natively in TypeScript. The new TypeScript implementation will mirror the architecture of the Python source-of-truth while leveraging standard Node.js/TypeScript idioms and the official `@modelcontextprotocol/sdk`. This provides a more robust, statically-typed version of the OpenAPI MCP server that can easily integrate with Node-based tools and clients.

## Recommended Approach

1. **Bootstrap the TypeScript Project**
   - Initialize a new `package.json`.
   - Install essential dependencies: `@modelcontextprotocol/sdk`, `zod`, `axios` (or `node-fetch` for HTTP client), `commander` (for CLI args), `swagger-parser` or `@apidevtools/swagger-parser` (for parsing OpenAPI specs), `winston` (for logging), and caching/metrics utilities.
   - Install dev dependencies: `typescript`, `@types/node`, `jest`, `ts-jest`, `eslint`, `prettier`.
   - Setup `tsconfig.json`, `.eslintrc`, and `jest.config.js`.
   - Add scripts to `package.json` for `build`, `lint`, `test`, `typecheck`, and `validate` (which runs lint, typecheck, and test).

2. **Implement Core Architectural Components**
   - **`src/utils/openapi.ts`**: Logic to fetch, parse, and validate OpenAPI 3.x specifications (JSON/YAML), including `$ref` resolution.
   - **`src/utils/httpClient.ts`**: Modern HTTP client with resilience mechanisms (retries, timeouts) and SSRF protections (DNS pinning, private/reserved IP allowlisting).
   - **`src/utils/metrics.ts` & `src/utils/cache.ts`**: Prometheus-compatible metrics tracking and basic in-memory caching.
   - **`src/auth/index.ts`**: Pluggable auth system supporting API Key, Bearer, Basic, and Cognito, with a cache for auth tokens.
   - **`src/api/config.ts`**: Environment variable mapping, routing configurations, and logic to map OpenAPI operations (especially GET with query parameters) into MCP Tools rather than Resources.
   - **`src/prompts/index.ts`**: Dynamic generation of MCP prompts from the OpenAPI spec, summarizing the API and describing specific endpoints.

3. **Implement Server Entrypoint & Tool Registration**
   - **`src/index.ts`**: Configure and initialize the MCP Server using `McpServer` and `StdioServerTransport` from `@modelcontextprotocol/sdk`.
   - Parse CLI arguments (e.g., `--spec`, `--name`, `--auth-type`, `--ssrf-protect`) using `commander`.
   - Loop through the parsed OpenAPI operations and register each as a tool using `server.tool()`, generating Zod schemas for the inputs based on the OpenAPI parameters.
   - Set up the execution handler to call `httpClient.ts` with the appropriate path, method, headers (from auth), and body/query parameters.

4. **Testing and Validation**
   - Write unit tests for the OpenAPI parser, HTTP client SSRF protections, auth token caching, and tool schema generation.
   - Run `npm run validate` to ensure everything passes typechecking, linting, and testing.

## Critical Files to Modify/Create
- `package.json` & `tsconfig.json`
- `src/index.ts` (CLI and Server Entrypoint)
- `src/utils/openapi.ts`
- `src/utils/httpClient.ts`
- `src/auth/index.ts`
- `src/api/config.ts`
- `src/prompts/index.ts`

## Verification
- Run `npm run build` to verify successful compilation.
- Run `npm run lint` and `npm run typecheck` to ensure code quality.
- Run `npm run test` to execute the unit test suite and verify SSRF protection and OpenAPI parsing correctness.
- Test the built server manually using `@modelcontextprotocol/inspector` (e.g., `npx @modelcontextprotocol/inspector node dist/index.js --spec <path_to_spec>`) to ensure tools and prompts are correctly registered and executable.