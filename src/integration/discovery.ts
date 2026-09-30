import type { SchemaDefinition, ParameterDefinition } from "./schema.js";

export interface OperationDefinition {
  operation_id: string;
  method: string;
  path: string;
  description: string;
  parameters: ParameterDefinition[];
  request_body?: SchemaDefinition;
  body_required: boolean;
  responses?: Record<string, { content?: Record<string, { schema?: SchemaDefinition }> }>;
}

const METHODS = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"]);

/** Discover tagged operations and reject ambiguous operation identifiers. */
export function discoverOperations(spec: Record<string, unknown>, includeTags: readonly string[], excludeTags: readonly string[]): OperationDefinition[] {
  const operations: OperationDefinition[] = [];
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") throw new Error(`Invalid OpenAPI path ${path}`);
    for (const [method, raw] of Object.entries(item)) {
      if (!METHODS.has(method.toLowerCase())) continue;
      const operation = validateOperation(raw, method, path);
      if (!matchesTags(operation.tags, includeTags, excludeTags)) continue;
      const parameters = collectParameters(item, operation);
      const body = operation.requestBody?.content?.["application/json"]?.schema;
      operations.push({ operation_id: operation.operationId, method, path,
        description: `[${method.toUpperCase()}] ${path}\n${operation.summary ?? operation.description ?? ""}`.trim(),
        parameters, request_body: body, body_required: operation.requestBody?.required ?? false,
        responses: operation.responses });
    }
  }
  const ids = new Set<string>();
  for (const operation of operations) {
    if (ids.has(operation.operation_id)) throw new Error(`Duplicate OpenAPI operationId: ${operation.operation_id}`);
    ids.add(operation.operation_id);
  }
  return operations;
}

interface RawOperation {
  operationId: string;
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: ParameterDefinition[];
  requestBody?: { required?: boolean; content?: Record<string, { schema?: SchemaDefinition }> };
  responses?: OperationDefinition["responses"];
}

function validateOperation(raw: unknown, method: string, path: string): RawOperation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Invalid OpenAPI operation ${method.toUpperCase()} ${path}`);
  const operation = raw as RawOperation;
  if (!operation.operationId || typeof operation.operationId !== "string") {
    const cleanPath = path
      .replace(/\{([^}]+)\}/g, "$1")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");
    operation.operationId = `${method.toLowerCase()}_${cleanPath || "root"}`;
  }
  return operation;
}

function matchesTags(tags: string[] | undefined, included: readonly string[], excluded: readonly string[]): boolean {
  if (included.length && !(tags ?? []).some((tag) => included.includes(tag))) return false;
  return !(tags ?? []).some((tag) => excluded.includes(tag));
}

function collectParameters(pathItem: Record<string, unknown>, operation: RawOperation): ParameterDefinition[] {
  const inherited = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
  const local = Array.isArray(operation.parameters) ? operation.parameters : [];
  const parameters = new Map<string, ParameterDefinition>();
  for (const parameter of [...inherited, ...local]) {
    if (!parameter || typeof parameter.name !== "string" || typeof parameter.in !== "string") throw new Error(`Invalid parameter in ${operation.operationId}`);
    if (parameter.in === "header" && parameter.name.toLowerCase() === "authorization") throw new Error(`Authorization parameter is forbidden in ${operation.operationId}`);
    parameters.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return [...parameters.values()];
}
