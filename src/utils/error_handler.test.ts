import { StructuredError } from "./error_handler.js";

describe("StructuredError", () => {
  it("should create error with details", () => {
    const err = new StructuredError("msg", "code", { foo: "bar" });
    expect(err.message).toBe("msg");
    expect(err.code).toBe("code");
    expect(err.details.foo).toBe("bar");
  });
});
