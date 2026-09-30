import {
  recordPrometheusApiCall,
  recordPrometheusToolUsage,
} from "./prometheus.js";

export interface ApiCallMetric {
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
  error?: string;
}

export interface ToolMetric {
  toolName: string;
  durationMs: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface ApiStat {
  count: number;
  errors: number;
  error_rate: number;
  avg_duration_ms: number;
}

export interface ToolStat {
  count: number;
  errors: number;
  error_rate: number;
  avg_duration_ms: number;
}

export interface MetricsSummary {
  api_calls: {
    total: number;
    errors: number;
    error_rate: number;
    paths: number;
  };
  tool_usage: {
    total: number;
    errors: number;
    error_rate: number;
    tools: number;
  };
}

export class MetricsManager {
  private apiCalls: ApiCallMetric[] = [];
  private toolUsage: ToolMetric[] = [];
  private maxHistory: number;
  private prometheusEnabled = false;

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  setPrometheusEnabled(enabled: boolean): void {
    this.prometheusEnabled = enabled;
  }

  recordApiCall(
    path: string,
    method: string,
    statusCode: number,
    durationMs: number,
    error?: string,
  ): void {
    const metric: ApiCallMetric = {
      path,
      method: method.toUpperCase(),
      statusCode,
      durationMs,
      timestamp: Date.now(),
      error,
    };
    this.apiCalls.push(metric);
    if (this.apiCalls.length > this.maxHistory) {
      this.apiCalls.shift();
    }
    if (this.prometheusEnabled) {
      recordPrometheusApiCall(path, method, statusCode, durationMs, error);
    }
  }

  recordToolUsage(
    toolName: string,
    durationMs: number,
    success: boolean,
    error?: string,
  ): void {
    const metric: ToolMetric = {
      toolName,
      durationMs,
      timestamp: Date.now(),
      success,
      error,
    };
    this.toolUsage.push(metric);
    if (this.toolUsage.length > this.maxHistory) {
      this.toolUsage.shift();
    }
    if (this.prometheusEnabled) {
      recordPrometheusToolUsage(toolName, durationMs, success);
    }
  }

  getSummary(): MetricsSummary {
    const totalApiCalls = this.apiCalls.length;
    const apiErrors = this.apiCalls.filter((c) => c.error || c.statusCode >= 400).length;
    const uniquePaths = new Set(this.apiCalls.map((c) => c.path)).size;

    const totalToolCalls = this.toolUsage.length;
    const toolErrors = this.toolUsage.filter((u) => !u.success).length;
    const uniqueTools = new Set(this.toolUsage.map((u) => u.toolName)).size;

    return {
      api_calls: {
        total: totalApiCalls,
        errors: apiErrors,
        error_rate: totalApiCalls > 0 ? apiErrors / totalApiCalls : 0,
        paths: uniquePaths,
      },
      tool_usage: {
        total: totalToolCalls,
        errors: toolErrors,
        error_rate: totalToolCalls > 0 ? toolErrors / totalToolCalls : 0,
        tools: uniqueTools,
      },
    };
  }

  getApiStats(): Record<string, ApiStat> {
    const stats: Record<string, { count: number; errors: number; totalDurationMs: number }> = {};
    for (const call of this.apiCalls) {
      const entry = stats[call.path] ?? { count: 0, errors: 0, totalDurationMs: 0 };
      entry.count += 1;
      entry.totalDurationMs += call.durationMs;
      if (call.error || call.statusCode >= 400) {
        entry.errors += 1;
      }
      stats[call.path] = entry;
    }
    const result: Record<string, ApiStat> = {};
    for (const [path, entry] of Object.entries(stats)) {
      result[path] = {
        count: entry.count,
        errors: entry.errors,
        error_rate: entry.count > 0 ? entry.errors / entry.count : 0,
        avg_duration_ms: entry.count > 0 ? entry.totalDurationMs / entry.count : 0,
      };
    }
    return result;
  }

  getToolStats(): Record<string, ToolStat> {
    const stats: Record<string, { count: number; errors: number; totalDurationMs: number }> = {};
    for (const usage of this.toolUsage) {
      const entry = stats[usage.toolName] ?? { count: 0, errors: 0, totalDurationMs: 0 };
      entry.count += 1;
      entry.totalDurationMs += usage.durationMs;
      if (!usage.success) {
        entry.errors += 1;
      }
      stats[usage.toolName] = entry;
    }
    const result: Record<string, ToolStat> = {};
    for (const [tool, entry] of Object.entries(stats)) {
      result[tool] = {
        count: entry.count,
        errors: entry.errors,
        error_rate: entry.count > 0 ? entry.errors / entry.count : 0,
        avg_duration_ms: entry.count > 0 ? entry.totalDurationMs / entry.count : 0,
      };
    }
    return result;
  }

  getRecentErrors(limit = 10): Array<Record<string, unknown>> {
    const errors: Array<Record<string, unknown>> = [];
    for (let i = this.apiCalls.length - 1; i >= 0 && errors.length < limit; i -= 1) {
      const call = this.apiCalls[i];
      if (call.error || call.statusCode >= 400) {
        errors.push({
          path: call.path,
          method: call.method,
          statusCode: call.statusCode,
          error: call.error,
          durationMs: call.durationMs,
          timestamp: call.timestamp,
        });
      }
    }
    return errors;
  }

  clear(): void {
    this.apiCalls = [];
    this.toolUsage = [];
  }
}

export const metrics = new MetricsManager();
export const metricsManager = metrics;
