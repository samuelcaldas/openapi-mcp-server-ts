import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import { createHostValidator, createOriginValidator } from "./security_headers.js";

describe("Security Headers Validators", () => {
  function createMockRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { res: { status, json } as unknown as Response, status, json };
  }

  describe("Host Validator", () => {
    it("allows any host if allowedHosts is empty", () => {
      const validator = createHostValidator([]);
      const next = jest.fn();
      validator({ headers: { host: "random.com" } } as Request, {} as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("allows matching host without port or with port", () => {
      const validator = createHostValidator(["api.example.com", "localhost"]);
      const next = jest.fn();
      validator({ headers: { host: "api.example.com:8000" } } as Request, {} as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("blocks non-matching host with 403", () => {
      const validator = createHostValidator(["api.example.com"]);
      const { res, status } = createMockRes();
      const next = jest.fn();
      validator({ headers: { host: "evil.com" } } as Request, res, next);
      expect(status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Origin Validator", () => {
    it("allows requests without Origin header", () => {
      const validator = createOriginValidator(["https://trusted.com"]);
      const next = jest.fn();
      validator({ headers: {} } as Request, {} as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("allows matching Origin", () => {
      const validator = createOriginValidator(["https://trusted.com"]);
      const next = jest.fn();
      validator({ headers: { origin: "https://trusted.com" } } as Request, {} as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("blocks non-matching Origin with 403", () => {
      const validator = createOriginValidator(["https://trusted.com"]);
      const { res, status } = createMockRes();
      const next = jest.fn();
      validator({ headers: { origin: "https://evil.com" } } as Request, res, next);
      expect(status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
