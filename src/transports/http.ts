import http from "node:http";
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { Config } from "../utils/config.js";
import { createServerInstance, type PreparedServerEnvironment } from "../server.js";
import { createInboundAuthMiddleware } from "../auth/inbound.js";
import { createHostValidator, createOriginValidator } from "./security_headers.js";

export interface HttpServerHandle {
  server: http.Server;
  url: string;
  close: () => Promise<void>;
}

/**
 * Creates the Express application configuring security, metadata, auth and Streamable HTTP.
 * @param environment Prepared server environment with specs and credentials.
 * @param verifier Optional custom OAuth verifier for tests.
 * @returns Configured Express application.
 */
export function createHttpApp(environment: PreparedServerEnvironment, verifier?: OAuthTokenVerifier): express.Express {
  const app = express();
  const cfg = environment.configuration;

  configureProxy(app, cfg.trust_proxy);
  app.use(express.json({ limit: "4mb" }));
  app.use(createHostValidator(splitList(cfg.allowed_hosts)));
  app.use(createOriginValidator(splitList(cfg.allowed_origins)));

  mountMetadataRoutes(app, cfg);
  mountMcpRoutes(app, environment, verifier);
  return app;
}

/**
 * Starts the Streamable HTTP server binding to the configured host and port.
 * @param environment Prepared server environment.
 * @param verifier Optional custom OAuth verifier for tests.
 * @returns Handle containing running server instance, address, and close method.
 */
export async function startHttpServer(environment: PreparedServerEnvironment, verifier?: OAuthTokenVerifier): Promise<HttpServerHandle> {
  const app = createHttpApp(environment, verifier);
  const server = http.createServer(app);
  const sockets = new Set<import("node:net").Socket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  const cfg = environment.configuration;
  await new Promise<void>((resolve) => server.listen(cfg.port, cfg.host, resolve));

  const addr = server.address() as import("node:net").AddressInfo;
  const url = `http://${cfg.host}:${addr.port}`;

  return {
    server,
    url,
    close: () => closeServer(server, sockets),
  };
}

function configureProxy(app: express.Express, trustProxy: string): void {
  if (!trustProxy) return;
  app.set("trust proxy", trustProxy === "true" ? true : trustProxy);
}

function mountMetadataRoutes(app: express.Express, cfg: Config): void {
  const handler = (_req: Request, res: Response) => {
    const resourceUrl = cfg.inbound_oauth_resource_server_url || `https://${cfg.host}:${cfg.port}/mcp`;
    const authServers = cfg.inbound_oauth_issuer_url ? [cfg.inbound_oauth_issuer_url] : [];
    res.json({
      resource: resourceUrl,
      authorization_servers: authServers,
      scopes_supported: splitList(cfg.inbound_oauth_scopes),
      resource_name: cfg.api_name,
    });
  };
  app.get("/.well-known/oauth-protected-resource/mcp", handler);
  app.get("/.well-known/oauth-protected-resource", handler);
}

function mountMcpRoutes(app: express.Express, environment: PreparedServerEnvironment, verifier?: OAuthTokenVerifier): void {
  const authMiddleware = createInboundAuthMiddleware(environment.configuration, verifier);

  app.post("/mcp", authMiddleware, async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createServerInstance(environment);
    setupCleanup(res, server, transport);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.all("/mcp", (_req: Request, res: Response) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Method Not Allowed. Only POST is supported in stateless mode." },
      id: null,
    });
  });
}

function setupCleanup(res: Response, server: import("@modelcontextprotocol/sdk/server/mcp.js").McpServer, transport: StreamableHTTPServerTransport): void {
  const cleanup = async () => {
    try {
      await server.close();
      await transport.close();
    } catch {
      // safe cleanup on connection end
    }
  };
  res.on("finish", cleanup);
  res.on("close", cleanup);
}

async function closeServer(server: http.Server, sockets: Set<import("node:net").Socket>): Promise<void> {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function splitList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
