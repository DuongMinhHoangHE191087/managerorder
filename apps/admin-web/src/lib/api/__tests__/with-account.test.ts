import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock heavy dependencies before imports
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/utils/jwt", () => ({
  verifyToken: vi.fn(),
}));

import { withAccount } from "../with-account";
import { verifyToken } from "@/lib/utils/jwt";
// import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function makeRequest(
  url = "http://localhost/api/test",
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(url, { headers });
}

describe("withAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env
    delete process.env.TEST_ACCOUNT_ID;
    delete process.env.NEXT_PUBLIC_TEST_ACCOUNT_ID;
  });

  it("returns 401 when no auth is available", async () => {
    const handler = vi.fn();
    const wrapped = withAccount(handler);
    const req = makeRequest();
    const res = await wrapped(req, { params: {} });
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("resolves accountId from JWT header when JWT matches", async () => {
    vi.mocked(verifyToken).mockReturnValue({
      sub: "u1",
      accountId: "acc-jwt",
      role: "admin",
      email: "a@b.com",
    });

    const handler = vi.fn().mockImplementation((_req, ctx) => {
      return new Response(JSON.stringify({ accountId: ctx.accountId }));
    });

    const wrapped = withAccount(handler);
    const req = makeRequest("http://localhost/api/test", {
      "x-account-id": "acc-jwt",
      authorization: "Bearer valid-token",
    });

    await wrapped(req, { params: {} });
    expect(handler).toHaveBeenCalled();
    const callCtx = handler.mock.calls[0][1];
    expect(callCtx.accountId).toBe("acc-jwt");
  });

  it("rejects header accountId when JWT does not match", async () => {
    vi.mocked(verifyToken).mockReturnValue({
      sub: "u1",
      accountId: "acc-real",
      role: "admin",
      email: "a@b.com",
    });

    const handler = vi.fn();
    const wrapped = withAccount(handler);
    const req = makeRequest("http://localhost/api/test", {
      "x-account-id": "acc-spoofed",
      authorization: "Bearer some-token",
    });

    // Since JWT accountId != header accountId, it falls through to session
    // Session mock not set, so it should return 401
    const res = await wrapped(req, { params: {} });
    expect(res.status).toBe(401);
  });

  it("rejects when JWT verification throws", async () => {
    vi.mocked(verifyToken).mockImplementation(() => {
      throw new Error("invalid token");
    });

    const handler = vi.fn();
    const wrapped = withAccount(handler);
    const req = makeRequest("http://localhost/api/test", {
      "x-account-id": "acc-1",
      authorization: "Bearer bad-token",
    });

    const res = await wrapped(req, { params: {} });
    expect(res.status).toBe(401);
  });

  it("passes params through to handler", async () => {
    vi.mocked(verifyToken).mockReturnValue({
      sub: "u1",
      accountId: "acc-1",
      role: "admin",
      email: "a@b.com",
    });

    const handler = vi.fn().mockImplementation((_req, ctx) => {
      return new Response(JSON.stringify(ctx.params));
    });

    const wrapped = withAccount(handler);
    const req = makeRequest("http://localhost/api/test", {
      "x-account-id": "acc-1",
      authorization: "Bearer token",
    });

    await wrapped(req, { params: { id: "123" } });
    expect(handler.mock.calls[0][1].params).toEqual({ id: "123" });
  });
});
