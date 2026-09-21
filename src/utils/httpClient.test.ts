import { validateUrlForSsrf, createHttpClient } from "./httpClient.js";
import nock from "nock";

describe("validateUrlForSsrf SOT equivalence", () => {
  it("should block private IPv4 ranges (10.x, 172.16.x, 192.168.x, 127.x, 169.254.x)", async () => {
    await expect(validateUrlForSsrf("https://10.0.0.1/", false, false)).rejects.toThrow("SSRF blocked");
    await expect(validateUrlForSsrf("https://172.16.0.1/", false, false)).rejects.toThrow("SSRF blocked");
    await expect(validateUrlForSsrf("https://192.168.1.1/", false, false)).rejects.toThrow("SSRF blocked");
    await expect(validateUrlForSsrf("https://127.0.0.1/", false, false)).rejects.toThrow("SSRF blocked");
    await expect(validateUrlForSsrf("https://169.254.169.254/", false, false)).rejects.toThrow("SSRF blocked");
  });

  it("should block private IPv6 ranges (fc00::, ::1)", async () => {
    await expect(validateUrlForSsrf("https://[fc00::1]/", false, false)).rejects.toThrow("SSRF blocked");
    await expect(validateUrlForSsrf("https://[::1]/", false, false)).rejects.toThrow("SSRF blocked");
  });

  it("should block insecure HTTP if allowInsecureHttp is false", async () => {
    await expect(validateUrlForSsrf("http://google.com/", false, false)).rejects.toThrow("Only HTTPS is allowed");
  });

  it("should allow private networks if explicitly configured", async () => {
    const ip = await validateUrlForSsrf("https://127.0.0.1/test", true, false);
    expect(ip).toBe("127.0.0.1");
  });
});

describe("createHttpClient SOT equivalence", () => {
  it("should strictly cap response size and block redirects", () => {
    const client = createHttpClient(false, false);
    expect(client.defaults.maxContentLength).toBe(10485760); // 10 MiB
    expect(client.defaults.maxRedirects).toBe(0); // Zero redirects
    expect(client.defaults.timeout).toBe(30000);
  });
});
