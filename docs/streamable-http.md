# Streamable HTTP Operational Guide

This document describes the architecture, configuration, security hardening, and operational procedures for deploying `openapi-mcp-server` over Streamable HTTP and stdio.

---

## Embedded SDK and standalone server

To add only OpenAPI tools to an existing `McpServer`, use the side-effect-free package root described in [SDK integration](sdk-integration.md). The embedding host owns inbound authentication and transport lifecycle; `context.auth_info` for direct calls or `extra.authInfo` for registered tools must come from a validated host identity. The standalone CLI continues to provide stdio, remote Streamable HTTP, prompts, and the optional UI.

Remote standalone listeners reject unauthenticated non-loopback binding and require explicit `ALLOWED_HOSTS`, `ALLOWED_ORIGINS`, and specific `TRUST_PROXY` addresses. Requests without an Origin header (for example, non-browser MCP clients) are allowed; supplied Origins must match the allowlist. Terminate TLS at a trusted reverse proxy, restrict direct access, and never configure `TRUST_PROXY=true` or wildcard allowlists.

## 1. Architecture Overview

`openapi-mcp-server` supports two primary transports:
- **`stdio`**: For local CLI usage, desktop agents (e.g., Claude Desktop), and local process orchestration.
- **`http` (Streamable HTTP)**: For remote deployments, multi-tenant services, and reverse proxy architectures.

### Discontinuation of Legacy SSE

The legacy SSE transport (`/sse` and `/message`) has been discontinued. The server now implements the modern MCP Streamable HTTP transport at `POST /mcp` in stateless mode (`sessionIdGenerator: undefined`).
- **Endpoint**: Single endpoint at `POST /mcp`.
- **Stateless Operation**: Each HTTP request connects a dedicated, isolated `McpServer` and transport instance, which is cleaned up immediately upon response completion or client disconnection.
- **HTTP 405 Method Not Allowed**: Requests using `GET` or `DELETE` on `/mcp` return HTTP status `405` with `Allow: POST`.

---

## 2. Inbound Authentication Modes

When running with `--transport http`, inbound authentication is configured via `INBOUND_AUTH_TYPE` (or `--inbound-auth-type`). Three mutually exclusive modes are supported:

| Mode | Allowed Hosts | Description | Secret Provisioning |
|---|---|---|---|
| `none` | Loopback only (`127.0.0.1`, `localhost`, `::1`) | No authentication required. Strictly forbidden on external or non-loopback interfaces. | None |
| `bearer` | Any | Constant-time token verification (`crypto.timingSafeEqual`). | Environment (`INBOUND_BEARER_TOKEN`) or Secret File (`INBOUND_BEARER_TOKEN_FILE`). Never via CLI flags. |
| `oauth` | Any | OAuth 2.1 JWT signature, issuer, audience, and scope verification via JWKS. | Remote JWKS endpoint (`INBOUND_OAUTH_ISSUER_URL` or `INBOUND_OAUTH_JWKS_URI`). |

### RFC 9728 Protected Resource Metadata

When `INBOUND_AUTH_TYPE=oauth` or `INBOUND_OAUTH_ISSUER_URL` is set, the server automatically exposes the standard OAuth Protected Resource Metadata at:
- `GET /.well-known/oauth-protected-resource/mcp`
- `GET /.well-known/oauth-protected-resource`

Unauthenticated `POST /mcp` requests receive an HTTP `401 Unauthorized` response with a `WWW-Authenticate: Bearer ...` challenge referencing the resource metadata URL.

---

## 3. Delegation Modes (Outbound API Identity)

The server controls how outbound requests to destination OpenAPI targets are authenticated via `DELEGATION_MODE`:

### Service Mode (`DELEGATION_MODE=service`)
- Outbound requests use shared service credentials configured via `AUTH_TYPE` (`bearer`, `basic`, `apikey`, `cognito`).
- Standard mode for `stdio` transport and fixed inbound `bearer` tokens.

### User Mode (`DELEGATION_MODE=user` - RFC 8693 Token Exchange)
- Outbound requests preserve individual user identity without token passthrough.
- The server takes the validated inbound user token (scoped to the MCP resource) and performs an RFC 8693 OAuth 2.0 Token Exchange (`grant_type=urn:ietf:params:oauth:grant-type:token-exchange`) against the designated authorization server.
- **Fail-Closed**: If the user token is missing, expired, or the token exchange fails, the request fails immediately with an error. It **never** falls back to shared service credentials.
- **Header Protection**: The delegated `Authorization: Bearer <exchanged-token>` header cannot be overridden by parameters defined in the OpenAPI specification.
- **Target URL Validation**: The token exchange endpoint is strictly validated using SSRF protections (DNS pinning and private network restrictions).

---

## 4. Reverse Proxy & Security Hardening (Nginx Proxy Manager)

In production environments (e.g. `docker-vm` / `10.250.50.165` behind Nginx Proxy Manager on `fs01002` / `10.250.50.60`):

### 4.1 Manual Nginx Proxy Manager (NPM) Configuration
> **Note**: Do not automate or interact programmatically with NPM. Apply these settings manually in the NPM Web UI.

1. **Proxy Host Details**:
   - **Domain Names**: e.g., `mcp.dev.timoteo.mg.gov.br`
   - **Scheme**: `http` (internal container / host)
   - **Forward Host / IP**: `10.250.50.165` (or Docker container name if on same network)
   - **Forward Port**: Port where `openapi-mcp-server` is listening (e.g. `8000`)
   - **Block Common Exploits**: Enabled
   - **Websockets Support**: Enabled (for streaming connections)

2. **SSL / TLS**:
   - Enable SSL certificate (Let's Encrypt or Wildcard `*.dev.timoteo.mg.gov.br`).
   - Force SSL: **Enabled**
   - HTTP/2 Support: **Enabled**
   - HSTS Enabled: **Enabled**

3. **Advanced Nginx Directives**:
   In the "Advanced" tab of the Proxy Host in NPM, ensure standard headers are forwarded:
   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header Origin $http_origin;
   
   # Disable buffering for chunked streaming responses
   proxy_buffering off;
   proxy_cache off;
   proxy_read_timeout 300s;
   ```

4. **Direct Access Blocking**:
   - Ensure the server is bound to an internal Docker network or local interface, not directly accessible from the public internet.
   - Use firewall rules (`iptables` / `ufw`) to restrict ingress on the server port to only the NPM server IP (`10.250.50.60`).

### 4.2 Application Header Allowlisting
Configure the server environment to reject untrusted Hosts or Origins:
```env
TRUST_PROXY=10.250.50.60
ALLOWED_HOSTS=mcp.dev.timoteo.mg.gov.br,localhost
ALLOWED_ORIGINS=https://claude.ai,https://mcp.dev.timoteo.mg.gov.br
```

---

## 5. Usage Examples

### 5.1 Local CLI / Desktop via stdio
```bash
# Using npx or installed global CLI
npx openapi-mcp-server --spec https://api.example.com/openapi.json --api-url https://api.example.com/v1

# With local file spec
openapi-mcp-server --spec-path ./openapi.yaml --api-url https://api.example.com/v1
```

### 5.2 Streamable HTTP Server with Bearer Auth
```bash
INBOUND_BEARER_TOKEN="super-secret-token" \
openapi-mcp-server \
  --transport http \
  --host 127.0.0.1 \
  --port 8000 \
  --inbound-auth-type bearer \
  --spec https://api.example.com/openapi.json \
  --api-url https://api.example.com/v1
```

### 5.3 Streamable HTTP with OAuth & User Delegation
```bash
export INBOUND_AUTH_TYPE="oauth"
export INBOUND_OAUTH_ISSUER_URL="https://auth.example.com"
export INBOUND_OAUTH_AUDIENCE="https://mcp.dev.timoteo.mg.gov.br/mcp"
export INBOUND_OAUTH_RESOURCE_SERVER_URL="https://mcp.dev.timoteo.mg.gov.br/mcp"
export DELEGATION_MODE="user"
export TOKEN_EXCHANGE_URL="https://auth.example.com/oauth/token"
export TOKEN_EXCHANGE_AUDIENCE="https://api.example.com"
export TRUST_PROXY="10.250.50.60"
export ALLOWED_HOSTS="mcp.dev.timoteo.mg.gov.br"

openapi-mcp-server \
  --transport http \
  --host 0.0.0.0 \
  --port 8000 \
  --spec https://api.example.com/openapi.json \
  --api-url https://api.example.com/v1
```
