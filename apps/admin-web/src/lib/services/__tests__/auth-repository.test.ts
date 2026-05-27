import { describe, expect, it, vi, beforeEach } from "vitest";

const authRepoMocks = vi.hoisted(() => {
  const singleMock = vi.fn();
  const ilikeMock = vi.fn(() => ({ single: singleMock }));
  const selectMock = vi.fn(() => ({ ilike: ilikeMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    singleMock,
    ilikeMock,
    selectMock,
    fromMock,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: authRepoMocks.fromMock,
  },
}));

vi.mock("@/lib/utils/crypto", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/utils/jwt", () => ({
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  verifyToken: vi.fn(),
}));

import { AuthRepository } from "../auth";

describe("AuthRepository email normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes lookup emails before querying admin_users", async () => {
    authRepoMocks.singleMock.mockResolvedValue({
      data: {
        id: "u1",
        email: "Admin@Example.com",
        password_hash: "",
        first_name: "Admin",
        last_name: "User",
        account_id: "acc-1",
        role: "admin",
        status: "active",
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    const repo = new AuthRepository();
    const user = await repo.findUserByEmail("ADMIN@EXAMPLE.COM");

    expect(authRepoMocks.selectMock).toHaveBeenCalledWith("*");
    expect(authRepoMocks.ilikeMock).toHaveBeenCalledWith("email", "admin@example.com");
    expect(user?.email).toBe("Admin@Example.com");
  });

  it("normalizes account email lookups", async () => {
    authRepoMocks.singleMock.mockResolvedValue({
      data: {
        account_id: "acc-1",
        email: "Admin@Example.com",
      },
      error: null,
    });

    const repo = new AuthRepository();
    const account = await repo.findAccountByEmail("ADMIN@EXAMPLE.COM");

    expect(authRepoMocks.ilikeMock).toHaveBeenCalledWith("email", "admin@example.com");
    expect(account?.email).toBe("Admin@Example.com");
  });
});
