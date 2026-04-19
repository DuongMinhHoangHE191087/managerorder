import { describe, it, expect, vi, beforeEach } from "vitest";

// The handleError function in api.ts uses dynamic require('./errors').
// We need to ensure it resolves correctly. Since api.ts uses isApplicationError
// (imported) AND require('./errors').__ValidationError (dynamic), we mock the
// relative-path require through vi.mock to make both work.
vi.mock("../errors", async () => {
  const actual = await vi.importActual<typeof import("../errors")>("../errors");
  return actual;
});

import { successResponse, errorResponse, handleError } from "../api";

describe("successResponse", () => {
  it("returns success: true with data", () => {
    const result = successResponse({ id: 1, name: "test" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1, name: "test" });
  });

  it("includes meta.timestamp as ISO string", () => {
    const result = successResponse("data");
    expect(result.meta?.timestamp).toBeDefined();
    expect(() => new Date(result.meta!.timestamp)).not.toThrow();
  });

  it("works with null data", () => {
    const result = successResponse(null);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("works with array data", () => {
    const result = successResponse([1, 2, 3]);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it("works with empty object", () => {
    const result = successResponse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });
});

describe("errorResponse", () => {
  it("returns tuple [ApiResponse, statusCode]", () => {
    const [response, statusCode] = errorResponse("NOT_FOUND", "Item not found", 404);
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("NOT_FOUND");
    expect(response.error?.message).toBe("Item not found");
    expect(statusCode).toBe(404);
  });

  it("defaults to 500 status code", () => {
    const [, statusCode] = errorResponse("ERR", "Something");
    expect(statusCode).toBe(500);
  });

  it("includes validation details when provided", () => {
    const details = [{ field: "email", message: "required" }];
    const [response] = errorResponse("VALIDATION", "Invalid", 400, details);
    expect(response.error?.details).toEqual(details);
  });

  it("includes meta.timestamp", () => {
    const [response] = errorResponse("ERR", "msg");
    expect(response.meta?.timestamp).toBeDefined();
  });

  it("omits details when not provided", () => {
    const [response] = errorResponse("ERR", "msg");
    expect(response.error?.details).toBeUndefined();
  });
});

describe("handleError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("handles SyntaxError as 400 PARSE_ERROR", async () => {
    const err = new SyntaxError("Unexpected token");
    const res = handleError(err);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("PARSE_ERROR");
    expect(body.error.message).toBe("Invalid JSON in request body");
  });

  it("handles unknown errors as 500 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = handleError("something weird");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An unexpected error occurred");
    vi.unstubAllEnvs();
  });

  it("shows error details in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = handleError("debug info");
    const body = await res.json();
    expect(body.error.message).toContain("debug info");
    vi.unstubAllEnvs();
  });

  it("logs error to console", () => {
    handleError(new Error("test"));
    expect(console.error).toHaveBeenCalledWith("API Error:", expect.any(Error));
  });

  it("handles Error instances as 500", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = handleError(new Error("generic error"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    vi.unstubAllEnvs();
  });
});
