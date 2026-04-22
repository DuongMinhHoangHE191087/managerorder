import { describe, it, expect } from "vitest";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../../api/with-error-handler";

// ============================================
// createErrorResponse
// ============================================

describe("createErrorResponse", () => {
  it("returns correct error shape and status", async () => {
    const res = createErrorResponse("Not found", "NOT_FOUND", 404);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.message).toBe("Not found");
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("defaults to 400 status", async () => {
    const res = createErrorResponse("Bad request", "BAD_REQUEST");
    expect(res.status).toBe(400);
  });

  it("includes details when provided", async () => {
    const details = { name: ["required"], email: ["invalid format"] };
    const res = createErrorResponse("Validation", "VALIDATION", 422, details);
    const body = await res.json();
    expect(body.error.details).toEqual(details);
  });

  it("omits details when empty object", async () => {
    const res = createErrorResponse("Error", "ERR", 400, {});
    const body = await res.json();
    expect(body.error.details).toBeUndefined();
  });

  it("omits details when not provided", async () => {
    const res = createErrorResponse("Error", "ERR", 400);
    const body = await res.json();
    expect(body.error.details).toBeUndefined();
  });
});

// ============================================
// createSuccessResponse
// ============================================

describe("createSuccessResponse", () => {
  it("returns data in response body", async () => {
    const res = createSuccessResponse({ id: 1, name: "Test" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual({ id: 1, name: "Test" });
  });

  it("supports custom status", async () => {
    const res = createSuccessResponse({ created: true }, { status: 201 });
    expect(res.status).toBe(201);
  });

  it("includes meta when provided", async () => {
    const meta = { count: 10, page: 1 };
    const res = createSuccessResponse([1, 2, 3], { meta });
    const body = await res.json();
    expect(body.meta).toEqual(meta);
  });

  it("omits meta when not provided", async () => {
    const res = createSuccessResponse("hello");
    const body = await res.json();
    expect(body.meta).toBeUndefined();
  });

  it("handles null data", async () => {
    const res = createSuccessResponse(null);
    const body = await res.json();
    expect(body.data).toBeNull();
  });

  it("handles array data", async () => {
    const res = createSuccessResponse([{ id: 1 }, { id: 2 }]);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });
});
