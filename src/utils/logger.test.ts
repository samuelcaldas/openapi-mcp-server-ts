import { describe, it, expect } from "@jest/globals";
import { maskSensitiveInfo, setLogLevel, logger } from "./logger.js";

describe("Logger and Secret Masking", () => {
  it("masks Bearer tokens and api keys in logs", () => {
    const raw = "Authorization: Bearer secret-token-12345, apiKey: secretKey67890";
    const masked = maskSensitiveInfo(raw);
    expect(masked).not.toContain("secret-token-12345");
    expect(masked).toContain("Bearer ***");
    expect(masked).not.toContain("secretKey67890");
  });

  it("updates logger level dynamically", () => {
    setLogLevel("debug");
    expect(logger.level).toBe("debug");
    setLogLevel("warn");
    expect(logger.level).toBe("warn");
    setLogLevel("info");
  });
});
