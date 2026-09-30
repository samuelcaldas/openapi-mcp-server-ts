import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import https from "node:https";
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
        proxy: false,
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

import { metrics } from "../metrics/index.js";
import { logger } from "./logger.js";

export function createHttpClient(allowPrivateNetworks = false, allowInsecureHttp = false): AxiosInstance {
  const client = axios.create({
    timeout: 30_000,
    proxy: false,
    maxRedirects: 0,
    maxContentLength: MAX_SPEC_BYTES,
    maxBodyLength: MAX_SPEC_BYTES,
    headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
  });

  client.interceptors.request.use(async (request: InternalAxiosRequestConfig & { __startTime?: number }) => {
    request.__startTime = Date.now();
    return pinRequest(request, allowPrivateNetworks, allowInsecureHttp);
  });

  client.interceptors.response.use(
    (response) => {
      const config = response.config as (InternalAxiosRequestConfig & { __startTime?: number });
      const durationMs = config.__startTime ? Date.now() - config.__startTime : 0;
      const path = config.url || "/";
      metrics.recordApiCall(path, config.method || "GET", response.status, durationMs);
      return response;
    },
    async (error) => {
      const config = error.config as (InternalAxiosRequestConfig & { __startTime?: number; __retryCount?: number }) | undefined;
      const durationMs = config?.__startTime ? Date.now() - config.__startTime : 0;
      const path = config?.url || "/";
      const status = error.response?.status || 0;
      const errorMsg = error.message || String(error);
      metrics.recordApiCall(path, config?.method || "GET", status, durationMs, errorMsg);

      if (!config || !isRetryable(error)) throw error;
      config.__retryCount = config.__retryCount ?? 0;
      if (config.__retryCount >= 3) throw error;
      config.__retryCount += 1;
      const delay = 250 * (2 ** (config.__retryCount - 1)) + Math.random() * 50;
      logger.warn(`Request failed with ${errorMsg}, retrying (${config.__retryCount}/3) in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return client(config);
    },
  );

  return client;
}

async function pinRequest(request: InternalAxiosRequestConfig, allowPrivateNetworks: boolean, allowInsecureHttp: boolean): Promise<InternalAxiosRequestConfig> {
  request.proxy = false;
  request.maxRedirects = 0;
  if (!request.url) return request;
  const fullUrl = request.baseURL ? new URL(request.url, request.baseURL).toString() : request.url;
  const validated = await validateUrlForSpec(fullUrl, { allowPrivateNetworks, allowHttp: allowInsecureHttp });
  const pinned = buildPinnedUrl(validated, getResolvedIps(validated)[0]);
  request.url = pinned;
  if (typeof request.headers.set === "function") request.headers.set("Host", validated.hostname);
  else (request.headers as unknown as Record<string, string>).Host = validated.hostname;
  if (new URL(fullUrl).protocol === "https:") {
    request.httpsAgent = new https.Agent({ servername: validated.hostname, rejectUnauthorized: true, keepAlive: true, maxSockets: 100, maxFreeSockets: 20 });
  }
  return request;
}

function isRetryable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } }).response?.status;
  if (status !== undefined) return status >= 500 || status === 408 || status === 429;
  const code = (error as { code?: string }).code;
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ERR_NETWORK"].includes(code ?? "");
}

export async function makeRequestWithRetry(
  client: AxiosInstance,
  method: string,
  url: string,
  maxRetries = 3,
  retryDelay = 1000,
  requestConfig: AxiosRequestConfig = {},
): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await client.request({ ...requestConfig, method, url });
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === maxRetries - 1) throw error;
      const jitter = Math.random() * 50;
      const delay = retryDelay * (2 ** attempt) + jitter;
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`Request to ${url} failed, retrying (${attempt + 1}/${maxRetries}) in ${Math.round(delay)}ms: ${errorMsg}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function makeRequest(client: AxiosInstance, method: string, url: string, requestConfig: AxiosRequestConfig = {}): Promise<any> {
  return client.request({ ...requestConfig, method, url });
}

export { MAX_SPEC_BYTES };
