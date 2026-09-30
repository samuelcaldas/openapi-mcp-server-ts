import { describe, it, expect, afterAll } from "@jest/globals";
import http from "node:http";
import { startPrometheusServer, stopPrometheusServer, prometheusMetrics } from "./prometheus.js";
import { metricsManager } from "./index.js";

describe("Prometheus Exporter", () => {
  let server: http.Server | undefined;
  const testPort = 19090;

  afterAll(async () => {
    if (server) {
      await stopPrometheusServer(server);
    }
  });

  it("records metrics in prom-client registry", async () => {
    metricsManager.recordApiCall("/test", "GET", 200, 45);
    metricsManager.recordToolUsage("testTool", 120, true);

    const summary = metricsManager.getSummary();
    expect(summary.api_calls.total).toBeGreaterThanOrEqual(1);
    expect(summary.tool_usage.total).toBeGreaterThanOrEqual(1);
  });

  it("serves metrics over HTTP endpoint /metrics", async () => {
    server = await startPrometheusServer(testPort);
    expect(server).toBeDefined();

    const data = await new Promise<string>((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}/metrics`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
        res.on("error", reject);
      });
    });

    expect(data).toContain("mcp_api_requests_total");
    expect(data).toContain("mcp_tool_calls_total");

    await stopPrometheusServer(server);
    server = undefined;
  });
});
