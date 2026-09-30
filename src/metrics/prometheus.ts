import http from "node:http";
import client from "prom-client";
import { logger } from "../utils/logger.js";

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "mcp_" });

const apiRequests = new client.Counter({
  name: "mcp_api_requests_total",
  help: "Total API requests made by the MCP server",
  labelNames: ["method", "path", "status"] as const,
  registers: [register],
});

const apiErrors = new client.Counter({
  name: "mcp_api_errors_total",
  help: "Total API errors encountered",
  labelNames: ["method", "path"] as const,
  registers: [register],
});

const apiDuration = new client.Histogram({
  name: "mcp_api_request_duration_seconds",
  help: "API request duration in seconds",
  labelNames: ["method", "path"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const toolCalls = new client.Counter({
  name: "mcp_tool_calls_total",
  help: "Total tool calls handled",
  labelNames: ["tool", "status"] as const,
  registers: [register],
});

const toolErrors = new client.Counter({
  name: "mcp_tool_errors_total",
  help: "Total tool execution errors",
  labelNames: ["tool"] as const,
  registers: [register],
});

const toolDuration = new client.Histogram({
  name: "mcp_tool_duration_seconds",
  help: "Tool execution duration in seconds",
  labelNames: ["tool"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

let prometheusServer: http.Server | undefined;

export function recordPrometheusApiCall(
  path: string,
  method: string,
  statusCode: number,
  durationMs: number,
  error?: string,
): void {
  const statusStr = statusCode >= 400 || error ? "error" : "success";
  apiRequests.labels(method.toUpperCase(), path, statusStr).inc();
  apiDuration.labels(method.toUpperCase(), path).observe(durationMs / 1000);
  if (statusCode >= 400 || error) {
    apiErrors.labels(method.toUpperCase(), path).inc();
  }
}

export function recordPrometheusToolUsage(
  toolName: string,
  durationMs: number,
  success: boolean,
): void {
  const statusStr = success ? "success" : "error";
  toolCalls.labels(toolName, statusStr).inc();
  toolDuration.labels(toolName).observe(durationMs / 1000);
  if (!success) {
    toolErrors.labels(toolName).inc();
  }
}

export async function getPrometheusMetrics(): Promise<string> {
  return register.metrics();
}

export function getPrometheusContentType(): string {
  return register.contentType;
}

export function startPrometheusServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    if (prometheusServer) {
      resolve(prometheusServer);
      return;
    }
    const server = http.createServer(async (req, res) => {
      if (req.method === "GET" && (req.url === "/metrics" || req.url === "/")) {
        try {
          const metricsData = await register.metrics();
          res.setHeader("Content-Type", register.contentType);
          res.writeHead(200);
          res.end(metricsData);
        } catch (err) {
          res.writeHead(500);
          res.end(String(err));
        }
        return;
      }
      res.writeHead(404);
      res.end("Not Found");
    });

    server.on("error", (err) => {
      logger.error(`Prometheus metrics server error: ${err.message}`);
      reject(err);
    });

    server.listen(port, () => {
      logger.info(`Prometheus metrics server listening on port ${port}`);
      prometheusServer = server;
      resolve(server);
    });
  });
}

export function stopPrometheusServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!prometheusServer) {
      resolve();
      return;
    }
    prometheusServer.close(() => {
      prometheusServer = undefined;
      resolve();
    });
  });
}
