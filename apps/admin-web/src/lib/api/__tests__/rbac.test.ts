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

import { resolveUser } from "../rbac";

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
        id: "admin-1",
        email: TEST_USER_EMAIL,
        role: "sales_staff",
        full_name: "Test Admin",
      },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-account-id": TEST_ACCOUNT_ID,
        "x-user-id": "admin-1",
        "x-user-email": TEST_USER_EMAIL,
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toEqual({
      userId: "admin-1",
      email: TEST_USER_EMAIL,
      role: "sales_staff",
      accountId: TEST_ACCOUNT_ID,
      displayName: "Test Admin",
    });
    expect(rbacMocks.eqIdentityMock).toHaveBeenCalledWith("id", "admin-1");
  });

  it("falls back to x-user-email when x-user-id is missing", async () => {
    rbacMocks.maybeSingleMock.mockResolvedValue({
      data: {
        id: "admin-2",
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
      userId: "admin-2",
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
});
