# Changelog

All notable changes to the TypeScript / Node.js implementation of `openapi-mcp-server` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-30

### Parity Milestone: Full Feature Parity with Python SOT (awslabs/openapi-mcp-server)

#### Added
- **Streamable HTTP & Stdio Transports**: Support for both desktop stdio clients and enterprise Streamable HTTP (`/mcp`, `/sse`) deployments using `@modelcontextprotocol/sdk`.
- **SSRF Protection & DNS Pinning**: Strict DNS pre-resolution, IP address pinning, private network filtering (RFC 1918, loopback, link-local, AWS IMDS `169.254.169.254`), and 10 MiB payload limits.
- **Hierarchical Error Architecture**: Comprehensive typed exception hierarchy (`APIError`, `AuthenticationError`, `AuthorizationError`, `ResourceNotFoundError`, `ValidationError`, `RateLimitError`, `ServerError`, `ConnectionError`, `NetworkError`) with backwards-compatible `StructuredError`.
- **Troubleshooting Hints & JWT Expiration Inspection**: Automated inspection of Bearer JWT tokens on HTTP 401 with warning logs indicating seconds elapsed since expiration, along with actionable troubleshooting tips on 401 and 403 errors.
- **OpenAPI Analysis & Pagination Discovery**: Implementation of `findPaginationEndpoints(spec)` and `extractApiStructure(spec)` matching Python SOT heuristics.
- **HTTP Connection Pooling**: Integration of persistent `http.Agent` and `https.Agent` connection pools with configurable `HTTP_MAX_CONNECTIONS` (default: 100) and `HTTP_MAX_KEEPALIVE` (default: 20) in `createHttpClient` and `HttpClientFactory`.
- **Startup Component Counts & Shutdown Telemetry**: Consolidated startup component logging (`Server components: ... prompts, ... tools, ... resources, ... resource templates`) and graceful `SIGINT`/`SIGTERM` handling logging final metrics (`Final metrics: ...`).
- **Health Check Tool & In-Memory App UI**: Built-in `health_check` MCP tool, Prometheus metrics exporter on port 9090, and web dashboard bundle in `dist-app`.
- **Docker Multi-Stage Build**: Node.js 22 LTS Alpine multi-stage `Dockerfile` with non-root user `node`, `docker-healthcheck.sh`, and `TZ=America/Sao_Paulo`.
- **Documentation Suite**: Dedicated documentation for `AUTHENTICATION.md`, `DEPLOYMENT.md`, `OBSERVABILITY.md`, and `AWS_BEST_PRACTICES.md`.
