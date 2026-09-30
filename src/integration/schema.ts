import { z } from "zod";

export interface SchemaDefinition {
  type?: string;
  enum?: string[];
  items?: SchemaDefinition;
  properties?: Record<string, SchemaDefinition>;
  required?: string[];
}

export interface ParameterDefinition {
  name: string;
  in: string;
  required?: boolean;
  schema?: SchemaDefinition;
}

/** Convert an OpenAPI schema to a Zod validator. */
export function getZodType(schema?: SchemaDefinition): z.ZodTypeAny {
  if (!schema) return z.any();
  if (schema.type === "string") return schema.enum?.length ? z.enum(schema.enum as [string, ...string[]]) : z.string();
  if (schema.type === "integer" || schema.type === "number") return z.number();
  if (schema.type === "boolean") return z.boolean();
  if (schema.type === "array") return z.array(getZodType(schema.items));
  if (schema.type !== "object" && !schema.properties) return z.any();
  const fields: Record<string, z.ZodTypeAny> = {};
  for (const [name, definition] of Object.entries(schema.properties ?? {})) {
    const field = getZodType(definition);
    fields[name] = schema.required?.includes(name) ? field : field.optional();
  }
  return z.object(fields);
}

/** Build the MCP and direct-execution input validators for an operation. */
export function buildInputSchema(parameters: ParameterDefinition[], body?: SchemaDefinition, bodyRequired = false): Record<string, z.ZodTypeAny> {
  const fields: Record<string, z.ZodTypeAny> = {};
  for (const parameter of parameters) {
    const field = getZodType(parameter.schema);
    fields[parameter.name] = parameter.required ? field : field.optional();
  }
  if (body) fields.body = bodyRequired ? getZodType(body) : getZodType(body).optional();
  return fields;
}
