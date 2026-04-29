import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthenticationError, ConflictError } from "@/lib/utils/errors";

// Mock all heavy dependencies
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/utils/crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("$hashed$"),
  verifyPassword: vi.fn(),
}));
vi.mock("@/lib/utils/jwt", () => ({
  generateAccessToken: vi.fn().mockReturnValue("access-token-mock"),
  generateRefreshToken: vi.fn().mockReturnValue("refresh-token-mock"),
  verifyToken: vi.fn(),
}));

import { AuthService, AuthRepository } from "../auth";
import { verifyPassword } from "@/lib/utils/crypto";
import { verifyToken } from "@/lib/utils/jwt";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  // ── login ──────────────────────────────────────────

  describe("login", () => {
    it("returns tokens and user on valid credentials", async () => {
      const mockUser = {
        id: "u1",
        email: "test@x.com",
        passwordHash: "$hashed$abc",
        firstName: "Test",
        lastName: "User",
        accountId: "00000000-0000-4000-8000-000000000016",
        role: "admin",
        status: "active",
        createdAt: new Date(),
      };

      vi.spyOn(AuthRepository.prototype, "findUserByEmail").mockResolvedValue(mockUser);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      const result = await service.login("test@x.com", "password123");
      expect(result.accessToken).toBe("access-token-mock");
      expect(result.refreshToken).toBe("refresh-token-mock");
      expect(result.user.email).toBe("test@x.com");
      expect(result.user.role).toBe("admin");
    });

    it("throws AuthenticationError when user not found", async () => {
      vi.spyOn(AuthRepository.prototype, "findUserByEmail").mockResolvedValue(null);
      await expect(service.login("none@x.com", "pass")).rejects.toThrow(AuthenticationError);
    });

    it("throws AuthenticationError when password is wrong", async () => {
      vi.spyOn(AuthRepository.prototype, "findUserByEmail").mockResolvedValue({
        id: "u1", email: "x@x.com", passwordHash: "$hashed$", firstName: "A",
        lastName: "B", accountId: "acc", role: "admin", status: "active",
        createdAt: new Date(),
      });
      vi.mocked(verifyPassword).mockResolvedValue(false);
      await expect(service.login("x@x.com", "wrong")).rejects.toThrow(AuthenticationError);
    });
  });

  // ── register ───────────────────────────────────────

  describe("register", () => {
    it("creates account and user, returns tokens", async () => {
      vi.spyOn(AuthRepository.prototype, "findAccountByEmail").mockResolvedValue(null);
      vi.spyOn(AuthRepository.prototype, "createAccount").mockResolvedValue({
        id: "acc-new", name: "TestCo", email: "new@x.com", status: "active",
      });
      vi.spyOn(AuthRepository.prototype, "createUser").mockResolvedValue({
        id: "u-new", email: "new@x.com", passwordHash: "$h$", firstName: "New",
        lastName: "User", accountId: "acc-new", role: "admin", status: "active",
        createdAt: new Date(),
      });

      const result = await service.register("new@x.com", "pass", "New", "User", "TestCo");
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe("new@x.com");
    });

    it("throws ConflictError when email already exists", async () => {
      vi.spyOn(AuthRepository.prototype, "findAccountByEmail").mockResolvedValue({
        account_id: "00000000-0000-4000-8000-000000000016", email: "dup@x.com",
      });

      await expect(
        service.register("dup@x.com", "pass", "A", "B", "C")
      ).rejects.toThrow(ConflictError);
    });
  });

  // ── refreshTokens ──────────────────────────────────

  describe("refreshTokens", () => {
    it("returns new tokens for valid refresh token", async () => {
      vi.mocked(verifyToken).mockReturnValue({
        sub: "u1",
        accountId: "00000000-0000-4000-8000-000000000016",
        role: "admin",
        email: "x@x.com",
      });
      vi.spyOn(AuthRepository.prototype, "findUserById").mockResolvedValue({
        id: "u1", email: "x@x.com", passwordHash: "$hashed$", firstName: "A",
        lastName: "B", accountId: "00000000-0000-4000-8000-000000000016", role: "admin", status: "active",
        createdAt: new Date(),
      });

      const result = await service.refreshTokens("valid-refresh");
      expect(result.accessToken).toBe("access-token-mock");
      expect(result.refreshToken).toBe("refresh-token-mock");
    });

    it("throws AuthenticationError for invalid refresh token", async () => {
      vi.mocked(verifyToken).mockImplementation(() => { throw new Error("invalid"); });
      await expect(service.refreshTokens("bad-token")).rejects.toThrow(AuthenticationError);
    });

    it("throws AuthenticationError when user is no longer active", async () => {
      vi.mocked(verifyToken).mockReturnValue({
        sub: "u-gone", accountId: "00000000-0000-4000-8000-000000000016", role: "admin", email: "x@x.com",
      });
      vi.spyOn(AuthRepository.prototype, "findUserById").mockResolvedValue(null);
      await expect(service.refreshTokens("valid-refresh")).rejects.toThrow(AuthenticationError);
    });
  });
});
