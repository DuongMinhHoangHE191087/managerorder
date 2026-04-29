import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TEST_ACCOUNT_ID, TEST_USER_EMAIL } from "@/app/api/__tests__/helpers/setup";

const rbacMocks = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const eqIdentityMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const eqAccountMock = vi.fn(() => ({ eq: eqIdentityMock }));
  const selectMock = vi.fn(() => ({ eq: eqAccountMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    maybeSingleMock,
    eqIdentityMock,
    eqAccountMock,
    selectMock,
    fromMock,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: rbacMocks.fromMock,
  },
}));

vi.mock("@/lib/utils/jwt", () => ({
  verifyToken: vi.fn(),
}));

import { resolveUser } from "../rbac";
import { verifyToken } from "@/lib/utils/jwt";

describe("resolveUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when identity headers are missing", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-account-id": TEST_ACCOUNT_ID,
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toBeNull();
    expect(rbacMocks.fromMock).not.toHaveBeenCalled();
  });

  it("returns the DB-backed user when x-user-id matches an admin user", async () => {
    rbacMocks.maybeSingleMock.mockResolvedValue({
      data: {
        id: "00000000-0000-4000-8000-0000000000d0",
        email: TEST_USER_EMAIL,
        role: "sales_staff",
        full_name: "Test Admin",
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-account-id": TEST_ACCOUNT_ID,
        "x-user-id": "00000000-0000-4000-8000-0000000000d0",
        "x-user-email": TEST_USER_EMAIL,
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toEqual({
      userId: "00000000-0000-4000-8000-0000000000d0",
      email: TEST_USER_EMAIL,
      role: "sales_staff",
      accountId: TEST_ACCOUNT_ID,
      displayName: "Test Admin",
    });
    expect(rbacMocks.eqIdentityMock).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-0000000000d0");
  });

  it("falls back to x-user-email when x-user-id is missing", async () => {
    rbacMocks.maybeSingleMock.mockResolvedValue({
      data: {
        id: "00000000-0000-4000-8000-0000000000d1",
        email: TEST_USER_EMAIL,
        role: "sales_staff",
        full_name: "Email User",
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-account-id": TEST_ACCOUNT_ID,
        "x-user-email": TEST_USER_EMAIL,
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toEqual({
      userId: "00000000-0000-4000-8000-0000000000d1",
      email: TEST_USER_EMAIL,
      role: "sales_staff",
      accountId: TEST_ACCOUNT_ID,
      displayName: "Email User",
    });
    expect(rbacMocks.eqIdentityMock).toHaveBeenCalledWith("email", TEST_USER_EMAIL);
  });

  it("returns null when the admin user lookup fails", async () => {
    rbacMocks.maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-account-id": TEST_ACCOUNT_ID,
        "x-user-id": "missing-admin",
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toBeNull();
  });

  it("falls back to the verified JWT cookie when user headers are missing", async () => {
    vi.mocked(verifyToken).mockReturnValue({
      sub: "codex-qa",
      accountId: TEST_ACCOUNT_ID,
      role: "admin_owner",
      email: "codex-qa@local",
    });
    rbacMocks.maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        cookie: "access_token=valid-cookie-token",
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toEqual({
      userId: "codex-qa",
      email: "codex-qa@local",
      role: "admin_owner",
      accountId: TEST_ACCOUNT_ID,
      displayName: null,
    });
    expect(verifyToken).toHaveBeenCalledWith("valid-cookie-token");
  });

  it("rejects JWT fallback when the token account differs", async () => {
    vi.mocked(verifyToken).mockReturnValue({
      sub: "codex-qa",
      accountId: "another-account",
      role: "admin_owner",
      email: "codex-qa@local",
    });

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        cookie: "access_token=valid-cookie-token",
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toBeNull();
  });
});
