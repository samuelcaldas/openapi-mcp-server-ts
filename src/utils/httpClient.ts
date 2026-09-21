import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { config } from "./config.js";

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}

export class SSRFFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFFetchError";
  }
}

export interface ValidatedURL {
  originalUrl: string;
  original_url: string;
  hostname: string;
  port: number;
  path: string;
  resolvedIps: string[];
  resolved_ips: string[];
}

const MAX_SPEC_BYTES = 10 * 1024 * 1024;
const ALLOWED_SPEC_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);
const PRIVATE_RANGES = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16",
  "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
  "::/128", "::1/128", "fc00::/7", "fe80::/10", "ff00::/8",
];

export function isPrivateIp(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    if (parsed.kind() === "ipv6") {
      const ipv6 = parsed as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) return isPrivateIp(ipv6.toIPv4Address().toString());
    }
    return PRIVATE_RANGES.some((range) => parsed.match(ipaddr.parseCIDR(range)));
  } catch {
    return true;
  }
}

function getAddressValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => typeof entry === "string" ? entry : (entry as { address?: string }).address).filter((entry): entry is string => Boolean(entry));
  if (typeof value === "string") return [value];
  if (value && typeof value === "object" && "address" in value) {
    const address = (value as { address?: unknown }).address;
    return typeof address === "string" ? [address] : [];
  }
  return [];
}

export async function resolveHostname(hostname: string): Promise<string[]> {
  const result = await dns.lookup(hostname, { all: true, verbatim: true });
  return getAddressValues(result);
}

export async function validateUrlForSpec(url: string, options: { allowHttp?: boolean; allowPrivateNetworks?: boolean } = {}): Promise<ValidatedURL> {
  const allowHttp = options.allowHttp ?? false;
  const allowPrivateNetworks = options.allowPrivateNetworks ?? false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new SSRFError(`Invalid URL: ${String(error)}`);
  }
  const allowedSchemes = allowHttp ? ["http:", "https:"] : ["https:"];
  if (!allowedSchemes.includes(parsed.protocol)) {
    throw new SSRFError("Only HTTPS is allowed unless allow_insecure_http is enabled");
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) throw new SSRFError("URL must have a host");
  const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
  let addresses: string[];
  if (ipaddr.isValid(hostname)) {
    addresses = [hostname];
  } else {
    try {
      addresses = await resolveHostname(hostname);
    } catch (error) {
      throw new SSRFError(`DNS resolution failed for ${hostname}: ${String(error)}`);
    }
  }
  if (addresses.length === 0) throw new SSRFError(`DNS resolution failed for ${hostname}: no addresses returned`);
  if (!allowPrivateNetworks) {
    const blocked = addresses.filter(isPrivateIp);
    if (blocked.length > 0) {
      throw new SSRFError(`SSRF blocked: URL resolves to blocked IP address(es): ${blocked.join(", ")}. Private, loopback, link-local, and reserved IPs are not allowed.`);
    }
  }
  return {
    originalUrl: url,
    original_url: url,
    hostname,
    port,
    path: `${parsed.pathname || "/"}${parsed.search}`,
    resolvedIps: addresses,
    resolved_ips: addresses,
  };
}

export async function validateUrlForSsrf(url: string, allowPrivateNetworks = false, allowInsecureHttp = false): Promise<string> {
  const validated = await validateUrlForSpec(url, { allowPrivateNetworks, allowHttp: allowInsecureHttp });
  return validated.resolvedIps[0];
}

export function validateSpecPath(specPath: string, allowedDirs?: string[]): string {
  const resolved = fs.realpathSync(specPath);
  const extension = path.extname(resolved).toLowerCase();
  if (!ALLOWED_SPEC_EXTENSIONS.has(extension)) {
    throw new SSRFError(`spec_path must point to a spec file (.json, .yaml, .yml), got: ${extension}`);
  }
  if (allowedDirs && allowedDirs.length > 0) {
    const canonicalDirs = allowedDirs.map((directory) => fs.realpathSync(directory));
    if (!canonicalDirs.some((directory) => resolved === directory || resolved.startsWith(`${directory}${path.sep}`))) {
      throw new SSRFError(`Path ${resolved} is not within allowed directories: ${allowedDirs.join(", ")}`);
    }
  } else {
    const blockedPrefixes = process.platform === "win32"
      ? [process.env.SystemRoot ?? "C:\\Windows", `${process.env.SystemRoot ?? "C:\\Windows"}\\System32`, process.env.USERPROFILE ?? ""]
      : ["/etc", "/root", "/proc", "/sys", "/var/run"];
    if (blockedPrefixes.some((prefix) => resolved === prefix || resolved.startsWith(`${prefix}${path.sep}`))) {
      throw new SSRFError(`Path resolves to blocked location: ${resolved}`);
    }
  }
  return resolved;
}

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
