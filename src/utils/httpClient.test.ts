import { validateUrlForSsrf, createHttpClient, HttpClientFactory } from "./httpClient.js";
import nock from "nock";
import http from "node:http";
import type { AddressInfo } from "node:net";

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
  it("keeps DNS-pinned outbound traffic off environment-configured proxies", async () => {
    let proxyRequests = 0;
    const api = http.createServer((_request, response) => response.end("destination"));
    const proxy = http.createServer((_request, response) => {
      proxyRequests += 1;
      response.end("proxy");
    });
    await Promise.all([new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve)),
      new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve))]);
    const previousProxy = process.env.HTTP_PROXY;
    const previousBypass = process.env.NO_PROXY;
    try {
      process.env.HTTP_PROXY = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
      process.env.NO_PROXY = "";
      const client = createHttpClient(true, true);
      const result = await client.get(`http://127.0.0.1:${(api.address() as AddressInfo).port}/data`);
      expect(result.data).toBe("destination");
      expect(proxyRequests).toBe(0);
    } finally {
      if (previousProxy === undefined) delete process.env.HTTP_PROXY;
      if (previousProxy !== undefined) process.env.HTTP_PROXY = previousProxy;
      if (previousBypass === undefined) delete process.env.NO_PROXY;
      if (previousBypass !== undefined) process.env.NO_PROXY = previousBypass;
      await Promise.all([new Promise<void>((resolve) => api.close(() => resolve())),
        new Promise<void>((resolve) => proxy.close(() => resolve()))]);
    }
  });
  it("ignores an explicit per-request proxy for DNS-pinned requests", async () => {
    let proxyRequests = 0;
    const api = http.createServer((_request, response) => response.end("destination"));
    const proxy = http.createServer((_request, response) => {
      proxyRequests += 1;
      response.end("proxy");
    });
    await Promise.all([
      new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve)),
      new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve)),
    ]);
    try {
      const client = createHttpClient(true, true);
      const response = await client.get(`http://127.0.0.1:${(api.address() as AddressInfo).port}/data`, {
        proxy: { host: "127.0.0.1", port: (proxy.address() as AddressInfo).port, protocol: "http" },
      });
      expect(response.data).toBe("destination");
      expect(proxyRequests).toBe(0);
    } finally {
      await Promise.all([
        new Promise<void>((resolve) => api.close(() => resolve())),
        new Promise<void>((resolve) => proxy.close(() => resolve())),
      ]);
    }
  });

  it("does not follow redirects when a request overrides maxRedirects", async () => {
    let redirectedRequests = 0;
    const api = http.createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(302, { Location: "/target" });
        response.end();
        return;
      }
      redirectedRequests += 1;
      response.end("redirect target");
    });
    await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
    try {
      const client = createHttpClient(true, true);
      await expect(client.get(`http://127.0.0.1:${(api.address() as AddressInfo).port}/redirect`, {
        maxRedirects: 1,
      })).rejects.toMatchObject({ response: { status: 302 } });
      expect(redirectedRequests).toBe(0);
    } finally {
      await new Promise<void>((resolve) => api.close(() => resolve()));
    }
  });

  it("should strictly cap response size and block redirects", () => {
    const client = createHttpClient(false, false);
    expect(client.defaults.maxContentLength).toBe(10485760); // 10 MiB
    expect(client.defaults.maxRedirects).toBe(0); // Zero redirects
    expect(client.defaults.timeout).toBe(30000);
  });

  it("should configure httpAgent and httpsAgent with connection pooling", () => {
    const client = createHttpClient(false, false, { maxConnections: 50, maxKeepAlive: 10 });
    const httpAgent = client.defaults.httpAgent as http.Agent;
    const httpsAgent = client.defaults.httpsAgent as any;

    expect(httpAgent).toBeDefined();
    expect(httpsAgent).toBeDefined();
    expect(httpAgent.maxSockets).toBe(50);
    expect(httpAgent.maxFreeSockets).toBe(10);
    expect(httpsAgent.maxSockets).toBe(50);
    expect(httpsAgent.maxFreeSockets).toBe(10);
  });

  it("should create client via HttpClientFactory with default pool settings", () => {
    const client = HttpClientFactory.createClient(false, false);
    const httpAgent = client.defaults.httpAgent as http.Agent;
    const httpsAgent = client.defaults.httpsAgent as any;

    expect(httpAgent).toBeDefined();
    expect(httpsAgent).toBeDefined();
    expect(httpAgent.maxSockets).toBe(100);
    expect(httpAgent.maxFreeSockets).toBe(20);
    expect(httpsAgent.maxSockets).toBe(100);
    expect(httpsAgent.maxFreeSockets).toBe(20);
  });
});
