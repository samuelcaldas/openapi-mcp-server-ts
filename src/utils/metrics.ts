import { config } from "./config.js";

interface Metric {
  type: "counter" | "gauge" | "histogram";
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export class MetricsProvider {
  private metrics: Metric[] = [];
  
  record(type: "counter" | "gauge" | "histogram", name: string, value: number, labels?: Record<string, string>) {
    this.metrics.push({ type, name, value, labels, timestamp: Date.now() });
    if (this.metrics.length > config.METRICS_MAX_HISTORY) {
      this.metrics.shift();
    }
  }

  getMetrics(): Metric[] {
    return this.metrics;
  }
}

export const globalMetrics = new MetricsProvider();
