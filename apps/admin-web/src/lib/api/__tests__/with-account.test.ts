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
    delete process.env.E2E_MOCK_SESSION;
  });

  it("returns 401 when no auth is available", async () => {
    const handler = vi.fn();
    const wrapped = withAccount(handler);
    const req = makeRequest();
    const res = await wrapped(req, { params: Promise.resolve({}) });
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

    await wrapped(req, { params: Promise.resolve({}) });
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
    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("rejects stale E2E mock JWT when mock mode is disabled", async () => {
    vi.mocked(verifyToken).mockReturnValue({
      sub: "00000000-0000-4000-8000-000000000002",
      accountId: "00000000-0000-4000-8000-000000000001",
      role: "admin_owner",
      email: "e2e-mock@managerorder.local",
    });

    const handler = vi.fn();
    const wrapped = withAccount(handler);
    const req = makeRequest("http://localhost/api/test", {
      "x-account-id": "00000000-0000-4000-8000-000000000001",
      authorization: "Bearer stale-mock-token",
    });

    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows explicit E2E mock header only when mock mode is enabled", async () => {
    process.env.E2E_MOCK_SESSION = "1";
    const handler = vi.fn().mockImplementation((_req, ctx) => {
      return new Response(JSON.stringify({ accountId: ctx.accountId }));
    });

    const wrapped = withAccount(handler);
    const req = makeRequest("http://localhost/api/test", {
      "x-e2e-mock-session": "1",
      "x-account-id": "00000000-0000-4000-8000-000000000001",
    });

    await wrapped(req, { params: Promise.resolve({}) });
    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][1].accountId).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("rejects when JWT verification throws", async () => {
    vi.mocked(verifyToken).mockImplementation(() => {
      throw new Error("invalid token");
    });

    const handler = vi.fn();
    const wrapped = withAccount(handler);
    const req = makeRequest("http://localhost/api/test", {
      "x-account-id": "00000000-0000-4000-8000-000000000016",
      authorization: "Bearer bad-token",
    });

    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("passes params through to handler", async () => {
    vi.mocked(verifyToken).mockReturnValue({
      sub: "u1",
      accountId: "00000000-0000-4000-8000-000000000016",
      role: "admin",
      email: "a@b.com",
    });

    const handler = vi.fn().mockImplementation(async (_req, ctx) => {
      return new Response(JSON.stringify(await ctx.params));
    });

    const wrapped = withAccount<{ id: string }>(handler);
    const req = makeRequest("http://localhost/api/test", {
      "x-account-id": "00000000-0000-4000-8000-000000000016",
      authorization: "Bearer token",
    });

    await wrapped(req, { params: Promise.resolve({ id: "123" }) });
    await expect(handler.mock.calls[0][1].params).resolves.toEqual({ id: "123" });
  });
});
