import { describe, expect, it } from "vitest";
import {
  createUnlockCookieValue,
  hashPasscode,
  verifyPasscode,
  verifyUnlockCookieValue,
} from "./crypto";

describe("account-sharing crypto", () => {
  it("hashes and verifies passcodes without accepting wrong values", () => {
    const hash = hashPasscode("482913");
    expect(hash).toMatch(/^pbkdf2:/);
    expect(verifyPasscode("482913", hash)).toBe(true);
    expect(verifyPasscode("000000", hash)).toBe(false);
  });

  it("signs unlock cookies bound to slug, user-agent, and expiry", () => {
    const env = { SHARE_UNLOCK_SECRET: "test-share-secret" };
    const cookie = createUnlockCookieValue(
      { slug: "abc123", userAgent: "Browser A", ttlSeconds: 30 },
      env,
    );

    expect(verifyUnlockCookieValue(cookie, { slug: "abc123", userAgent: "Browser A" }, env)).not.toBeNull();
    expect(verifyUnlockCookieValue(cookie, { slug: "other", userAgent: "Browser A" }, env)).toBeNull();
    expect(verifyUnlockCookieValue(cookie, { slug: "abc123", userAgent: "Browser B" }, env)).toBeNull();
  });

  it("requires the dedicated share unlock secret", () => {
    expect(() => createUnlockCookieValue(
      { slug: "abc123", userAgent: "Browser A", ttlSeconds: 30 },
      { JWT_SECRET: "legacy-jwt-secret" },
    )).toThrow("SHARE_UNLOCK_SECRET");
  });
});
