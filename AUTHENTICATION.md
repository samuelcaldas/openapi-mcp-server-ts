# Authentication for OpenAPI MCP Server

[← Back to main README](README.md)

## Mandatory Arguments

Regardless of the authentication method used, the following arguments or environment variables are always required:

- `--api-url` / `API_BASE_URL`: The base URL of the target API (e.g., `https://api.example.com`)
- One of the following:
  - `--spec-url` / `API_SPEC_URL`: The URL to the OpenAPI specification (e.g., `https://api.example.com/openapi.json`)
  - `--spec-path` / `API_SPEC_PATH`: Path to a local OpenAPI specification file (e.g., `./openapi.json`)

## Outbound Authentication (MCP Server to Target API)

The OpenAPI MCP Server supports five outbound authentication methods:

| Method | Description | Required Parameters (CLI) | Environment Variables |
|--------|-------------|---------------------------|-----------------------|
| **None** | No authentication (default) | `--auth-type none` | `AUTH_TYPE=none` |
| **Bearer** | Token-based authentication | `--auth-type bearer --token <TOKEN>` | `AUTH_TYPE=bearer`, `TOKEN=<TOKEN>` |
| **Basic** | Username/password authentication | `--auth-type basic --username <USER> --password <PASS>` | `AUTH_TYPE=basic`, `USERNAME=<USER>`, `PASSWORD=<PASS>` |
| **API Key** | API key authentication (header/query) | `--auth-type apikey --api-key <KEY>` | `AUTH_TYPE=apikey`, `API_KEY=<KEY>` |
| **Cognito** | AWS Cognito User Pool authentication | `--auth-type cognito --username <USER> --password <PASS>` | `AUTH_TYPE=cognito`, `USERNAME=<USER>`, `PASSWORD=<PASS>` |

### Quick Start Examples

#### Bearer Authentication
```bash
# CLI
npx openapi-mcp-server --auth-type bearer --token "YOUR_TOKEN" --api-url "https://api.example.com" --spec-path ./openapi.json

# Environment variables
export AUTH_TYPE=bearer
export TOKEN="YOUR_TOKEN"
export API_BASE_URL="https://api.example.com"
export API_SPEC_PATH="./openapi.json"
npx openapi-mcp-server
```

#### Basic Authentication
```bash
npx openapi-mcp-server --auth-type basic --username "admin" --password "secret" --api-url "https://api.example.com" --spec-path ./openapi.json
```

## Inbound Authentication (Client to MCP Server via HTTP)

When running with `--transport http`, inbound authentication protects access to the MCP server endpoints (`/mcp`, `/sse`):

| Inbound Auth Type | Description | CLI Flag | Environment Variable |
|-------------------|-------------|----------|----------------------|
| **none** | No authentication (allowed only on localhost/loopback) | `--inbound-auth-type none` | `INBOUND_AUTH_TYPE=none` |
| **bearer** | Static or dynamic Bearer token validation | `--inbound-auth-type bearer` | `INBOUND_AUTH_TYPE=bearer` |
| **oauth** | RFC 8693 token exchange and user delegation | `--inbound-auth-type oauth` | `INBOUND_AUTH_TYPE=oauth` |

### User Delegation & Service Credentials

- **Service Mode** (`--delegation-mode service`): Outbound calls use the static credentials configured on the server.
- **User Delegation Mode** (`--delegation-mode user`): Inbound user identity tokens are exchanged for downstream API credentials via OAuth token exchange.

## JWT Token Expiration Inspection & Troubleshooting

When an outbound API returns HTTP 401 Unauthorized, the server automatically inspects Bearer JWT tokens to determine if they have expired:
- Logs warning with remaining/elapsed seconds if expired.
- Emits actionable troubleshooting tips:
  `TROUBLESHOOTING: Authentication error. Please check your credentials or ensure your token is valid. You may need to refresh your authentication tokens.`
- For HTTP 403 Forbidden:
  `TROUBLESHOOTING: Authorization error. You don't have permission to access this resource. Please check your IAM permissions or API key scope.`
