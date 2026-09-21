import { parseOpenApiSpec } from "./openapi.js";

describe("parseOpenApiSpec", () => {
  it("should parse a simple openapi spec string", async () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {}
    };
    const parsed = await parseOpenApiSpec(spec as any, false, true);
    expect(parsed.info.title).toBe("Test");
  });

  it("should fail on invalid spec", async () => {
    await expect(parseOpenApiSpec({ invalid: "spec" } as any, false, true)).rejects.toThrow();
  });
});
