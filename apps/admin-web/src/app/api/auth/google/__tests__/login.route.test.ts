import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const googleMocks = vi.hoisted(() => {
  const generateAuthUrl = vi.fn();
  const ctorArgs: unknown[][] = [];

  class OAuth2Mock {
    generateAuthUrl = generateAuthUrl;

    constructor(...args: unknown[]) {
      ctorArgs.push(args);
    }
  }

  return {
    generateAuthUrl,
    ctorArgs,
    OAuth2Mock,
  };
});

const accountMocks = vi.hoisted(() => {
  const resolveAccountId = vi.fn();
  return { resolveAccountId };
});

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: googleMocks.OAuth2Mock,
    },
  },
}));

vi.mock("@/lib/api/with-account", () => ({
  resolveAccountId: accountMocks.resolveAccountId,
}));

import { GET } from "../login/route";

describe("GET /api/auth/google/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("starts the admin login flow with scoped OAuth state", async () => {
    googleMocks.generateAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?mock=1");

    const res = await GET(
      new NextRequest("http://localhost:3000/api/auth/google/login?mode=login&next=/orders")
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?mock=1");
    expect(res.cookies.get("google_login_oauth_state")?.value).toMatch(/^[-0-9a-f]+$/i);
    expect(res.cookies.get("google_login_oauth_next")?.value).toBe("/orders");
    expect(googleMocks.generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: ["openid", "email", "profile"],
        prompt: "select_account",
        state: expect.stringMatching(/^login:/),
      })
    );
  });

  it("starts the calendar connect flow for an authenticated account", async () => {
    accountMocks.resolveAccountId.mockResolvedValue("account-1");
    googleMocks.generateAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?calendar=1");

    const res = await GET(new NextRequest("http://localhost:3000/api/auth/google/login"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?calendar=1");
    expect(res.cookies.get("google_calendar_oauth_state")?.value).toMatch(/^[-0-9a-f]+$/i);
    expect(googleMocks.generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar.readonly",
        ],
        prompt: "consent",
        state: expect.stringMatching(/^calendar:account-1:/),
      })
    );
  });

  it("rejects calendar flow without a valid session", async () => {
    accountMocks.resolveAccountId.mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost:3000/api/auth/google/login"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        error: "Unauthorized - phien dang nhap khong hop le",
      })
    );
  });
});
