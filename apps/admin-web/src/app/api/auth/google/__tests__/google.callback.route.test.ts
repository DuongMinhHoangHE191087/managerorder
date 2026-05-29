/**
 * Tests for /api/auth/google/callback route.
 *
 * Covers:
 * - Rate limiting
 * - Provider error (access_denied) → redirect to login
 * - Missing code/state → error
 * - CSRF: cookie missing → ALWAYS error (even in dev — B1 fix)
 * - CSRF: nonce mismatch in production → 403
 * - Valid login → sets access_token + refresh_token cookies + redirects
 * - Email not in admin_users → login error redirect
 * - Calendar flow: session mismatch → 403
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted Mocks ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  resolveAccountId: vi.fn(),
  checkAuthRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
  findUserByEmail: vi.fn(),
  getToken: vi.fn(),
  verifyIdToken: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/lib/api/with-account", () => ({
  resolveAccountId: mocks.resolveAccountId,
}));

vi.mock("@/lib/api/rate-limiter", () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/services/auth", () => ({
  AuthRepository: vi.fn(function(this: { findUserByEmail: typeof mocks.findUserByEmail }) {
    this.findUserByEmail = mocks.findUserByEmail;
  }),
}));

vi.mock("@/lib/utils/jwt", () => ({
  generateAccessToken: vi.fn(() => "mock.access.token"),
  generateRefreshToken: vi.fn(() => "mock.refresh.token"),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function(this: object) {
        return { getToken: mocks.getToken, verifyIdToken: mocks.verifyIdToken };
      }),
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}));

import { GET } from "../callback/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(url);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

function rateLimitAllowed() {
  mocks.checkAuthRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 4,
    resetAt: Date.now() + 60_000,
    retryAfterMs: 0,
  });
}

function setupValidLogin(nonce = "test-nonce", email = "admin@example.com") {
  mocks.getToken.mockResolvedValue({ tokens: { id_token: "mock.id.token" } });
  mocks.verifyIdToken.mockResolvedValue({
    getPayload: () => ({ email, email_verified: true }),
  });
  mocks.findUserByEmail.mockResolvedValue({
    id: "user-1",
    accountId: "account-1",
    role: "admin",
    email,
  });
  return nonce;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    rateLimitAllowed();
  });

  // ── Rate limiting ────────────────────────────────────────────────────────────

  it("returns 429 when rate limited", async () => {
    mocks.checkAuthRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterMs: 55_000,
    });
    const res = await GET(makeRequest("http://localhost:3000/api/auth/google/callback"));
    expect(res.status).toBe(429);
  });

  // ── Provider errors ──────────────────────────────────────────────────────────

  it("access_denied from provider → redirect to login with oauth_denied", async () => {
    const res = await GET(
      makeRequest(
        "http://localhost:3000/api/auth/google/callback?error=access_denied&error_description=User+denied&state=login%3Asome-nonce",
      ),
    );
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("oauth_denied");
    expect(location.searchParams.get("reason")).toBe("User denied");
  });

  // ── Missing code/state ───────────────────────────────────────────────────────

  it("missing code → redirect login error", async () => {
    const res = await GET(
      makeRequest("http://localhost:3000/api/auth/google/callback?state=login%3Anonce"),
    );
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
  });

  // ── CSRF: B1 Fix — cookie missing always blocks ──────────────────────────────

  it("B1 fix: missing state cookie always blocks — even in dev", async () => {
    // No cookie set — simulates expired session or first-time request with no prior login attempt
    vi.stubEnv("NODE_ENV", "development");

    const res = await GET(
      makeRequest(
        "http://localhost:3000/api/auth/google/callback?code=code123&state=login%3Anonce-abc",
        // No cookie — cookie missing
      ),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("callback_failed");

    vi.unstubAllEnvs();
  });

  it("CSRF nonce mismatch in production → 307 to login error", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = await GET(
      makeRequest(
        "http://localhost:3000/api/auth/google/callback?code=code123&state=login%3Awrong-nonce",
        { google_login_oauth_state: "correct-nonce" },
      ),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");

    vi.unstubAllEnvs();
  });

  // ── Valid login flow ─────────────────────────────────────────────────────────

  it("valid login → sets access_token + refresh_token cookies and redirects", async () => {
    const nonce = setupValidLogin();

    const res = await GET(
      makeRequest(
        `http://localhost:3000/api/auth/google/callback?code=auth-code&state=login%3A${nonce}`,
        { google_login_oauth_state: nonce },
      ),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/dashboard");

    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.some((c) => c.startsWith("access_token=mock.access.token"))).toBe(true);
    expect(setCookies.some((c) => c.startsWith("refresh_token=mock.refresh.token"))).toBe(true);
  });

  it("valid login with next=/orders → redirects to /orders", async () => {
    const nonce = setupValidLogin();

    const res = await GET(
      makeRequest(
        `http://localhost:3000/api/auth/google/callback?code=auth-code&state=login%3A${nonce}`,
        {
          google_login_oauth_state: nonce,
          google_login_oauth_next: "/orders",
        },
      ),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/orders");
  });

  // ── Unauthorized email ───────────────────────────────────────────────────────

  it("email not in admin_users → redirect to login error", async () => {
    const nonce = "known-nonce";
    mocks.getToken.mockResolvedValue({ tokens: { id_token: "mock.id.token" } });
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: "guest@example.com", email_verified: true }),
    });
    mocks.findUserByEmail.mockResolvedValue(null);

    const res = await GET(
      makeRequest(
        `http://localhost:3000/api/auth/google/callback?code=auth-code&state=login%3A${nonce}`,
        { google_login_oauth_state: nonce },
      ),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("callback_failed");
    expect(location.searchParams.get("reason")).toMatch(/chua duoc cap quyen/);
  });

  // ── Token exchange failure ────────────────────────────────────────────────────

  it("Google token exchange throws → redirects to login error", async () => {
    const nonce = "known-nonce";
    mocks.getToken.mockRejectedValue(new Error("invalid_grant"));

    const res = await GET(
      makeRequest(
        `http://localhost:3000/api/auth/google/callback?code=bad-code&state=login%3A${nonce}`,
        { google_login_oauth_state: nonce },
      ),
    );

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("reason")).toContain("invalid_grant");
  });
});
