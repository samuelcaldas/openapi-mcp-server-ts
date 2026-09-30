# Deployment Guide for OpenAPI MCP Server

[← Back to main README](README.md)

This document provides deployment guidelines and operational instructions for running OpenAPI MCP Server in production.

## Deployment Modes

### 1. Stdio Mode (CLI / Desktop Clients)

Ideal for desktop MCP clients like Claude Desktop, Cursor, or Cline.

```json
{
  "mcpServers": {
    "my-api": {
      "command": "node",
      "args": [
        "/path/to/openapi-mcp-server/dist/cli.js",
        "--api-name", "my-api",
        "--api-url", "https://api.example.com",
        "--spec-url", "https://api.example.com/openapi.json"
      ]
    }
  }
}
```

### 2. Streamable HTTP Mode (Remote / Microservice)

For multi-tenant or containerized environments. Exposes `/mcp` and `/sse` endpoints.

```bash
node dist/cli.js \
  --transport http \
  --host 0.0.0.0 \
  --port 8080 \
  --api-name "my-service" \
  --api-url "https://api.example.com" \
  --spec-path "/app/specs/openapi.json" \
  --inbound-auth-type bearer \
  --trust-proxy 10.250.50.60
```

## Docker Container Deployment

### Building the Image

```bash
docker build -t openapi-mcp-server:latest .
```

### Running with Docker Compose

```yaml
version: "3.8"

services:
  openapi-mcp-server:
    image: openapi-mcp-server:latest
    container_name: openapi-mcp-server
    environment:
      - NODE_ENV=production
      - TZ=America/Sao_Paulo
      - TRANSPORT=http
      - HOST=0.0.0.0
      - PORT=8080
      - API_NAME=petstore
      - API_BASE_URL=https://petstore.swagger.io/v2
      - API_SPEC_URL=https://petstore.swagger.io/v2/swagger.json
      - INBOUND_AUTH_TYPE=bearer
      - ENABLE_PROMETHEUS=true
      - PROMETHEUS_PORT=9090
    ports:
      - "8080:8080"
      - "9090:9090"
    healthcheck:
      test: ["CMD", "/usr/local/bin/docker-healthcheck.sh"]
      interval: 60s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

## Reverse Proxy Configuration (Nginx / Nginx Proxy Manager)

When running behind NPM or Nginx:
- Use `--trust-proxy` or set `TRUST_PROXY=true` (or the proxy IP, e.g. `10.250.50.60`).
- Ensure `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host` headers are forwarded.
- For Streamable HTTP SSE streams, disable proxy response buffering:
  ```nginx
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 86400s;
  ```
