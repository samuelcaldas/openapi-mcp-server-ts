import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import ipaddr from "ipaddr.js";

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

export const isIpAllowed = (ip: string): boolean => !isPrivateIp(ip);
export const is_ip_allowed = isIpAllowed;

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

export const resolve_hostname = resolveHostname;

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
