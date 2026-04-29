import { describe, it, expect } from "vitest";
import {
  scoreSourceAccount,
  suggestTopAccounts,
  daysUntil,
} from "@/lib/domain/allocation-engine";
import type { SourceAccount } from "@/lib/domain/types";

// Helper to create a source account with defaults
function makeAccount(
  overrides: Partial<SourceAccount> = {},
): SourceAccount {
  return {
    id: "00000000-0000-4000-8000-000000000040",
    email: "test@example.com",
    provider: "00000000-0000-4000-8000-0000000000d6",
    productIds: ["00000000-0000-4000-8000-0000000000d7"],
    maxSlots: 10,
    usedSlots: 5,
    expiresAt: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    ...overrides,
  };
}

describe("daysUntil", () => {
  it("returns positive days for future dates", () => {
    const future = new Date(
      Date.now() + 10 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(daysUntil(future)).toBeGreaterThanOrEqual(9);
  });

  it("returns negative days for past dates", () => {
    const past = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(daysUntil(past)).toBeLessThan(0);
  });
});

describe("scoreSourceAccount", () => {
  it("returns negative score for expired accounts", () => {
    const expired = makeAccount({
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    });
    expect(scoreSourceAccount(expired)).toBeLessThan(0);
  });

  it("gives FIFO bonus — closer expiry => higher score", () => {
    const soonExpiry = makeAccount({
      id: "soon",
      expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    });
    const lateExpiry = makeAccount({
      id: "late",
      expiresAt: new Date(Date.now() + 200 * 86400000).toISOString(),
    });
    expect(scoreSourceAccount(soonExpiry)).toBeGreaterThan(
      scoreSourceAccount(lateExpiry),
    );
  });

  it("gives fill-first bonus — fewer free slots => higher score (same expiry)", () => {
    const almost = makeAccount({ maxSlots: 10, usedSlots: 9 }); // 1 free
    const empty = makeAccount({ maxSlots: 10, usedSlots: 0 }); // 10 free
    // Both same expiry, almost-full should score higher
    expect(scoreSourceAccount(almost)).toBeGreaterThan(
      scoreSourceAccount(empty),
    );
  });

  it("gives massive bonus for nick match", () => {
    const account = makeAccount({ email: "user@test.com" });
    const withMatch = scoreSourceAccount(account, "user@test.com");
    const withoutMatch = scoreSourceAccount(account);
    expect(withMatch - withoutMatch).toBe(100000);
  });

  it("nick match is case insensitive", () => {
    const account = makeAccount({ email: "User@Test.COM" });
    const score = scoreSourceAccount(account, "user@test.com");
    // Should include 100000 bonus
    expect(score).toBeGreaterThan(100000);
  });
});

describe("suggestTopAccounts", () => {
  const baseFuture = new Date(
    Date.now() + 60 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const accounts: SourceAccount[] = [
    makeAccount({
      id: "a1",
      email: "alpha@test.com",
      maxSlots: 10,
      usedSlots: 8,
      expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    }),
    makeAccount({
      id: "a2",
      email: "beta@test.com",
      maxSlots: 10,
      usedSlots: 2,
      expiresAt: baseFuture,
    }),
    makeAccount({
      id: "a3",
      email: "gamma@test.com",
      maxSlots: 10,
      usedSlots: 5,
      expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    }),
    makeAccount({
      id: "a4",
      email: "expired@test.com",
      maxSlots: 10,
      usedSlots: 0,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    }),
  ];

  it("returns top 3 by default", () => {
    const result = suggestTopAccounts("00000000-0000-4000-8000-0000000000d7", 1, accounts);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("excludes expired accounts", () => {
    const result = suggestTopAccounts("00000000-0000-4000-8000-0000000000d7", 1, accounts);
    const ids = result.map((r) => r.sourceAccountId);
    expect(ids).not.toContain("a4"); // expired@test.com
  });

  it("excludes accounts without enough slots", () => {
    const result = suggestTopAccounts("00000000-0000-4000-8000-0000000000d7", 5, accounts);
    const ids = result.map((r) => r.sourceAccountId);
    // a1 has only 2 free slots, can't fit 5
    expect(ids).not.toContain("a1");
  });

  it("excludes accounts without matching productId", () => {
    const result = suggestTopAccounts(
      "nonexistent-product",
      1,
      accounts,
    );
    expect(result.length).toBe(0);
  });

  it("sorts by score descending", () => {
    const result = suggestTopAccounts("00000000-0000-4000-8000-0000000000d7", 1, accounts);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("includes reason text", () => {
    const result = suggestTopAccounts("00000000-0000-4000-8000-0000000000d7", 1, accounts);
    expect(result.length).toBeGreaterThan(0);
    for (const suggestion of result) {
      expect(suggestion.reason).toBeTruthy();
    }
  });

  it("preferred nick boosts specific account to top", () => {
    const result = suggestTopAccounts(
      "00000000-0000-4000-8000-0000000000d7",
      1,
      accounts,
      "beta@test.com",
    );
    expect(result[0].sourceAccountId).toBe("a2");
    expect(result[0].reason).toContain("Khớp nick");
  });

  it("returns empty array when no candidates", () => {
    const result = suggestTopAccounts("00000000-0000-4000-8000-0000000000d7", 100, accounts);
    expect(result).toEqual([]);
  });
});
