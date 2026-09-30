import { describe, it, expect, jest } from "@jest/globals";
import {
  APIError,
  AuthenticationError,
  AuthorizationError,
  ResourceNotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  ConnectionError,
  NetworkError,
  StructuredError,
  extractErrorDetails,
  formatErrorMessage,
  inspectJwtExpiration,
  handleHttpError,
  handleRequestError,
  safeRequest,
} from "./error_handler.js";
import { logger } from "./logger.js";

describe("Error Handler Utilities", () => {
  describe("APIError and Subclasses", () => {
    it("should instantiate base APIError with status and details", () => {
      const err = new APIError(400, "Bad request", { field: "email" });
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Bad request");
      expect(err.details).toEqual({ field: "email" });
      expect(err.toString()).toBe("400: Bad request");
    });

    it("should maintain backwards compatibility with StructuredError", () => {
      const err = new StructuredError("Legacy failure", "ERR_LEGACY", { debug: true });
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe("ERR_LEGACY");
      expect(err.message).toBe("Legacy failure");
      expect(err.details).toEqual({ debug: true });
      expect(err instanceof APIError).toBe(true);
    });

    it("should correctly identify specialized error subclasses", () => {
      expect(new AuthenticationError(401, "Auth") instanceof APIError).toBe(true);
      expect(new AuthorizationError(403, "Forbidden") instanceof APIError).toBe(true);
      expect(new ResourceNotFoundError(404, "Not Found") instanceof APIError).toBe(true);
      expect(new ValidationError(422, "Invalid") instanceof APIError).toBe(true);
      expect(new RateLimitError(429, "Too many") instanceof APIError).toBe(true);
      expect(new ServerError(500, "Server") instanceof APIError).toBe(true);
      expect(new ConnectionError(500, "Timeout") instanceof APIError).toBe(true);
      expect(new NetworkError(500, "Reset") instanceof APIError).toBe(true);
    });
  });

  describe("extractErrorDetails", () => {
    it("should extract details from object response", () => {
      const response = { data: { code: "INVALID_PARAM", message: "Missing id" } };
      expect(extractErrorDetails(response)).toEqual({ code: "INVALID_PARAM", message: "Missing id" });
    });

    it("should parse string JSON data", () => {
      const response = { data: JSON.stringify({ error: "Unauthorized access" }) };
      expect(extractErrorDetails(response)).toEqual({ error: "Unauthorized access" });
    });

    it("should handle plain text response", () => {
      const response = { data: "Service Unavailable" };
      expect(extractErrorDetails(response)).toEqual({ message: "Service Unavailable" });
    });

    it("should handle missing data", () => {
      expect(extractErrorDetails(undefined)).toEqual({});
      expect(extractErrorDetails({})).toEqual({});
    });
  });

  describe("formatErrorMessage", () => {
    it("should format basic error message", () => {
      const msg = formatErrorMessage(404, "Not Found", {});
      expect(msg).toBe("404 Not Found");
    });

    it("should include details.message", () => {
      const msg = formatErrorMessage(400, "Bad Request", { message: "Invalid payload" });
      expect(msg).toBe("400 Bad Request: Invalid payload");
    });

    it("should include details.error", () => {
      const msg = formatErrorMessage(400, "Bad Request", { error: "Schema mismatch" });
      expect(msg).toBe("400 Bad Request: Schema mismatch");
    });

    it("should include troubleshooting advice for 401 Unauthorized", () => {
      const msg = formatErrorMessage(401, "Unauthorized", { message: "Invalid token" });
      expect(msg).toContain("401 Unauthorized: Invalid token");
      expect(msg).toContain("TROUBLESHOOTING: Authentication error");
    });

    it("should include troubleshooting advice for 403 Forbidden", () => {
      const msg = formatErrorMessage(403, "Forbidden", { message: "Access denied" });
      expect(msg).toContain("403 Forbidden: Access denied");
      expect(msg).toContain("TROUBLESHOOTING: Authorization error");
    });
  });

  describe("inspectJwtExpiration", () => {
    it("should ignore non-bearer header", () => {
      expect(() => inspectJwtExpiration("Basic dXNlcjpwYXNz")).not.toThrow();
    });

    it("should warn on expired JWT token", () => {
      const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => logger);
      const expiredPayload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 300 })).toString("base64");
      const token = `header.${expiredPayload}.signature`;

      inspectJwtExpiration(`Bearer ${token}`);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Token expired"));
      warnSpy.mockRestore();
    });

    it("should log debug on valid unexpired JWT token", () => {
      const debugSpy = jest.spyOn(logger, "debug").mockImplementation(() => logger);
      const validPayload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64");
      const token = `header.${validPayload}.signature`;

      inspectJwtExpiration(`Bearer ${token}`);
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining("Token expiration"));
      debugSpy.mockRestore();
    });
  });

  describe("handleHttpError", () => {
    it("should map 401 to AuthenticationError", () => {
      const error = {
        response: { status: 401, statusText: "Unauthorized", data: { message: "Invalid token" } },
      };
      const apiErr = handleHttpError(error);
      expect(apiErr instanceof AuthenticationError).toBe(true);
      expect(apiErr.statusCode).toBe(401);
      expect(apiErr.message).toContain("TROUBLESHOOTING: Authentication error");
    });

    it("should map 403 to AuthorizationError", () => {
      const error = {
        response: { status: 403, statusText: "Forbidden", data: { message: "Insufficient permissions" } },
      };
      const apiErr = handleHttpError(error);
      expect(apiErr instanceof AuthorizationError).toBe(true);
      expect(apiErr.statusCode).toBe(403);
    });

    it("should map 404 to ResourceNotFoundError", () => {
      const error = {
        response: { status: 404, statusText: "Not Found", data: { message: "Item 123 not found" } },
      };
      const apiErr = handleHttpError(error);
      expect(apiErr instanceof ResourceNotFoundError).toBe(true);
      expect(apiErr.statusCode).toBe(404);
    });

    it("should map 422 to ValidationError", () => {
      const error = {
        response: { status: 422, statusText: "Unprocessable Entity", data: { message: "Validation failed" } },
      };
      const apiErr = handleHttpError(error);
      expect(apiErr instanceof ValidationError).toBe(true);
      expect(apiErr.statusCode).toBe(422);
    });

    it("should map 429 to RateLimitError", () => {
      const error = {
        response: { status: 429, statusText: "Too Many Requests", data: { message: "Quota exceeded" } },
      };
      const apiErr = handleHttpError(error);
      expect(apiErr instanceof RateLimitError).toBe(true);
      expect(apiErr.statusCode).toBe(429);
    });

    it("should map 500 to ServerError", () => {
      const error = {
        response: { status: 500, statusText: "Internal Server Error", data: { message: "Crash" } },
      };
      const apiErr = handleHttpError(error);
      expect(apiErr instanceof ServerError).toBe(true);
      expect(apiErr.statusCode).toBe(500);
    });
  });

  describe("handleRequestError", () => {
    it("should handle timeout as ConnectionError", () => {
      const error = { code: "ECONNABORTED", message: "timeout of 5000ms exceeded" };
      const apiErr = handleRequestError(error);
      expect(apiErr instanceof ConnectionError).toBe(true);
      expect(apiErr.message).toContain("Connection timed out");
    });

    it("should handle ECONNREFUSED as NetworkError", () => {
      const error = { code: "ECONNREFUSED", message: "connect ECONNREFUSED 127.0.0.1:8080" };
      const apiErr = handleRequestError(error);
      expect(apiErr instanceof NetworkError).toBe(true);
      expect(apiErr.message).toContain("Connection error");
    });
  });

  describe("safeRequest", () => {
    it("should return result when request succeeds", async () => {
      const result = await safeRequest(async () => ({ ok: true }));
      expect(result).toEqual({ ok: true });
    });

    it("should wrap HTTP response error in typed APIError", async () => {
      await expect(
        safeRequest(async () => {
          const err: any = new Error("Request failed with status code 404");
          err.response = { status: 404, statusText: "Not Found", data: { message: "Missing resource" } };
          throw err;
        })
      ).rejects.toThrow(ResourceNotFoundError);
    });

    it("should wrap network error in NetworkError or ConnectionError", async () => {
      await expect(
        safeRequest(async () => {
          const err: any = new Error("timeout of 1000ms exceeded");
          err.code = "ECONNABORTED";
          throw err;
        })
      ).rejects.toThrow(ConnectionError);
    });
  });
});
