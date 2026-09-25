import { isOpenApiDocument } from "./openapi.js";

export function validateOpenApiSpec(spec: unknown): boolean {
  if (!isOpenApiDocument(spec)) return false;
  const info = spec.info;
  return Boolean(spec.openapi?.startsWith("3.") && info && typeof info.title === "string" && typeof info.version === "string" && spec.paths && typeof spec.paths === "object" && !Array.isArray(spec.paths));
}
