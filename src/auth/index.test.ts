import axios, { AxiosHeaders } from "axios";
import { configureAuth } from "./index.js";
import { registerAuthProvider, authProviders } from "./auth_factory.js";
import { BearerAuthProvider } from "./bearer_auth.js";
import http from "node:http";
import type { AddressInfo } from "node:net";

describe("configureAuth", () => {
  it("owns an independent service provider per configured HTTP client", async () => {
    let created = 0;
    class CountingProvider extends BearerAuthProvider {
      constructor(configuration: ConstructorParameters<typeof BearerAuthProvider>[0]) {
        super(configuration);
        created += 1;
      }
    }
    registerAuthProvider("isolated-test-provider", CountingProvider);
    const api = http.createServer((_request, response) => response.end("OK"));
    await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
    try {
      const first = axios.create();
      const second = axios.create();
      configureAuth(first, "isolated-test-provider" as "bearer", { token: "same-secret" });
      configureAuth(second, "isolated-test-provider" as "bearer", { token: "same-secret" });
      await Promise.all([first.get(url), second.get(url)]);
      expect(created).toBe(2);
    } finally {
      authProviders.delete("isolated-test-provider");
      await new Promise<void>((resolve) => api.close(() => resolve()));
    }
  });
  it("should configure bearer auth", async () => {
    const client = axios.create();
    configureAuth(client, "bearer", { token: "123" });
    const config = await (client.interceptors.request as any).handlers[0].fulfilled({ headers: new AxiosHeaders() });
    expect(config.headers.get("Authorization")).toBe("Bearer 123");
  });

  it("should configure basic auth", async () => {
    const client = axios.create();
    configureAuth(client, "basic", { username: "usr", password: "pwd" });
    const config = await (client.interceptors.request as any).handlers[0].fulfilled({ headers: new AxiosHeaders() });
    const token = Buffer.from("usr:pwd").toString("base64");
    expect(config.headers.get("Authorization")).toBe(`Basic ${token}`);
  });

  it("should configure apikey auth", async () => {
    const client = axios.create();
    configureAuth(client, "apikey", { apiKey: "key" });
    const config = await (client.interceptors.request as any).handlers[0].fulfilled({ headers: new AxiosHeaders() });
    expect(config.headers.get("x-api-key")).toBe("key");
  });

  it("should configure cognito auth", async () => {
    const client = axios.create();
    configureAuth(client, "cognito", { cognitoClientId: "client", cognitoDomain: "domain", username: "usr", password: "pwd" });
    const config = await (client.interceptors.request as any).handlers[0].fulfilled({ headers: new AxiosHeaders() });
    expect(config.headers.get("Authorization")).toContain("Bearer ");
  });
});
