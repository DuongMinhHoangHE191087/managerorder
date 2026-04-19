import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TEST_ACCOUNT_ID, TEST_USER_EMAIL } from "@/app/api/__tests__/helpers/setup";

const rbacMocks = vi.hoisted(() => {
  const singleMock = vi.fn();
  const eqAccountMock = vi.fn(() => ({ single: singleMock }));
  const eqEmailMock = vi.fn(() => ({ eq: eqAccountMock }));
  const selectMock = vi.fn(() => ({ eq: eqEmailMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    singleMock,
    eqAccountMock,
    eqEmailMock,
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

  it("returns null when x-user-email is missing", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-account-id": TEST_ACCOUNT_ID,
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toBeNull();
    expect(rbacMocks.fromMock).not.toHaveBeenCalled();
  });

  it("returns the DB-backed user when headers match an admin user", async () => {
    rbacMocks.singleMock.mockResolvedValue({
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
  });

  it("returns null when the admin user lookup fails", async () => {
    rbacMocks.singleMock.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-account-id": TEST_ACCOUNT_ID,
        "x-user-email": TEST_USER_EMAIL,
      },
    });

    const user = await resolveUser(req, TEST_ACCOUNT_ID);

    expect(user).toBeNull();
  });
});
