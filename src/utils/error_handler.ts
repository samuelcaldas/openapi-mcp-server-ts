import { logger } from "./logger.js";

export class APIError extends Error {
  public readonly statusCode: number;
  public readonly details: any;
  public readonly originalError?: unknown;

  constructor(statusCode: number, message: string, details: any = null, originalError?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details ?? {};
    this.originalError = originalError;
  }

  override toString(): string {
    return `${this.statusCode}: ${this.message}`;
  }
}

export class AuthenticationError extends APIError {}
export class AuthorizationError extends APIError {}
export class ResourceNotFoundError extends APIError {}
export class ValidationError extends APIError {}
export class RateLimitError extends APIError {}
export class ServerError extends APIError {}
export class ConnectionError extends APIError {}
export class NetworkError extends APIError {}

/** Backwards-compatible StructuredError */
export class StructuredError extends APIError {
  public readonly code: string;

  constructor(message: string, code: string, details?: any) {
    super(500, message, details);
    this.name = "StructuredError";
    this.code = code;
  }
}

export function extractErrorDetails(response?: { data?: unknown; headers?: Record<string, unknown> }): Record<string, any> {
  if (!response?.data) return {};
  if (typeof response.data === "object" && !Array.isArray(response.data)) {
    return response.data as Record<string, any>;
  }
  if (typeof response.data === "string") {
    try {
      return JSON.parse(response.data);
    } catch {
      return { message: response.data };
    }
  }
  return {};
}

export function formatErrorMessage(statusCode: number, reason: string, details: Record<string, any>): string {
  let message = `${statusCode} ${reason || "Error"}`;

  if (details) {
    if (typeof details.message === "string" && details.message) {
      message += `: ${details.message}`;
    } else if (typeof details.error === "string" && details.error) {
      message += `: ${details.error}`;
    } else if (details.error && typeof details.error === "object" && typeof details.error.message === "string") {
      message += `: ${details.error.message}`;
    }
  }

  if (statusCode === 401) {
    message += "\n\nTROUBLESHOOTING: Authentication error. Please check your credentials or ensure your token is valid. You may need to refresh your authentication tokens.";
  } else if (statusCode === 403) {
    message += "\n\nTROUBLESHOOTING: Authorization error. You don't have permission to access this resource. Please check your IAM permissions or API key scope.";
  }

  return message;
}

export function inspectJwtExpiration(authHeader?: string): void {
  if (!authHeader || typeof authHeader !== "string") return;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return;

  const token = authHeader.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return;

  try {
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = payload.length % 4;
    if (padding) {
      payload += "=".repeat(4 - padding);
    }
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const payloadData = JSON.parse(decoded);

    if (typeof payloadData.exp === "number") {
      const expTime = payloadData.exp;
      const now = Math.floor(Date.now() / 1000);
      const remaining = expTime - now;

      if (remaining < 0) {
        logger.warn(`Token expired ${Math.abs(remaining)} seconds ago`);
      } else {
        logger.debug(`Token expiration: ${expTime}, Current time: ${now}, Remaining: ${remaining}s`);
      }
    }
  } catch (err) {
    logger.debug(`Could not inspect JWT token: ${err}`);
  }
}

export function handleHttpError(error: any): APIError {
  const response = error?.response;
  const statusCode = response?.status || 500;
  const reason = response?.statusText || "HTTP Error";
  const details = extractErrorDetails(response);

  if (statusCode === 401) {
    const authHeader = error?.config?.headers?.Authorization || error?.config?.headers?.authorization;
    inspectJwtExpiration(authHeader);
  }

  const message = formatErrorMessage(statusCode, reason, details);

  switch (statusCode) {
    case 400:
    case 422:
      return new ValidationError(statusCode, message, details, error);
    case 401:
      return new AuthenticationError(statusCode, message, details, error);
    case 403:
      return new AuthorizationError(statusCode, message, details, error);
    case 404:
      return new ResourceNotFoundError(statusCode, message, details, error);
    case 429:
      return new RateLimitError(statusCode, message, details, error);
    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(statusCode, message, details, error);
    default:
      return new APIError(statusCode, message, details, error);
  }
}

export function handleRequestError(error: any): APIError {
  const code = error?.code;
  let message = `Request error: ${error?.message || String(error)}`;

  if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
    message = "Connection timed out: The server took too long to respond";
    return new ConnectionError(500, message, null, error);
  }

  if (code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
    message = `Connection error: Could not connect to the server: ${error?.message || code}`;
    return new NetworkError(500, message, null, error);
  }

  return new NetworkError(500, message, null, error);
}

export async function safeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  try {
    return await requestFn();
  } catch (error: any) {
    if (error?.response) {
      throw handleHttpError(error);
    }
    throw handleRequestError(error);
  }
}
