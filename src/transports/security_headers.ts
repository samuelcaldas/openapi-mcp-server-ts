import type { Request, Response, NextFunction, RequestHandler } from "express";

export function createHostValidator(allowedHosts: string[]): RequestHandler {
  const normalizedAllowed = allowedHosts.map(normalizeHost);
  if (normalizedAllowed.length === 0) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawHost = req.headers.host;
    if (!rawHost) {
      sendForbidden(res, "Missing Host header");
      return;
    }
    const host = normalizeHost(rawHost);
    if (!normalizedAllowed.includes(host)) {
      sendForbidden(res, "Invalid Host header");
      return;
    }
    next();
  };
}

export function createOriginValidator(allowedOrigins: string[]): RequestHandler {
  const normalizedAllowed = allowedOrigins.map((o) => o.trim()).filter(Boolean);
  if (normalizedAllowed.length === 0 || normalizedAllowed.includes("*")) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }
    if (!normalizedAllowed.includes(origin)) {
      sendForbidden(res, "Invalid Origin header");
      return;
    }
    next();
  };
}

function normalizeHost(host: string): string {
  const trimmed = host.trim().toLowerCase();
  const colonIndex = trimmed.lastIndexOf(":");
  if (colonIndex > 0 && !trimmed.endsWith("]")) {
    return trimmed.slice(0, colonIndex);
  }
  return trimmed;
}

function sendForbidden(res: Response, message: string): void {
  res.status(403).json({
    jsonrpc: "2.0",
    error: { code: -32003, message: `Forbidden: ${message}` },
    id: null,
  });
}
