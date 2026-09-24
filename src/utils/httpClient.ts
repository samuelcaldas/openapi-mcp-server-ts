import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import https from "node:https";
import { config } from "./config.js";
import {
  SSRFError,
  SSRFFetchError,
  type ValidatedURL,
  validateUrlForSpec,
  validateUrlForSsrf,
  validateSpecPath,
  isPrivateIp,
  resolveHostname,
} from "./url_validator.js";

export {
  SSRFError,
  SSRFFetchError,
  type ValidatedURL,
  validateUrlForSpec,
  validateUrlForSsrf,
  validateSpecPath,
  isPrivateIp,
  resolveHostname,
};

const MAX_SPEC_BYTES = 10 * 1024 * 1024;

function formatIpForUrl(ip: string): string {
  return ip.includes(":") && !ip.startsWith("[") ? `[${ip}]` : ip;
}

function getOriginalUrl(validated: ValidatedURL): string {
  return validated.originalUrl || validated.original_url;
}

function getResolvedIps(validated: ValidatedURL): string[] {
  return validated.resolvedIps?.length > 0 ? validated.resolvedIps : validated.resolved_ips;
}

function buildPinnedUrl(validated: ValidatedURL, ip: string): string {
  const scheme = new URL(getOriginalUrl(validated)).protocol;
  return `${scheme}//${formatIpForUrl(ip)}:${validated.port}${validated.path}`;
}

/** Fetch a validated URL without performing a second DNS lookup. */
export async function fetchPinned(url: ValidatedURL, options: { allowHttp?: boolean; maxBytes?: number; timeoutMs?: number } = {}): Promise<Buffer> {
  const allowHttp = options.allowHttp ?? false;
  const maxBytes = options.maxBytes ?? MAX_SPEC_BYTES;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const scheme = new URL(getOriginalUrl(url)).protocol;
  if (!["http:", "https:"].includes(scheme)) throw new SSRFError(`URL scheme '${scheme}' not allowed`);
  if (scheme === "http:" && !allowHttp) throw new SSRFError("http:// URL requires allow_insecure_http");
  let lastError: unknown;
  for (const ip of getResolvedIps(url)) {
    const pinnedUrl = buildPinnedUrl(url, ip);
    try {
      const response = await axios.get<ArrayBuffer>(pinnedUrl, {
        responseType: "arraybuffer",
        timeout: timeoutMs,
        maxRedirects: 0,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        headers: { Host: url.hostname },
        httpsAgent: scheme === "https:" ? new https.Agent({ servername: url.hostname, rejectUnauthorized: true }) : undefined,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      const contentLength = Number(response.headers["content-length"]);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new SSRFFetchError(`Spec too large: ${contentLength} bytes (max ${maxBytes})`);
      const body = Buffer.from(response.data);
      if (body.length > maxBytes) throw new SSRFFetchError(`Spec too large: exceeded ${maxBytes} bytes`);
      return body;
    } catch (error) {
      if (error instanceof SSRFFetchError) throw error;
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== undefined && status >= 300 && status < 400) throw new SSRFFetchError(`Refusing to follow redirect (HTTP ${status}) for ${getOriginalUrl(url)}`);
      lastError = error;
      const code = (error as { code?: string }).code;
      if (!(code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ERR_NETWORK")) throw error;
    }
  }
  if (lastError) throw lastError;
  throw new SSRFFetchError(`No resolved IPs available for ${getOriginalUrl(url)}`);
}

export function createHttpClient(allowPrivateNetworks = config.ALLOW_PRIVATE_NETWORKS, allowInsecureHttp = config.ALLOW_INSECURE_HTTP): AxiosInstance {
  const client = axios.create({
    timeout: 30_000,
    maxRedirects: 0,
    maxContentLength: MAX_SPEC_BYTES,
    maxBodyLength: MAX_SPEC_BYTES,
    headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
  });
  client.interceptors.request.use(async (request: InternalAxiosRequestConfig) => pinRequest(request, allowPrivateNetworks, allowInsecureHttp));
  client.interceptors.response.use(undefined, async (error) => {
    const request = error.config as (InternalAxiosRequestConfig & { __retryCount?: number }) | undefined;
    if (!request || !isRetryable(error)) throw error;
    request.__retryCount = request.__retryCount ?? 0;
    if (request.__retryCount >= 3) throw error;
    request.__retryCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 250 * request.__retryCount!));
    return client(request);
  });
  return client;
}

async function pinRequest(request: InternalAxiosRequestConfig, allowPrivateNetworks: boolean, allowInsecureHttp: boolean): Promise<InternalAxiosRequestConfig> {
  if (!request.url) return request;
  const fullUrl = request.baseURL ? new URL(request.url, request.baseURL).toString() : request.url;
  const validated = await validateUrlForSpec(fullUrl, { allowPrivateNetworks, allowHttp: allowInsecureHttp });
  const pinned = buildPinnedUrl(validated, getResolvedIps(validated)[0]);
  request.url = pinned;
  if (typeof request.headers.set === "function") request.headers.set("Host", validated.hostname);
  else (request.headers as unknown as Record<string, string>).Host = validated.hostname;
  if (new URL(fullUrl).protocol === "https:") {
    request.httpsAgent = new https.Agent({ servername: validated.hostname, rejectUnauthorized: true, keepAlive: true, maxSockets: config.HTTP_MAX_CONNECTIONS, maxFreeSockets: config.HTTP_MAX_KEEPALIVE });
  }
  return request;
}

function isRetryable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } }).response?.status;
  if (status !== undefined) return status >= 500 || status === 408 || status === 429;
  const code = (error as { code?: string }).code;
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ERR_NETWORK"].includes(code ?? "");
}

export async function makeRequestWithRetry(client: AxiosInstance, method: string, url: string, maxRetries = 3, retryDelay = 1000, requestConfig: AxiosRequestConfig = {}): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await client.request({ ...requestConfig, method, url });
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function makeRequest(client: AxiosInstance, method: string, url: string, requestConfig: AxiosRequestConfig = {}): Promise<any> {
  return client.request({ ...requestConfig, method, url });
}

export { MAX_SPEC_BYTES };
