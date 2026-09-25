# Embed an OpenAPI integration

The package root is a side-effect-free TypeScript SDK. It does not start a listener, read CLI environment settings, install signal handlers, or authenticate your application's incoming requests. The executable remains `openapi-mcp-server` (`dist/index.js`).

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prepare_openapi_integration } from "openapi-mcp-server";

const server = new McpServer({ name: "my-host", version: "1.0.0" });
const catalog = await prepare_openapi_integration({
    source: "./openapi.yaml", // also accepts an OpenAPI object or a validated remote URL
    base_url: "https://api.example.com/v1",
    include_tags: ["catalog"],
    validate_output: true,
});
catalog.register_tools(server, { prefix: "catalog" });

const result = await catalog.execute_operation("getProduct", { id: "123" });
console.log(result.status, result.data);
// Connect `server` to the transport managed by your host application.
```

For multiple specifications, prepare each integration separately and use distinct prefixes when registering on the same `McpServer`:

```ts
const billing = await prepare_openapi_integration({
    source: "./billing.json",
    base_url: "https://billing.example.com",
});
const shipping = await prepare_openapi_integration({
    source: "./shipping.json",
    base_url: "https://shipping.example.com",
});
billing.register_tools(server, { prefix: "billing" });
shipping.register_tools(server, { prefix: "shipping" });
```

`list_operations()` reports each integration's operation identifiers, methods, and paths. `execute_operation(id, arguments, context?)` returns `{ status, data }`; invalid operations, arguments, credentials, destination failures, and response validation failures throw errors. MCP registration renders those failures as tool errors without exposing upstream response bodies or tokens. A duplicate tool name fails registration instead of replacing an existing tool. Registration adds **only tools**, never prompts or an application UI. The standalone server registers prompts and its UI separately.

## Network and authentication boundaries

External API and spec URLs must use HTTPS and resolve to public addresses by default. Specify `network_policy: { allow_private_networks: true, allow_insecure_http: true }` **only** for trusted internal or local development targets. Spec files can be restricted with `network_policy.allowed_spec_dirs`. The HTTP client pins DNS, rejects redirects, enforces request bounds, and does not route pinned requests through environment proxies.

Your host must authenticate inbound users and supply a validated `context.auth_info` to direct execution or configure the authenticated MCP transport to supply `extra.authInfo` for registered tools. The SDK does **not** implement inbound authentication for the host. For user delegation, provide a `credential_provider` implementing `resolveAuthHeaders(authInfo)` that fails closed on missing identity and obtains a destination-specific token per request. Do not forward a host token directly to a destination API. Operation-defined `Authorization` headers are rejected, regardless of casing. Service credentials may also be provided via an integration-owned provider. Never put secrets into specifications, logs, or error text.

For the standalone stdio and Streamable HTTP transports, see [the operational guide](streamable-http.md). Remote standalone HTTP still requires authenticated inbound requests, explicit Host and Origin allowlists, declared trusted proxies, and TLS termination at the reverse proxy.
