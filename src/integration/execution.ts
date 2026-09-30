import { z } from "zod";
import type { AxiosInstance } from "axios";
import type { CredentialProvider } from "../auth/token_exchange.js";
import type { OperationContext, OperationResult } from "./index.js";
import type { OperationDefinition } from "./discovery.js";
import { buildInputSchema, getZodType } from "./schema.js";
import { metrics } from "../metrics/index.js";

export interface ExecutionDependencies {
  client: Pick<AxiosInstance, "request">;
  base_url: string;
  credential_provider?: CredentialProvider;
  validate_output: boolean;
}

/** Validate inputs and execute a discovered operation against the configured API. */
export async function executeOperation(operation: OperationDefinition, args: Record<string, unknown>, context: OperationContext | undefined, dependencies: ExecutionDependencies): Promise<OperationResult> {
  const startTime = Date.now();
  try {
    const schema = buildInputSchema(operation.parameters, operation.request_body, operation.body_required);
    const parsed = z.object(schema).safeParse(args);
    if (!parsed.success) throw new Error(`Invalid arguments for ${operation.operation_id}: ${parsed.error.message}`);
    const headers = await resolveHeaders(context, dependencies);
    const { url, params } = populateRequest(operation, parsed.data, dependencies.base_url, headers);
    let response: { status: number; data: unknown };
    try {
      response = await dependencies.client.request({ url, params, headers, data: parsed.data.body, method: operation.method.toUpperCase() });
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      // Upstream errors may contain Authorization headers or reflected credentials.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`Operation ${operation.operation_id} failed${status ? ` (HTTP ${status})` : " (network request)"}`);
    }
    const data = dependencies.validate_output ? validateResponse(response, operation) : response.data;
    metrics.recordToolUsage(operation.operation_id, Date.now() - startTime, true);
    return { status: response.status, data };
  } catch (error) {
    metrics.recordToolUsage(operation.operation_id, Date.now() - startTime, false, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function resolveHeaders(context: OperationContext | undefined, dependencies: ExecutionDependencies): Promise<Record<string, string>> {
  if (!dependencies.credential_provider) return {};
  try {
    return await dependencies.credential_provider.resolveAuthHeaders(context?.auth_info);
  } catch (error) {
    // Credential provider failures can embed user or service tokens.
    // eslint-disable-next-line preserve-caught-error
    throw new Error("Unable to obtain destination API credentials");
  }
}

function populateRequest(operation: OperationDefinition, args: Record<string, unknown>, baseUrl: string, headers: Record<string, string>): { url: string; params: Record<string, unknown> } {
  let url = `${baseUrl.replace(/\/$/, "")}${operation.path}`;
  const params: Record<string, unknown> = {};
  for (const parameter of operation.parameters) {
    const value = args[parameter.name];
    if (value === undefined) continue;
    if (parameter.in === "path") url = url.replace(`{${parameter.name}}`, encodeURIComponent(String(value)));
    if (parameter.in === "query") params[parameter.name] = value;
    if (parameter.in === "header") headers[parameter.name] = String(value);
    if (parameter.in === "cookie") headers.Cookie = `${headers.Cookie ? `${headers.Cookie}; ` : ""}${parameter.name}=${encodeURIComponent(String(value))}`;
  }
  return { url, params };
}

function validateResponse(response: OperationResult, operation: OperationDefinition): unknown {
  const specification = operation.responses?.[String(response.status)] ?? operation.responses?.default;
  const schema = specification?.content?.["application/json"]?.schema;
  if (!schema) return response.data;
  const result = getZodType(schema).safeParse(response.data);
  if (!result.success) throw new Error(`Response validation failed for ${operation.operation_id}`);
  return result.data;
}
