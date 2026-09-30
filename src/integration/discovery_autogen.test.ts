import { describe, it, expect } from "@jest/globals";
import { discoverOperations } from "./discovery.js";

describe("Operation Discovery and Auto-generated OperationId", () => {
  it("auto-generates operationId when omitted in spec", () => {
    const spec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/users": {
          get: {
            summary: "List users",
            responses: { "200": { description: "OK" } },
          },
        },
        "/users/{userId}/posts": {
          post: {
            summary: "Create post",
            responses: { "201": { description: "Created" } },
          },
        },
      },
    };

    const operations = discoverOperations(spec, [], []);
    expect(operations.length).toBe(2);

    const getOp = operations.find((op) => op.path === "/users");
    expect(getOp).toBeDefined();
    expect(getOp?.operation_id).toBe("get_users");

    const postOp = operations.find((op) => op.path === "/users/{userId}/posts");
    expect(postOp).toBeDefined();
    expect(postOp?.operation_id).toBe("post_users_userId_posts");
  });
});
