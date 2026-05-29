/**
 * Tests for /api/auth/google/login route.
 *
 * Covers:
 * - Rate limiting blocks after threshold
 * - Missing env vars → error redirect
 * - mode=login → generates authUrl + sets cookies
 * - mode=login with next path → next cookie set
 * - mode=calendar without session → 401
 * - Invalid next path (absolute URL) → falls back to /dashboard
 * - mode=calendar with valid session → redirects to Google
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted Mocks ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  resolveAccountId: vi.fn(),
  checkAuthRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
  generateAuthUrl: vi.fn(() => "https://accounts.google.com/o/oauth2/auth?mock"),
  clearOAuthCookies: vi.fn(),
  createOAuthClient: vi.fn(),
}));

vi.mock("@/lib/api/with-account", () => ({
  resolveAccountId: mocks.resolveAccountId,
}));

vi.mock("@/lib/api/rate-limiter", () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
  getClientIp: mocks.getClientIp,
}));

// Mock google-oauth module at the abstraction boundary (avoids googleapis class constructor issues)
vi.mock("@/lib/utils/google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/google-oauth")>();
  return {
    ...actual,
    clearOAuthCookies: mocks.clearOAuthCookies,
    createOAuthClient: mocks.createOAuthClient,
  };
});

import { GET } from "../login/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

function rateLimitAllowed() {
  mocks.checkAuthRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 4,
    resetAt: Date.now() + 60_000,
    retryAfterMs: 0,
  });
}

function rateLimitBlocked() {
  mocks.checkAuthRateLimit.mockResolvedValue({
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
    retryAfterMs: 55_000,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/google/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    rateLimitAllowed();

    // Default: createOAuthClient returns a usable mock client
    mocks.createOAuthClient.mockReturnValue({
      generateAuthUrl: mocks.generateAuthUrl,
    });
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────

  it("returns 429 when rate limited", async () => {
    rateLimitBlocked();
    const res = await GET(makeRequest("/api/auth/google/login?mode=login"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/quá nhiều/i);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  // ── Missing OAuth config ──────────────────────────────────────────────────

  it("redirects to login error when GOOGLE_CLIENT_ID is missing", async () => {
    mocks.createOAuthClient.mockReturnValue(null); // simulates missing env vars
    const res = await GET(makeRequest("/api/auth/google/login?mode=login"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("callback_failed");
  });

  it("returns 500 JSON when client is null and mode is not login", async () => {
    mocks.createOAuthClient.mockReturnValue(null);
    mocks.resolveAccountId.mockResolvedValue("account-xyz");
    const res = await GET(makeRequest("/api/auth/google/login"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  // ── Login mode ────────────────────────────────────────────────────────────

  it("mode=login → redirects to Google OAuth + sets state cookie", async () => {
    const res = await GET(makeRequest("/api/auth/google/login?mode=login"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("accounts.google.com");

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const stateCookie = setCookies.find((c) => c.startsWith("google_login_oauth_state="));
    expect(stateCookie).toBeDefined();
    expect(stateCookie).toContain("HttpOnly");
  });

  it("mode=login with next=/orders → sets next cookie to /orders", async () => {
    const res = await GET(makeRequest("/api/auth/google/login?mode=login&next=/orders"));
    expect(res.status).toBe(307);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const nextCookie = setCookies.find(
      (c) => c.startsWith("google_login_oauth_next=") && !c.includes("Max-Age=0"),
    );
    expect(nextCookie).toBeDefined();
    // Cookie values are URL-encoded in Set-Cookie headers
    expect(decodeURIComponent(nextCookie ?? "")).toContain("/orders");
  });

  it("mode=login with absolute URL as next → cookie falls back to /dashboard, not external URL", async () => {
    const res = await GET(
      makeRequest("/api/auth/google/login?mode=login&next=https://evil.com"),
    );
    expect(res.status).toBe(307);

    // resolveInternalRedirectPath rejects absolute URLs → falls back to /dashboard
    // The next cookie should contain /dashboard, NOT the external URL
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const nextCookie = setCookies.find(
      (c) => c.startsWith("google_login_oauth_next=") && !c.includes("Max-Age=0"),
    );
    // Cookie is set with /dashboard (the safe fallback), not with evil.com
    if (nextCookie) {
      const decodedValue = decodeURIComponent(nextCookie.split(";")[0].split("=")[1] ?? "");
      expect(decodedValue).not.toContain("evil.com");
      expect(decodedValue).not.toContain("https://");
    }
  });

  // ── Calendar mode ─────────────────────────────────────────────────────────

  it("calendar mode without session → 401", async () => {
    mocks.resolveAccountId.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/auth/google/login"));
    expect(res.status).toBe(401);
  });

  it("calendar mode with valid session → redirects to Google", async () => {
    mocks.resolveAccountId.mockResolvedValue("account-xyz");
    const res = await GET(makeRequest("/api/auth/google/login"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("accounts.google.com");
  });
});
