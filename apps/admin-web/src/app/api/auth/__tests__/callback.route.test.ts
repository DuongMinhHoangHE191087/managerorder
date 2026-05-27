import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn();
  const getUser = vi.fn();
  const findUserByEmail = vi.fn();

  return {
    exchangeCodeForSession,
    getUser,
    findUserByEmail,
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: authMocks.exchangeCodeForSession,
      getUser: authMocks.getUser,
    },
  })),
}));

vi.mock("@/lib/services/auth", () => ({
  AuthRepository: class {
    findUserByEmail = authMocks.findUserByEmail;
  },
}));

import { GET } from "../callback/route";

function makeRequest(url: string) {
  return new NextRequest(url);
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redirects provider errors back to login", async () => {
    const res = await GET(
      makeRequest(
        "http://localhost:3000/api/auth/callback?error=access_denied&error_description=Denied%20by%20provider"
      )
    );

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("oauth_denied");
    expect(location.searchParams.get("reason")).toBe("Denied by provider");
  });

  it("accepts a valid admin Google account and redirects to next", async () => {
    vi.mocked(authMocks.exchangeCodeForSession).mockResolvedValue({ error: null });
    vi.mocked(authMocks.getUser).mockResolvedValue({
      data: { user: { email: "ADMIN@EXAMPLE.COM" } },
      error: null,
    });
    vi.mocked(authMocks.findUserByEmail).mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });

    const res = await GET(
      makeRequest("http://localhost:3000/api/auth/callback?code=auth-code-123&redirect=/orders")
    );

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/orders");
    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code-123");
    expect(authMocks.findUserByEmail).toHaveBeenCalledWith("admin@example.com");
  });

  it("rejects Google accounts that are not in admin_users", async () => {
    vi.mocked(authMocks.exchangeCodeForSession).mockResolvedValue({ error: null });
    vi.mocked(authMocks.getUser).mockResolvedValue({
      data: { user: { email: "guest@example.com" } },
      error: null,
    });
    vi.mocked(authMocks.findUserByEmail).mockResolvedValue(null);

    const res = await GET(
      makeRequest("http://localhost:3000/api/auth/callback?code=auth-code-123&next=/dashboard")
    );

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("callback_failed");
    expect(location.searchParams.get("reason")).toBe(
      "Tai khoan Google nay chua duoc cap quyen truy cap admin."
    );
  });
});
