import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { Command } from "commander";
import { parseOpenApiSpec } from "./utils/openapi.js";
import { createHttpClient } from "./utils/httpClient.js";
import { registerToolsFromOpenApi } from "./tools/index.js";
import { registerPromptsFromOpenApi } from "./prompts/index.js";
import { configureAuth, AuthType } from "./auth/index.js";
import { config } from "./utils/config.js";
import { registerUiApp } from "./app.js";

async function main() {
  const program = new Command();

  program
    .name("openapi-mcp-server")
    .description("MCP server that exposes an OpenAPI spec as tools")
    .option("-s, --spec-url <url>", "URL to OpenAPI spec")
    .option("--spec-path <path>", "Local path to OpenAPI spec")
    .option("-n, --api-name <name>", "API Name", config.API_NAME)
    .option("--api-url <url>", "API Base URL", config.API_BASE_URL)
    .option("--auth-type <type>", "Authentication type (bearer, basic, apikey, cognito, none)", "none")
    .option("--token <token>", "Bearer token")
    .option("--username <username>", "Basic/Cognito auth username")
    .option("--password <password>", "Basic/Cognito auth password")
    .option("--api-key <key>", "API Key")
    .option("--transport <type>", "Transport type (stdio, sse)", config.TRANSPORT)
    .option("-p, --port <port>", "Port for HTTP server", config.PORT.toString())
    .option("--allow-insecure-http", "Allow insecure HTTP", config.ALLOW_INSECURE_HTTP)
    .option("--allow-private-networks", "Allow private networks", config.ALLOW_PRIVATE_NETWORKS)
    .option("--include-tags <tags>", "Comma-separated operation tags to include")
    .option("--exclude-tags <tags>", "Comma-separated operation tags to exclude")
    .option("--no-validate-output", "Disable output validation", !config.VALIDATE_OUTPUT)
    .parse(process.argv);

  const options = program.opts();
  config.VALIDATE_OUTPUT = options.validateOutput !== false;

  const specLocation = options.specUrl || options.specPath;
  if (!specLocation && !config.API_BASE_URL) {
    console.error("Must provide either --spec-url, --spec-path, or API_BASE_URL environment variable.");
    process.exit(1);
  }

  const server = new McpServer({
    name: options.apiName,
    version: "1.0.0"
  });

  try {
    const apiSpec = specLocation ? await parseOpenApiSpec(specLocation, options.allowPrivateNetworks, options.allowInsecureHttp) : {};
    
    // Create base HTTP client
    const httpClient = createHttpClient(options.allowPrivateNetworks, options.allowInsecureHttp);
    
    configureAuth(httpClient, options.authType as AuthType, {
      token: options.token,
      username: options.username,
      password: options.password,
      apiKey: options.apiKey
    });

    if (specLocation) {
      const configuredSpec = { ...apiSpec, servers: [{ url: options.apiUrl }] };
      registerToolsFromOpenApi(
        server,
        configuredSpec,
        httpClient,
        (options.includeTags || "").split(",").map((tag: string) => tag.trim()).filter(Boolean),
        (options.excludeTags || "").split(",").map((tag: string) => tag.trim()).filter(Boolean),
      );
      registerPromptsFromOpenApi(server, configuredSpec);
      registerUiApp(server);
    }

    if (options.transport === "sse") {
      const app = express();
      
      let transport: SSEServerTransport;
      
      app.get("/sse", async (req, res) => {
        transport = new SSEServerTransport("/message", res);
        await server.connect(transport);
      });

      app.post("/message", async (req, res) => {
        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.status(500).send("Transport not initialized");
        }
      });

      app.listen(options.port, () => {
        console.error(`MCP Server running (name: ${options.apiName}) via SSE on http://localhost:${options.port}/sse`);
      });

    } else {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error(`MCP Server running (name: ${options.apiName}) via stdio`);
    }

  } catch (error: any) {
    console.error("Initialization failed:", error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.error("Received SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("Received SIGTERM, shutting down...");
  process.exit(0);
});
