import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const googleMocks = vi.hoisted(() => {
  const getToken = vi.fn();
  const verifyIdToken = vi.fn();
  const ctorArgs: unknown[][] = [];

  class OAuth2Mock {
    getToken = getToken;
    verifyIdToken = verifyIdToken;

    constructor(...args: unknown[]) {
      ctorArgs.push(args);
    }
  }

  return {
    getToken,
    verifyIdToken,
    ctorArgs,
    OAuth2Mock,
  };
});

const authMocks = vi.hoisted(() => {
  const findUserByEmail = vi.fn();
  return { findUserByEmail };
});

const accountMocks = vi.hoisted(() => {
  const resolveAccountId = vi.fn();
  return { resolveAccountId };
});

const supabaseMocks = vi.hoisted(() => {
  const singleMock = vi.fn();
  const eqProviderMock = vi.fn(() => ({ single: singleMock }));
  const eqAccountMock = vi.fn(() => ({ eq: eqProviderMock }));
  const selectMock = vi.fn(() => ({ eq: eqAccountMock }));
  const updateEqMock = vi.fn();
  const updateMock = vi.fn(() => ({ eq: updateEqMock }));
  const insertMock = vi.fn();
  const fromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
    insert: insertMock,
  }));

  return {
    singleMock,
    eqProviderMock,
    eqAccountMock,
    selectMock,
    updateEqMock,
    updateMock,
    insertMock,
    fromMock,
  };
});

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: googleMocks.OAuth2Mock,
    },
  },
}));

vi.mock("@/lib/services/auth", () => ({
  AuthRepository: class {
    findUserByEmail = authMocks.findUserByEmail;
  },
}));

vi.mock("@/lib/api/with-account", () => ({
  resolveAccountId: accountMocks.resolveAccountId,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: supabaseMocks.fromMock,
  },
}));

import { GET } from "../callback/route";

describe("GET /api/auth/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  it("completes the admin login flow and issues session cookies", async () => {
    googleMocks.getToken.mockResolvedValue({
      tokens: {
        id_token: "id-token",
        access_token: "access-token",
      },
    });
    googleMocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "ADMIN@EXAMPLE.COM",
        email_verified: true,
      }),
    });
    authMocks.findUserByEmail.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      accountId: "account-1",
      role: "admin_owner",
    });

    const res = await GET(
      new NextRequest(
        "http://localhost:3000/api/auth/google/callback?code=auth-code-123&state=login:nonce-1",
        {
          headers: {
            cookie: "google_login_oauth_state=nonce-1; google_login_oauth_next=/orders?tab=recent",
          },
        }
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/orders?tab=recent");
    expect(authMocks.findUserByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(res.cookies.get("access_token")?.value).toBeDefined();
    expect(res.cookies.get("refresh_token")?.value).toBeDefined();
  });

  it("redirects back to login when the Google account is not an admin", async () => {
    googleMocks.getToken.mockResolvedValue({
      tokens: {
        id_token: "id-token",
      },
    });
    googleMocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "guest@example.com",
        email_verified: true,
      }),
    });
    authMocks.findUserByEmail.mockResolvedValue(null);

    const res = await GET(
      new NextRequest(
        "http://localhost:3000/api/auth/google/callback?code=auth-code-123&state=login:nonce-2",
        {
          headers: {
            cookie: "google_login_oauth_state=nonce-2; google_login_oauth_next=/dashboard",
          },
        }
      )
    );

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("callback_failed");
    expect(location.searchParams.get("reason")).toBe(
      "Tai khoan Google nay chua duoc cap quyen truy cap admin."
    );
  });

  it("preserves the calendar integration flow for authenticated accounts", async () => {
    googleMocks.getToken.mockResolvedValue({
      tokens: {
        access_token: "calendar-access-token",
        refresh_token: "calendar-refresh-token",
        expiry_date: Date.now() + 60_000,
      },
    });
    accountMocks.resolveAccountId.mockResolvedValue("account-1");
    supabaseMocks.singleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    supabaseMocks.insertMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const res = await GET(
      new NextRequest(
        "http://localhost:3000/api/auth/google/callback?code=auth-code-123&state=calendar:account-1:nonce-3",
        {
          headers: {
            cookie: "google_calendar_oauth_state=nonce-3",
          },
        }
      )
    );

    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/calendar");
    expect(location.searchParams.get("gcal_connected")).toBe("true");
    expect(supabaseMocks.insertMock).toHaveBeenCalled();
  });
});
