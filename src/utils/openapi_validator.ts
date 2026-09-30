import { isOpenApiDocument } from "./openapi.js";
import { logger } from "./logger.js";

const SUPPORTED_HTTP_METHODS = ["get", "post", "put", "delete", "patch", "options", "head"] as const;

const PAGINATION_PARAM_NAMES = new Set([
  "page",
  "limit",
  "offset",
  "size",
  "per_page",
  "pagesize",
  "page_size",
  "next",
  "cursor",
]);

const PAGINATION_PROPERTY_NAMES = new Set(["items", "data", "results", "content"]);

export interface ExtractedOperation {
  operationId: string;
  method: string;
  path: string;
  summary: string;
}

export interface ExtractedSchema {
  name: string;
  type: string;
  properties: number;
  required: string[];
}

export interface ApiStructure {
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, any>;
  operations: ExtractedOperation[];
  schemas: ExtractedSchema[];
}

export type PaginationEndpoint = [string, string, Record<string, any>];

export function validateOpenApiSpec(spec: unknown): boolean {
  if (!isOpenApiDocument(spec)) {
    logger.error("Invalid OpenAPI spec structure: expected an object");
    return false;
  }
  if (!spec.openapi) {
    logger.error("Missing 'openapi' field in OpenAPI spec");
    return false;
  }
  if (!spec.info) {
    logger.error("Missing 'info' field in OpenAPI spec");
    return false;
  }
  if (!spec.paths || typeof spec.paths !== "object" || Array.isArray(spec.paths)) {
    logger.error("Missing 'paths' field in OpenAPI spec");
    return false;
  }
  if (!spec.openapi.startsWith("3.")) {
    logger.warn(`OpenAPI version ${spec.openapi} may not be fully supported`);
  }
  return true;
}

function hasPaginationParam(parameters?: any[]): boolean {
  if (!Array.isArray(parameters)) return false;
  return parameters.some((param) => {
    const name = String(param?.name || "").toLowerCase();
    return PAGINATION_PARAM_NAMES.has(name);
  });
}

function isArraySchema(schema?: any): boolean {
  if (!schema || typeof schema !== "object") return false;
  return schema.type === "array" || Boolean(schema.items);
}

function hasPaginationProperty(properties?: Record<string, any>): boolean {
  if (!properties || typeof properties !== "object") return false;
  return Object.entries(properties).some(([propName, propSchema]) => {
    const isTargetProp = PAGINATION_PROPERTY_NAMES.has(propName.toLowerCase());
    return isTargetProp && isArraySchema(propSchema);
  });
}

function hasArrayResponse(responses?: Record<string, any>): boolean {
  if (!responses || typeof responses !== "object") return false;
  return Object.values(responses).some((response) => {
    const content = response?.content;
    if (!content || typeof content !== "object") return false;

    return Object.entries(content).some(([contentType, contentObj]: [string, any]) => {
      if (!contentType.includes("application/json")) return false;
      const schema = contentObj?.schema;
      if (isArraySchema(schema)) return true;
      return hasPaginationProperty(schema?.properties);
    });
  });
}

export function findPaginationEndpoints(spec: Record<string, any>): PaginationEndpoint[] {
  const paginationEndpoints: PaginationEndpoint[] = [];
  const paths = spec?.paths;
  if (!paths || typeof paths !== "object") return paginationEndpoints;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (method.toLowerCase() !== "get") continue;
      if (!operation || typeof operation !== "object") continue;

      const hasParam = hasPaginationParam((operation as any).parameters);
      const hasArray = hasArrayResponse((operation as any).responses);
      if (hasParam || hasArray) {
        paginationEndpoints.push([path, method, operation as Record<string, any>]);
      }
    }
  }

  return paginationEndpoints;
}

function extractParameters(parameters?: any[]): any[] {
  if (!Array.isArray(parameters)) return [];
  return parameters.map((param) => ({
    name: param?.name || "",
    in: param?.in || "",
    required: Boolean(param?.required),
    description: param?.description || "",
  }));
}

function extractRequestBody(operation: any): any {
  if (!operation?.requestBody) return null;
  const content = operation.requestBody.content || {};
  return {
    required: Boolean(operation.requestBody.required),
    content_types: Object.keys(content),
  };
}

function extractResponses(responsesObj?: Record<string, any>): Record<string, any> {
  const responses: Record<string, any> = {};
  if (!responsesObj || typeof responsesObj !== "object") return responses;

  for (const [statusCode, response] of Object.entries(responsesObj)) {
    const content = (response as any)?.content || {};
    responses[statusCode] = {
      description: (response as any)?.description || "",
      content_types: Object.keys(content),
    };
  }
  return responses;
}

function extractSchemas(spec: Record<string, any>): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = [];
  const componentSchemas = spec?.components?.schemas;
  if (!componentSchemas || typeof componentSchemas !== "object") return schemas;

  for (const [schemaName, schema] of Object.entries(componentSchemas)) {
    const s = schema as any;
    schemas.push({
      name: schemaName,
      type: s?.type || "object",
      properties: Object.keys(s?.properties || {}).length,
      required: Array.isArray(s?.required) ? s.required : [],
    });
  }
  return schemas;
}

export function extractApiStructure(spec: Record<string, any>): ApiStructure {
  const result: ApiStructure = {
    info: {
      title: spec?.info?.title || "Unknown API",
      version: spec?.info?.version || "Unknown",
      description: spec?.info?.description || "",
    },
    paths: {},
    operations: [],
    schemas: extractSchemas(spec),
  };

  const paths = spec?.paths;
  if (!paths || typeof paths !== "object") return result;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const pathInfo: { path: string; methods: Record<string, any> } = { path, methods: {} };

    for (const method of SUPPORTED_HTTP_METHODS) {
      if (!(method in pathItem)) continue;
      const operation = (pathItem as any)[method];
      if (!operation || typeof operation !== "object") continue;

      const operationId = operation.operationId || `${method}${path}`;
      const summary = operation.summary || "";
      const description = operation.description || "";

      pathInfo.methods[method] = {
        operationId,
        summary,
        description,
        parameters: extractParameters(operation.parameters),
        requestBody: extractRequestBody(operation),
        responses: extractResponses(operation.responses),
      };

      result.operations.push({
        operationId,
        method: method.toUpperCase(),
        path,
        summary,
      });
    }

    result.paths[path] = pathInfo;
  }

  return result;
}
