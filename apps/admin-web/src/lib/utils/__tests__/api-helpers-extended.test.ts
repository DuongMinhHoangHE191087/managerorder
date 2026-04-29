import { describe, it, expect, afterAll } from "vitest";

import {
  validateRequiredFields,
  validateEmail,
  validateSlug,
  getPaginationParams,
  getSortParams,
  getSearchParam,
  validateAccountAccess,
  getSoftDeleteFilter,
  softDelete,
  addMonths,
  getDaysRemaining,
  isExpiringSoon,
  calculateProratedRefund,
  getMonthsFromBillingCycle,
  calculateExpiryDate,
  getEncryptionKey,
} from "../api-helpers";

// ============================================
// VALIDATION HELPERS
// ============================================

describe("validateRequiredFields", () => {
  it("valid when all required fields present", () => {
    const data = { name: "Alice", email: "a@b.com" };
    const result = validateRequiredFields(data, ["name", "email"]);
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.errors).toEqual({});
  });

  it("invalid when fields are missing", () => {
    const data = { name: "Alice" };
    const result = validateRequiredFields(data, ["name", "email", "phone"]);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain("email");
    expect(result.missingFields).toContain("phone");
  });

  it("treats empty string as missing", () => {
    const data = { name: "" };
    const result = validateRequiredFields(data, ["name"]);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain("name");
  });

  it("treats null as missing", () => {
    const data = { name: null };
    const result = validateRequiredFields(data, ["name"]);
    expect(result.isValid).toBe(false);
  });

  it("treats 0 as present", () => {
    const data = { count: 0 };
    const result = validateRequiredFields(data, ["count"]);
    expect(result.isValid).toBe(true);
  });

  it("treats false as present", () => {
    const data = { active: false };
    const result = validateRequiredFields(data, ["active"]);
    expect(result.isValid).toBe(true);
  });
});

describe("validateEmail", () => {
  it.each([
    "user@example.com",
    "test.user@domain.co",
    "a@b.c",
  ])("valid: %s", (email) => {
    expect(validateEmail(email)).toBe(true);
  });

  it.each([
    "",
    "noatsign",
    "@domain.com",
    "user@",
    "user @domain.com",
    "user@domain",
  ])("invalid: '%s'", (email) => {
    expect(validateEmail(email)).toBe(false);
  });
});

describe("validateSlug", () => {
  it.each([
    "my-slug",
    "hello123",
    "a-b-c",
    "test",
  ])("valid: %s", (slug) => {
    expect(validateSlug(slug)).toBe(true);
  });

  it.each([
    "Has Spaces",
    "UPPER",
    "special@char",
    "under_score",
    "",
  ])("invalid: '%s'", (slug) => {
    expect(validateSlug(slug)).toBe(false);
  });
});

// ============================================
// PAGINATION & QUERY HELPERS
// ============================================

describe("getPaginationParams", () => {
  it("returns defaults (page=1, limit=20)", () => {
    const params = new URLSearchParams();
    const result = getPaginationParams(params);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it("parses custom page and limit", () => {
    const params = new URLSearchParams("page=3&limit=50");
    const result = getPaginationParams(params);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(100); // (3-1)*50
  });

  it("clamps page to min 1", () => {
    const params = new URLSearchParams("page=-5");
    const result = getPaginationParams(params);
    expect(result.page).toBe(1);
  });

  it("clamps limit to max 100", () => {
    const params = new URLSearchParams("limit=999");
    const result = getPaginationParams(params);
    expect(result.limit).toBe(100);
  });

  it("clamps limit to min 1", () => {
    const params = new URLSearchParams("limit=0");
    const result = getPaginationParams(params);
    expect(result.limit).toBe(1);
  });
});

describe("getSortParams", () => {
  it("returns default sort=created_at, order=desc", () => {
    const params = new URLSearchParams();
    const result = getSortParams(params);
    expect(result.sort).toBe("created_at");
    expect(result.order).toBe("desc");
  });

  it("parses custom sort and order", () => {
    const params = new URLSearchParams("sort=name&order=asc");
    const result = getSortParams(params);
    expect(result.sort).toBe("name");
    expect(result.order).toBe("asc");
  });
});

describe("getSearchParam", () => {
  it("returns null when no search param", () => {
    expect(getSearchParam(new URLSearchParams())).toBeNull();
  });

  it("returns search value", () => {
    expect(getSearchParam(new URLSearchParams("search=hello"))).toBe("hello");
  });

  it("returns null for empty search", () => {
    expect(getSearchParam(new URLSearchParams("search="))).toBeNull();
  });
});

// ============================================
// ACCOUNT & SOFT-DELETE
// ============================================

describe("validateAccountAccess", () => {
  it("valid for non-null accountId", () => {
    expect(validateAccountAccess("00000000-0000-4000-8000-000000000016").isValid).toBe(true);
  });

  it("invalid for null accountId", () => {
    const result = validateAccountAccess(null);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("getSoftDeleteFilter", () => {
  it("returns { deleted_at: null }", () => {
    expect(getSoftDeleteFilter()).toEqual({ deleted_at: null });
  });
});

describe("softDelete", () => {
  it("returns object with deleted_at as ISO string", () => {
    const result = softDelete();
    expect(result.deleted_at).toBeDefined();
    expect(() => new Date(result.deleted_at)).not.toThrow();
  });
});

// ============================================
// DATE HELPERS
// ============================================

describe("addMonths", () => {
  it("adds months correctly", () => {
    const date = new Date("2024-01-15");
    const result = addMonths(date, 3);
    expect(result.getMonth()).toBe(3); // April (0-indexed)
    expect(result.getFullYear()).toBe(2024);
  });

  it("handles year overflow", () => {
    const date = new Date("2024-11-15");
    const result = addMonths(date, 3);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getFullYear()).toBe(2025);
  });

  it("does not mutate original date", () => {
    const date = new Date("2024-01-15");
    const original = date.getTime();
    addMonths(date, 6);
    expect(date.getTime()).toBe(original);
  });
});

describe("getDaysRemaining", () => {
  it("returns positive days for future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const days = getDaysRemaining(future.toISOString());
    expect(days).toBeGreaterThanOrEqual(9);
    expect(days).toBeLessThanOrEqual(11);
  });

  it("returns negative days for past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const days = getDaysRemaining(past.toISOString());
    expect(days).toBeLessThanOrEqual(-4);
  });
});

describe("isExpiringSoon", () => {
  it("true when within default threshold (7 days)", () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    expect(isExpiringSoon(date.toISOString())).toBe(true);
  });

  it("false when already expired", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isExpiringSoon(past.toISOString())).toBe(false);
  });

  it("false when far from expiry", () => {
    const far = new Date();
    far.setDate(far.getDate() + 30);
    expect(isExpiringSoon(far.toISOString())).toBe(false);
  });

  it("respects custom threshold", () => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    expect(isExpiringSoon(date.toISOString(), 7)).toBe(false);
    expect(isExpiringSoon(date.toISOString(), 20)).toBe(true);
  });
});

// ============================================
// REFUND & BILLING
// ============================================

describe("calculateProratedRefund", () => {
  it("returns 0 for expired subscriptions", () => {
    const start = new Date("2024-01-01");
    const expiry = new Date("2024-06-01");
    expect(calculateProratedRefund(100, start.toISOString(), expiry.toISOString())).toBe(0);
  });

  it("calculates correct prorated refund", () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 15);
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 15);
    
    const refund = calculateProratedRefund(100, start.toISOString(), expiry.toISOString());
    // 15 remaining out of 30 days = ~50%
    expect(refund).toBeGreaterThan(40);
    expect(refund).toBeLessThan(60);
  });

  it("rounds to 2 decimal places", () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 10);
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 20);
    
    const refund = calculateProratedRefund(99.99, start.toISOString(), expiry.toISOString());
    const decimalPlaces = refund.toString().split(".")[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});

describe("getMonthsFromBillingCycle", () => {
  it.each([
    ["1month", 1],
    ["3months", 3],
    ["6months", 6],
    ["1year", 12],
  ] as const)("returns %i for %s", (cycle, expected) => {
    expect(getMonthsFromBillingCycle(cycle)).toBe(expected);
  });

  it("defaults to 1 for unknown cycle", () => {
    // @ts-expect-error - testing invalid input
    expect(getMonthsFromBillingCycle("unknown")).toBe(1);
  });
});

describe("calculateExpiryDate", () => {
  it("calculates expiry for 3months cycle", () => {
    const start = new Date("2024-01-15");
    const result = calculateExpiryDate(start, "3months");
    expect(result.getMonth()).toBe(3); // April
  });

  it("calculates expiry for 1year cycle", () => {
    const start = new Date("2024-01-15");
    const result = calculateExpiryDate(start, "1year");
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0); // January
  });
});

// ============================================
// ENCRYPTION
// ============================================

describe("getEncryptionKey", () => {
  const originalKey = process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY;

  it("returns key when set", () => {
    process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY = "test-key";
    expect(getEncryptionKey()).toBe("test-key");
  });

  it("throws when not set", () => {
    delete process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY;
    expect(() => getEncryptionKey()).toThrow("PREMIUM_PASSWORD_ENCRYPTION_KEY is not set");
  });

  // cleanup
  afterAll(() => {
    if (originalKey) {
      process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY = originalKey;
    }
  });
});
