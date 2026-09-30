# Observability for OpenAPI MCP Server

[← Back to main README](README.md)

This document describes the observability, monitoring, logging, and metrics architecture in OpenAPI MCP Server.

## Metrics System

The OpenAPI MCP Server includes an in-memory metrics store and an optional HTTP Prometheus metrics exporter.

### Configuration

| Variable | CLI Flag | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_PROMETHEUS` | `--enable-prometheus` | `false` | Enable Prometheus HTTP exporter |
| `PROMETHEUS_PORT` | `--prometheus-port <port>` | `9090` | Port for `/metrics` endpoint |
| `METRICS_MAX_HISTORY` | N/A | `100` | In-memory ring buffer size for recent calls |

### Tracked Telemetry

- **API Calls**:
  - Path, HTTP method, status code, duration in milliseconds.
  - Error messages and failure categories.
- **Tool Invocations**:
  - Tool name, execution duration, success boolean, and exceptions.
- **Error Rates**:
  - Global and per-endpoint error rates and recent error summaries.

### Prometheus Metrics

When Prometheus is enabled (`--enable-prometheus`):
- `openapi_mcp_api_calls_total{path, method, status}`: Counter for outbound API requests.
- `openapi_mcp_api_call_duration_seconds{path, method, status}`: Histogram for request latency.
- `openapi_mcp_tool_usage_total{tool, success}`: Counter for MCP tool executions.
- `openapi_mcp_tool_duration_seconds{tool}`: Histogram for tool execution latency.

### Startup & Shutdown Telemetry

- **Component Counts on Startup**:
  At startup, the server reports aggregated components:
  `Server components: 3 prompts, 10 tools, 2 resources, 0 resource templates`
- **Graceful Shutdown & Final Metrics**:
  Upon receiving `SIGINT` or `SIGTERM`, the server logs a summary snapshot:
  `Final metrics: {"api_calls":{"total":42,"errors":0,"error_rate":0,"paths":3},"tool_usage":{"total":42,"errors":0,"error_rate":0,"tools":3}}`
  `Process Interrupted, Shutting down gracefully...`

## Logging

Logging is controlled via `--log-level` (`debug`, `info`, `warn`, `error`):
- Bearer tokens and sensitive query parameters are masked.
- Structured JSON output is supported for container logging drivers.
