import { Command } from "commander";
import { loadConfig, type ConfigOptions } from "./utils/config.js";
import { validateConfig } from "./utils/config_validator.js";
import { prepareServerEnvironment } from "./server.js";
import { startStdioServer } from "./transports/stdio.js";
import { startHttpServer } from "./transports/http.js";
import { logger } from "./utils/logger.js";

/**
 * Builds the commander Command instance with all CLI options.
 * @returns Configured Command object.
 */
export function buildCliProgram(): Command {
  const program = new Command();
  program
    .name("openapi-mcp-server")
    .description("MCP server exposing OpenAPI specification as tools with Streamable HTTP and stdio support")
    .option("--spec <spec>", "URL or local path to OpenAPI spec")
    .option("-s, --spec-url <url>", "URL to OpenAPI spec")
    .option("--spec-path <path>", "Local path to OpenAPI spec")
    .option("-n, --api-name <name>", "API Name")
    .option("--api-url <url>", "API Base URL")
    .option("--auth-type <type>", "Outbound Auth type (bearer, basic, apikey, cognito, none)")
    .option("--token <token>", "Outbound Bearer token")
    .option("--username <username>", "Outbound Basic/Cognito auth username")
    .option("--password <password>", "Outbound Basic/Cognito auth password")
    .option("--api-key <key>", "Outbound API Key")
    .option("--transport <type>", "Transport type (stdio, http)")
    .option("-h, --host <host>", "Host address to bind HTTP server")
    .option("-p, --port <port>", "Port for HTTP server")
    .option("--allow-insecure-http", "Allow insecure HTTP for specs and APIs")
    .option("--allow-private-networks", "Allow private networks for specs and APIs")
    .option("--include-tags <tags>", "Comma-separated operation tags to include")
    .option("--exclude-tags <tags>", "Comma-separated operation tags to exclude")
    .option("--no-validate-output", "Disable output schema validation")
    .option("--inbound-auth-type <type>", "Inbound authentication type (none, bearer, oauth)")
    .option("--delegation-mode <mode>", "Delegation mode to destination API (service, user)")
    .option("--trust-proxy <val>", "Trust reverse proxy (e.g. true, 10.250.50.60)")
    .option("--allowed-hosts <hosts>", "Allowed Host headers (comma-separated)")
    .option("--allowed-origins <origins>", "Allowed Origin headers (comma-separated)")
    .option("--log-level <level>", "Set logging level (debug, info, warn, error)")
    .option("--enable-prometheus", "Enable Prometheus HTTP metrics exporter")
    .option("--prometheus-port <port>", "Port for Prometheus metrics exporter")
    .option("--use-tenacity", "Enable exponential backoff retry logic");
  return program;
}

/**
 * Parses CLI argv arguments into ConfigOptions.
 * @param program Commander program.
 * @param argv Command line argument array.
 * @returns Parsed options.
 */
export function parseCliArgs(program: Command, argv: string[]): ConfigOptions {
  program.parse(argv);
  return program.opts();
}

import { metrics } from "./metrics/index.js";
import { startPrometheusServer, stopPrometheusServer } from "./metrics/prometheus.js";

/**
 * Executes the CLI entrypoint, loading configuration, validating, and starting the chosen transport.
 * @param argv Command line argument array (defaults to process.argv).
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = buildCliProgram();
  const parsedOptions = parseCliArgs(program, argv);
  const configuration = loadConfig(parsedOptions);
  validateConfig(configuration);
  logger.setLevel(configuration.log_level);

  if (configuration.enable_prometheus) {
    metrics.setPrometheusEnabled(true);
    await startPrometheusServer(configuration.prometheus_port);
    process.on("SIGINT", async () => {
      await stopPrometheusServer();
    });
    process.on("SIGTERM", async () => {
      await stopPrometheusServer();
    });
  }

  const environment = await prepareServerEnvironment(configuration);
  if (configuration.transport === "http") {
    await startHttpServer(environment);
    return;
  }
  await startStdioServer(environment);
}
