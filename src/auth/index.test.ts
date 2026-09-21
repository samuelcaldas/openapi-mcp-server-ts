import axios, { AxiosHeaders } from "axios";
import { configureAuth } from "./index.js";

describe("configureAuth", () => {
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
