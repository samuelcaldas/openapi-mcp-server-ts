export interface RouteMap {
  methods: ["GET"];
  pattern: string;
  mcpType: "tool";
}

/**
 * Builds route maps identifying GET operations with query parameters for tool conversion.
 * @param apiSpec OpenAPI specification object.
 * @returns Array of route mapping definitions.
 */
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
