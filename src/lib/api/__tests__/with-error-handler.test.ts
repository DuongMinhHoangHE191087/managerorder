/**
 * withErrorHandler — API Middleware Unit Tests
 * Tests error catching for Zod, ApplicationError, generic Error, and unknown types
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// We test createErrorResponse and createSuccessResponse as pure functions
import { createErrorResponse, createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";

describe("createErrorResponse", () => {
  it("returns JSON error with default status 400", async () => {
    const res = createErrorResponse("Bad input", "BAD_INPUT");
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.message).toBe("Bad input");
    expect(body.error.code).toBe("BAD_INPUT");
  });

  it("returns custom status code", async () => {
    const res = createErrorResponse("Not found", "NOT_FOUND", 404);
    expect(res.status).toBe(404);
  });

  it("includes details when provided", async () => {
    const res = createErrorResponse("Error", "ERR", 400, { field: "email" });
    const body = await res.json();
    expect(body.error.details).toEqual({ field: "email" });
  });

  it("omits details when empty object", async () => {
    const res = createErrorResponse("Error", "ERR", 400, {});
    const body = await res.json();
    expect(body.error.details).toBeUndefined();
  });
});

describe("createSuccessResponse", () => {
  it("returns JSON data with default status 200", async () => {
    const res = createSuccessResponse({ name: "test" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual({ name: "test" });
  });

  it("supports custom status code", async () => {
    const res = createSuccessResponse({ id: 1 }, { status: 201 });
    expect(res.status).toBe(201);
  });

  it("includes meta when provided", async () => {
    const res = createSuccessResponse([], { meta: { total: 100, page: 1 } });
    const body = await res.json();
    expect(body.meta).toEqual({ total: 100, page: 1 });
  });

  it("omits meta when not provided", async () => {
    const res = createSuccessResponse("ok");
    const body = await res.json();
    expect(body.meta).toBeUndefined();
  });
});

describe("withErrorHandler", () => {
  function makeRequest(): NextRequest {
    return new NextRequest("http://localhost:3000/api/test");
  }

  it("passes through successful handler response", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    );
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(makeRequest(), {});
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("catches ZodError and returns 400 VALIDATION_ERROR", async () => {
    const schema = z.object({ name: z.string() });
    const handler = vi.fn().mockImplementation(async () => {
      schema.parse({}); // will throw ZodError
    });
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(makeRequest(), {});
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });

  it("catches generic Error and returns 500", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("Something broke"));
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(makeRequest(), {});
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).toBe("Something broke");
  });

  it("catches Error with custom status", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      throw Object.assign(new Error("Not found"), { status: 404 });
    });
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(makeRequest(), {});
    // withErrorHandler doesn't read .status from generic Error — it falls through to 500
    expect(res.status).toBe(500);
  });

  it("catches unknown error type and returns generic message", async () => {
    const handler = vi.fn().mockRejectedValue("string error");
    const wrapped = withErrorHandler(handler);
    const res = await wrapped(makeRequest(), {});
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.message).toContain("Lỗi máy chủ");
  });
});
