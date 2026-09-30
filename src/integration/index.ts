import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { AxiosInstance } from "axios";
import type { CredentialProvider } from "../auth/token_exchange.js";
import { createHttpClient, validateUrlForSpec } from "../utils/httpClient.js";
import { parseOpenApiSpec } from "../utils/openapi.js";
import { validateOpenApiSpec } from "../utils/openapi_validator.js";
import { discoverOperations, type OperationDefinition } from "./discovery.js";
import { executeOperation, type ExecutionDependencies } from "./execution.js";
import { buildInputSchema } from "./schema.js";

export interface NetworkPolicy {
  allow_private_networks?: boolean;
  allow_insecure_http?: boolean;
  allowed_spec_dirs?: string[];
}

export interface PrepareOpenApiIntegrationOptions {
  source: object | string;
  base_url: string;
  include_tags?: string[];
  exclude_tags?: string[];
  validate_output?: boolean;
  credential_provider?: CredentialProvider;
  network_policy?: NetworkPolicy;
  http_client?: Pick<AxiosInstance, "request">;
}

export interface OperationDescriptor {
  operation_id: string;
  method: string;
  path: string;
}

export interface OperationResult {
  status: number;
  data: unknown;
}

export interface OperationContext {
  auth_info?: AuthInfo;
}

export interface OpenApiIntegration {
  /** List the tagged operations exposed by this integration. */
  list_operations(): readonly OperationDescriptor[];
  /** Execute an operation; throws on invalid input, credentials, network, or response. */
  execute_operation(operation_id: string, arguments_: Record<string, unknown>, context?: OperationContext): Promise<OperationResult>;
  /** Register tools on an existing MCP server; prefix names when composing integrations. */
  register_tools(server: McpServer, options?: { prefix?: string }): void;
}

/** Prepare a reusable OpenAPI integration without starting a listener. */
export async function prepare_openapi_integration(options: PrepareOpenApiIntegrationOptions): Promise<OpenApiIntegration> {
  if (!options || !options.source) throw new Error("OpenAPI source is required");
  if (!options.base_url || !options.base_url.trim()) throw new Error("OpenAPI base_url is required");
  const policy = options.network_policy ?? {};
  await validateUrlForSpec(options.base_url, {
    allowPrivateNetworks: policy.allow_private_networks ?? false,
    allowHttp: policy.allow_insecure_http ?? false,
  });
  const source = options.source as Parameters<typeof parseOpenApiSpec>[0];
  const spec = await parseOpenApiSpec(source, policy.allow_private_networks, policy.allow_insecure_http, policy.allowed_spec_dirs);
  if (!validateOpenApiSpec(spec)) throw new Error("Invalid OpenAPI specification: expected OpenAPI 3.x info and paths");
  const operations = structuredClone(discoverOperations(spec, options.include_tags ?? [], options.exclude_tags ?? []));
  const client = options.http_client ?? createHttpClient(policy.allow_private_networks ?? false, policy.allow_insecure_http ?? false);
  const dependencies: ExecutionDependencies = {
    client, base_url: options.base_url, credential_provider: options.credential_provider,
    validate_output: options.validate_output ?? true,
  };
  return new PreparedIntegration(operations, dependencies);
}

/** Construct a synchronous compatibility integration from an already prepared spec and client. */
export function createPreparedIntegration(spec: Record<string, unknown>, dependencies: ExecutionDependencies, includeTags: string[] = [], excludeTags: string[] = []): OpenApiIntegration {
  const operations = discoverOperations(spec, includeTags, excludeTags);
  return new PreparedIntegration(operations, dependencies);
}

class PreparedIntegration implements OpenApiIntegration {
  constructor(private readonly operations: readonly OperationDefinition[], private readonly dependencies: ExecutionDependencies) {}

  list_operations(): readonly OperationDescriptor[] {
    return this.operations.map(({ operation_id, method, path }) => ({ operation_id, method, path }));
  }

  async execute_operation(operation_id: string, arguments_: Record<string, unknown>, context?: OperationContext): Promise<OperationResult> {
    const operation = this.operations.find((entry) => entry.operation_id === operation_id);
    if (!operation) throw new Error(`Unknown OpenAPI operation: ${operation_id}`);
    return executeOperation(operation, arguments_, context, this.dependencies);
  }

  register_tools(server: McpServer, options: { prefix?: string } = {}): void {
    if (!server) throw new Error("An existing MCP server is required");
    const prefix = options.prefix ? `${options.prefix}_` : "";
    for (const operation of this.operations) this.registerOperation(server, operation, prefix);
  }

  private registerOperation(server: McpServer, operation: OperationDefinition, prefix: string): void {
    const name = `${prefix}${operation.operation_id}`;
    const schema = buildInputSchema(operation.parameters, operation.request_body, operation.body_required);
    server.tool(name, operation.description, schema, async (args, extra) => {
      try {
        const result = await this.execute_operation(operation.operation_id, args, { auth_info: extra.authInfo });
        return { content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Operation failed";
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    });
  }
}
