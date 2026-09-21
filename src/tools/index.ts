import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../utils/config.js";
import { createHttpClient } from "../utils/httpClient.js";

const HTTP_METHODS = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"]);

export interface RouteMap {
  methods: ["GET"];
  pattern: string;
  mcpType: "tool";
}

export function buildRouteMaps(apiSpec: any): RouteMap[] {
  const mappings: RouteMap[] = [];
  for (const [routePath, pathItem] of Object.entries(apiSpec?.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) continue;
    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (method.toLowerCase() !== "get" || !operation || typeof operation !== "object" || Array.isArray(operation)) continue;
      const parameters = Array.isArray((operation as { parameters?: unknown }).parameters)
        ? (operation as { parameters: unknown[] }).parameters
        : [];
      const hasQueryParameter = parameters.some((parameter) => parameter && typeof parameter === "object" && (parameter as { in?: string }).in === "query");
      if (hasQueryParameter) mappings.push({ methods: ["GET"], pattern: `^${escapeRegExp(routePath)}$`, mcpType: "tool" });
    }
  }
  return mappings;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getZodType(schema: any): z.ZodTypeAny {
  if (!schema) return z.any();
  if (schema.type === "string") return schema.enum ? z.enum(schema.enum as [string, ...string[]]) : z.string();
  if (schema.type === "integer" || schema.type === "number") return z.number();
  if (schema.type === "boolean") return z.boolean();
  if (schema.type === "array") return z.array(getZodType(schema.items));
  if (schema.type === "object" || schema.properties) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const key of Object.keys(schema.properties ?? {})) {
      let fieldSchema = getZodType(schema.properties[key]);
      if (!schema.required?.includes(key)) fieldSchema = fieldSchema.optional();
      shape[key] = fieldSchema;
    }
    return z.object(shape);
  }
  return z.any();
}

type HttpClientLike = { request: (config: Record<string, unknown>) => Promise<{ data: unknown; status?: number }> };
type ToolRegistrationArguments = HttpClientLike | string[];

export function registerToolsFromOpenApi(
  server: McpServer,
  apiSpec: any,
  httpClientOrIncludeTags: ToolRegistrationArguments = createHttpClient(),
  includeTagsOrExcludeTags: string[] = [],
  excludeTags: string[] = [],
): void {
  const usesLegacySignature = Array.isArray(httpClientOrIncludeTags);
  const httpClient = usesLegacySignature ? createHttpClient() : httpClientOrIncludeTags;
  const includeTags = usesLegacySignature ? httpClientOrIncludeTags : includeTagsOrExcludeTags;
  const actualExcludeTags = usesLegacySignature ? includeTagsOrExcludeTags : excludeTags;
  const paths = apiSpec?.paths ?? {};
  const baseUrl = apiSpec?.servers?.[0]?.url || "http://localhost";

  for (const [routePath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) continue;
    for (const [method, rawOperation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method.toLowerCase()) || !rawOperation || typeof rawOperation !== "object" || Array.isArray(rawOperation)) continue;
      const operation = rawOperation as Record<string, any>;
      if (!operation.operationId) continue;
      if (!matchesTags(operation.tags ?? [], includeTags, actualExcludeTags)) continue;
      const parameters = collectParameters(pathItem as Record<string, unknown>, operation);
      const inputSchema = buildInputSchema(parameters, operation);
      const description = buildToolDescription(method, routePath, operation, parameters);
      server.tool(operation.operationId, description, inputSchema, async (args: any) => executeOperation(httpClient, baseUrl, routePath, method, parameters, operation, args));
    }
  }
}

function matchesTags(operationTags: unknown[], includeTags: string[], excludeTags: string[]): boolean {
  const tags = operationTags.filter((tag): tag is string => typeof tag === "string");
  if (includeTags.length > 0 && !tags.some((tag) => includeTags.includes(tag))) return false;
  return !tags.some((tag) => excludeTags.includes(tag));
}

function collectParameters(pathItem: Record<string, unknown>, operation: Record<string, any>): any[] {
  const inherited = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
  const local = Array.isArray(operation.parameters) ? operation.parameters : [];
  const byKey = new Map<string, any>();
  for (const parameter of [...inherited, ...local]) {
    if (parameter && typeof parameter === "object" && typeof parameter.name === "string" && typeof parameter.in === "string") byKey.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return [...byKey.values()];
}

function buildInputSchema(parameters: any[], operation: Record<string, any>): Record<string, z.ZodTypeAny> {
  const schema: Record<string, z.ZodTypeAny> = {};
  for (const parameter of parameters) {
    let field = getZodType(parameter.schema);
    if (!parameter.required) field = field.optional();
    schema[parameter.name] = field;
  }
  const requestBodySchema = operation.requestBody?.content?.["application/json"]?.schema;
  if (requestBodySchema) schema.body = getZodType(requestBodySchema);
  return schema;
}

function buildToolDescription(method: string, routePath: string, operation: Record<string, any>, parameters: any[]): string {
  const lines = [`[${method.toUpperCase()}] ${routePath}`, operation.summary || operation.description || ""];
  const responseCodes = Object.keys(operation.responses ?? {});
  if (responseCodes.length > 0) lines.push(`Responses: ${responseCodes.join(", ")}`);
  const queryParameters = parameters.filter((parameter) => parameter.in === "query").map((parameter) => parameter.name);
  if (queryParameters.length > 0) lines.push(`Query parameters: ${queryParameters.join(", ")}`);
  return lines.filter(Boolean).join("\n");
}

async function executeOperation(httpClient: HttpClientLike, baseUrl: string, routePath: string, method: string, parameters: any[], operation: Record<string, any>, args: any): Promise<any> {
  let requestUrl = `${baseUrl}${routePath}`;
  const queryParams: Record<string, unknown> = {};
  const headers: Record<string, string> = {};
  for (const parameter of parameters) {
    const value = args[parameter.name];
    if (value === undefined) continue;
    if (parameter.in === "path") requestUrl = requestUrl.replace(`{${parameter.name}}`, encodeURIComponent(String(value)));
    if (parameter.in === "query") queryParams[parameter.name] = value;
    if (parameter.in === "header") headers[parameter.name] = String(value);
    if (parameter.in === "cookie") headers.Cookie = `${headers.Cookie ? `${headers.Cookie}; ` : ""}${parameter.name}=${encodeURIComponent(String(value))}`;
  }
  try {
    const response = await httpClient.request({ method: method.toUpperCase(), url: requestUrl, params: queryParams, headers, data: args.body });
    let data = response.data;
    if (config.VALIDATE_OUTPUT) data = validateOutput(data, operation.responses, response.status);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (error: any) {
    return { isError: true, content: [{ type: "text", text: error?.response ? JSON.stringify(error.response.data) : String(error?.message ?? error) }] };
  }
}

function validateOutput(data: unknown, responses: Record<string, any> | undefined, status: number | undefined): unknown {
  if (!responses || status === undefined) return data;
  const responseSchema = responses[String(status)]?.content?.["application/json"]?.schema ?? responses.default?.content?.["application/json"]?.schema;
  if (!responseSchema) return data;
  const validator = getZodType(responseSchema);
  const result = validator.safeParse(data);
  if (!result.success) throw new Error(`Response validation failed: ${result.error.message}`);
  return result.data;
}
