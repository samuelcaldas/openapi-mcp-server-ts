import SwaggerParser from "@apidevtools/swagger-parser";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { validateSpecPath, validateUrlForSpec, fetchPinned, SSRFError } from "./httpClient.js";

const require = createRequire(import.meta.url);

interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Parse and validate an OpenAPI document from an object, local file, or URL. */
export async function parseOpenApiSpec(
  source: string | OpenApiDocument,
  allowPrivateNetworks = false,
  allowInsecureHttp = false,
  allowedSpecDirs?: string[],
): Promise<OpenApiDocument> {
  const rawDocument = await loadDocument(source, allowPrivateNetworks, allowInsecureHttp, allowedSpecDirs);
  rejectExternalReferences(rawDocument);
  const parser = new SwaggerParser();
  const dereferenced = await parser.dereference(rawDocument as any, {
    resolve: { external: false, file: false, http: false },
  }) as any;
  return dereferenced as unknown as OpenApiDocument;
}

async function loadDocument(
  source: string | OpenApiDocument,
  allowPrivateNetworks: boolean,
  allowInsecureHttp: boolean,
  allowedSpecDirs?: string[],
): Promise<OpenApiDocument> {
  if (typeof source !== "string") return source;
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const validated = await validateUrlForSpec(source, { allowPrivateNetworks, allowHttp: allowInsecureHttp });
    const body = await fetchPinned(validated, { allowHttp: allowInsecureHttp });
    return parseDocumentText(body.toString("utf8"), source);
  }
  const specPath = validateSpecPath(source, allowedSpecDirs);
  const body = await fs.readFile(specPath, "utf8");
  return parseDocumentText(body, specPath);
}

function parseDocumentText(text: string, sourceName: string): OpenApiDocument {
  try {
    return JSON.parse(text) as OpenApiDocument;
  } catch {
    try {
      // js-yaml is already part of the dependency graph used by Swagger Parser.
      // Keep this dynamic to avoid imposing a second parser dependency on consumers.
      const yaml = requireYamlParser();
      return yaml.load(text) as OpenApiDocument;
    } catch (error) {
      throw new SSRFError(`Failed to parse OpenAPI spec ${sourceName}: ${String(error)}`);
    }
  }
}

function requireYamlParser(): { load(value: string): unknown } {
  return require("js-yaml") as { load(value: string): unknown };
}

function rejectExternalReferences(value: unknown, location = "$", visited = new Set<object>()): void {
  if (!value || typeof value !== "object") return;
  if (visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectExternalReferences(entry, `${location}[${index}]`, visited));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string" && !child.startsWith("#")) {
      throw new SSRFError(`External $ref is not allowed at ${location}: ${child}`);
    }
    rejectExternalReferences(child, `${location}.${key}`, visited);
  }
}

export interface OpenApiLoadOptions {
  url?: string;
  path?: string;
  validatedUrl?: import("./httpClient.js").ValidatedURL;
  allowHttp?: boolean;
  allowPrivateNetworks?: boolean;
  allowedSpecDirs?: string[];
}

export async function loadOpenApiSpec(options: OpenApiLoadOptions = {}): Promise<OpenApiDocument> {
  const source = options.url || options.path;
  if (!source && !options.validatedUrl) throw new Error("Either url or path must be provided");
  if (options.validatedUrl) {
    const body = await fetchPinned(options.validatedUrl, { allowHttp: options.allowHttp });
    const sourceName = options.validatedUrl.originalUrl || options.validatedUrl.original_url;
    return parseOpenApiSpec(parseDocumentText(body.toString("utf8"), sourceName), options.allowPrivateNetworks, options.allowHttp, options.allowedSpecDirs);
  }
  return parseOpenApiSpec(source as string, options.allowPrivateNetworks, options.allowHttp, options.allowedSpecDirs);
}

export const load_openapi_spec = loadOpenApiSpec;
export const pinnedFetch = fetchPinned;
export const _pinned_fetch = fetchPinned;

export function extractApiNameFromSpec(spec: OpenApiDocument): string {
  return spec.info?.title || "OpenAPI API";
}

export function isOpenApiDocument(document: unknown): document is OpenApiDocument {
  if (!document || typeof document !== "object") return false;
  const candidate = document as OpenApiDocument;
  return typeof candidate.openapi === "string" || typeof candidate.swagger === "string";
}

export function getSpecExtension(source: string): string {
  return path.extname(source).toLowerCase();
}
