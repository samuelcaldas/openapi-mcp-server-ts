import { describe, expect, it } from "@jest/globals";
import { execFileSync } from "node:child_process";

describe("package root", () => {
  it("does not read CLI configuration on package import", () => {
    const script = `
      const environment = process.env;
      Object.defineProperty(process, 'env', { value: new Proxy(environment, {
        get(target, name) {
          if (name === 'API_NAME' || name === 'HTTP_MAX_CONNECTIONS') throw new Error('CLI configuration read on SDK import');
          return Reflect.get(target, name);
        }
      }) });
      await import('openapi-mcp-server');
      console.log('imported');
    `;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(), encoding: "utf8", timeout: 5000,
    });
    expect(output.trim()).toBe("imported");
  });

  it("imports without starting a server or installing host signal handlers", () => {
    const script = `
      const before = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')];
      const sdk = await import('openapi-mcp-server');
      console.log(JSON.stringify({
        exported: typeof sdk.prepare_openapi_integration,
        before,
        after: [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]
      }));
    `;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 5000,
    });
    const outcome = JSON.parse(output.trim());
    expect(outcome).toEqual({ exported: "function", before: [0, 0], after: [0, 0] });
  });
});
