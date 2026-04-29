import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthenticationError } from "@/lib/utils/errors";

// Mock verifyToken before importing the module under test
vi.mock("@/lib/utils/jwt", () => ({
  verifyToken: vi.fn(),
}));

import { extractTokenFromHeader, verifyTokenFromRequest } from "../auth-helpers";
import { verifyToken } from "@/lib/utils/jwt";

function makeNextRequest(headers: Record<string, string>) {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── extractTokenFromHeader ────────────────────────────────────

describe("extractTokenFromHeader", () => {
  it("extracts token from valid Bearer header", () => {
    const req = makeNextRequest({ authorization: "Bearer my-jwt-token" });
    expect(extractTokenFromHeader(req)).toBe("my-jwt-token");
  });

  it("throws AuthenticationError when no authorization header", () => {
    const req = makeNextRequest({});
    expect(() => extractTokenFromHeader(req)).toThrow(AuthenticationError);
    expect(() => extractTokenFromHeader(req)).toThrow("No token provided");
  });

  it("throws AuthenticationError when authorization header has no token part", () => {
    const req = makeNextRequest({ authorization: "Bearer" });
    expect(() => extractTokenFromHeader(req)).toThrow(AuthenticationError);
  });

  it("handles non-Bearer scheme gracefully", () => {
    const req = makeNextRequest({ authorization: "Basic abc123" });
    // Should return the part after space
    expect(extractTokenFromHeader(req)).toBe("abc123");
  });
});

// ── verifyTokenFromRequest ────────────────────────────────────

describe("verifyTokenFromRequest", () => {
  it("returns decoded payload for valid token", () => {
    const mockPayload = {
      sub: "00000000-0000-4000-8000-000000000088",
      accountId: "00000000-0000-4000-8000-000000000016",
      role: "admin",
      email: "x@x.com",
    };
    vi.mocked(verifyToken).mockReturnValue(mockPayload as any);

    const req = makeNextRequest({ authorization: "Bearer valid-token" });
    const result = verifyTokenFromRequest(req);
    expect(result).toEqual(mockPayload);
    expect(verifyToken).toHaveBeenCalledWith("valid-token");
  });

  it("propagates error when token verification fails", () => {
    vi.mocked(verifyToken).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = makeNextRequest({ authorization: "Bearer bad-token" });
    expect(() => verifyTokenFromRequest(req)).toThrow("Invalid token");
  });

  it("throws AuthenticationError when no token is present", () => {
    const req = makeNextRequest({});
    expect(() => verifyTokenFromRequest(req)).toThrow(AuthenticationError);
  });
});
