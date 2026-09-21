import { globalMetrics } from "./metrics.js";

describe("Metrics", () => {
  it("should record metrics and prune history", () => {
    for (let i = 0; i < 150; i++) {
      globalMetrics.record("counter", "req", 1);
    }
    const metrics = globalMetrics.getMetrics();
    expect(metrics.length).toBeLessThanOrEqual(100); // Because METRICS_MAX_HISTORY defaults to 100
  });
});
