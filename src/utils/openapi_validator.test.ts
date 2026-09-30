import { describe, it, expect } from "@jest/globals";
import {
  validateOpenApiSpec,
  extractApiStructure,
  findPaginationEndpoints,
} from "./openapi_validator.js";

describe("OpenAPI Validator", () => {
  describe("validateOpenApiSpec", () => {
    it("should validate a valid OpenAPI 3.0 spec", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: { "/test": { get: { responses: { 200: { description: "OK" } } } } },
      };
      expect(validateOpenApiSpec(spec)).toBe(true);
    });

    it("should reject spec with missing openapi field", () => {
      const spec = {
        info: { title: "Test API", version: "1.0.0" },
        paths: { "/test": { get: { responses: { 200: { description: "OK" } } } } },
      };
      expect(validateOpenApiSpec(spec)).toBe(false);
    });

    it("should reject spec with missing info field", () => {
      const spec = {
        openapi: "3.0.0",
        paths: { "/test": { get: { responses: { 200: { description: "OK" } } } } },
      };
      expect(validateOpenApiSpec(spec)).toBe(false);
    });

    it("should reject spec with missing paths field", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
      };
      expect(validateOpenApiSpec(spec)).toBe(false);
    });

    it("should pass spec with non-3.x openapi version but log warning", () => {
      const spec = {
        openapi: "2.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: { "/test": { get: { responses: { 200: { description: "OK" } } } } },
      };
      expect(validateOpenApiSpec(spec)).toBe(true);
    });

    it("should reject invalid non-object input", () => {
      expect(validateOpenApiSpec(null)).toBe(false);
      expect(validateOpenApiSpec(undefined)).toBe(false);
      expect(validateOpenApiSpec("not an object")).toBe(false);
      expect(validateOpenApiSpec([])).toBe(false);
    });
  });

  describe("extractApiStructure", () => {
    it("should extract basic API structure", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0", description: "A test API" },
        paths: {
          "/test": {
            get: {
              operationId: "getTest",
              summary: "Get test",
              description: "Get a test resource",
              responses: { 200: { description: "OK" } },
            },
          },
        },
      };

      const structure = extractApiStructure(spec);

      expect(structure.info.title).toBe("Test API");
      expect(structure.info.version).toBe("1.0.0");
      expect(structure.info.description).toBe("A test API");
      expect(structure.paths["/test"]).toBeDefined();
      expect(structure.paths["/test"].methods.get).toBeDefined();
      expect(structure.paths["/test"].methods.get.operationId).toBe("getTest");
      expect(structure.operations).toHaveLength(1);
      expect(structure.operations[0]).toEqual({
        operationId: "getTest",
        method: "GET",
        path: "/test",
        summary: "Get test",
      });
    });

    it("should extract parameters correctly", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/test/{id}": {
            get: {
              operationId: "getTestById",
              parameters: [
                { name: "id", in: "path", required: true, description: "The test ID" },
                { name: "filter", in: "query", required: false, description: "Filter results" },
              ],
              responses: { 200: { description: "OK" } },
            },
          },
        },
      };

      const structure = extractApiStructure(spec);
      const params = structure.paths["/test/{id}"].methods.get.parameters;

      expect(params).toHaveLength(2);
      expect(params[0]).toEqual({
        name: "id",
        in: "path",
        required: true,
        description: "The test ID",
      });
      expect(params[1]).toEqual({
        name: "filter",
        in: "query",
        required: false,
        description: "Filter results",
      });
    });

    it("should extract request body and responses", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/test": {
            post: {
              operationId: "createTest",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: { type: "object" },
                  },
                },
              },
              responses: {
                201: {
                  description: "Created",
                  content: { "application/json": {} },
                },
                404: {
                  description: "Not Found",
                },
              },
            },
          },
        },
      };

      const structure = extractApiStructure(spec);
      const postMethod = structure.paths["/test"].methods.post;

      expect(postMethod.requestBody).toEqual({
        required: true,
        content_types: ["application/json"],
      });
      expect(postMethod.responses["201"]).toEqual({
        description: "Created",
        content_types: ["application/json"],
      });
      expect(postMethod.responses["404"]).toEqual({
        description: "Not Found",
        content_types: [],
      });
    });

    it("should extract schemas from components", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {},
        components: {
          schemas: {
            Test: {
              type: "object",
              properties: { id: { type: "string" }, name: { type: "string" } },
              required: ["id"],
            },
            Error: {
              type: "object",
              properties: { code: { type: "integer" } },
            },
          },
        },
      };

      const structure = extractApiStructure(spec);
      expect(structure.schemas).toHaveLength(2);

      const testSchema = structure.schemas.find((s) => s.name === "Test");
      expect(testSchema).toEqual({
        name: "Test",
        type: "object",
        properties: 2,
        required: ["id"],
      });

      const errorSchema = structure.schemas.find((s) => s.name === "Error");
      expect(errorSchema).toEqual({
        name: "Error",
        type: "object",
        properties: 1,
        required: [],
      });
    });

    it("should handle missing optional fields safely", () => {
      const spec = {
        openapi: "3.0.0",
        paths: { "/empty": {} },
      };

      const structure = extractApiStructure(spec);
      expect(structure.info.title).toBe("Unknown API");
      expect(structure.info.version).toBe("Unknown");
      expect(structure.info.description).toBe("");
      expect(structure.paths["/empty"].methods).toEqual({});
      expect(structure.operations).toHaveLength(0);
      expect(structure.schemas).toHaveLength(0);
    });
  });

  describe("findPaginationEndpoints", () => {
    it("should detect pagination endpoints by query parameter names", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/tests": {
            get: {
              operationId: "listTests",
              parameters: [{ name: "page", in: "query" }, { name: "limit", in: "query" }],
              responses: { 200: { description: "OK" } },
            },
          },
          "/items": {
            get: {
              operationId: "listItems",
              parameters: [{ name: "offset", in: "query" }, { name: "size", in: "query" }],
              responses: { 200: { description: "OK" } },
            },
          },
          "/users": {
            get: {
              operationId: "listUsers",
              parameters: [{ name: "filter", in: "query" }],
              responses: { 200: { description: "OK" } },
            },
          },
        },
      };

      const endpoints = findPaginationEndpoints(spec);
      const paths = endpoints.map(([path]) => path);

      expect(paths).toContain("/tests");
      expect(paths).toContain("/items");
      expect(paths).not.toContain("/users");
    });

    it("should detect pagination endpoints by array or paginated response structures", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/array-response": {
            get: {
              responses: {
                200: {
                  content: {
                    "application/json": {
                      schema: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
          "/items-property": {
            get: {
              responses: {
                200: {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          items: { type: "array", items: { type: "string" } },
                          total: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "/single-object": {
            get: {
              responses: {
                200: {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { count: { type: "integer" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const endpoints = findPaginationEndpoints(spec);
      const paths = endpoints.map(([path]) => path);

      expect(paths).toContain("/array-response");
      expect(paths).toContain("/items-property");
      expect(paths).not.toContain("/single-object");
    });

    it("should ignore non-GET methods even if they have pagination params", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        paths: {
          "/posts": {
            post: {
              parameters: [{ name: "page", in: "query" }],
              responses: { 201: { description: "Created" } },
            },
          },
          "/updates": {
            put: {
              responses: {
                200: {
                  content: {
                    "application/json": {
                      schema: { type: "array", items: {} },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const endpoints = findPaginationEndpoints(spec);
      expect(endpoints).toHaveLength(0);
    });
  });
});
