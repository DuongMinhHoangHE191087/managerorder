// ===========================================================
// UNIT TESTS: src/lib/utils/api-helpers.ts
// Pure-function helpers only (no NextResponse needed)
// ===========================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateRequiredFields,
  validateEmail,
  validateSlug,
  getPaginationParams,
  getSortParams,
  getSearchParam,
  validateAccountAccess,
  getDaysRemaining,
  isExpiringSoon,
  calculateProratedRefund,
  getMonthsFromBillingCycle,
  calculateExpiryDate,
  addMonths,
} from '@/lib/utils/api-helpers';

// ---------------------------------------------------------------------------
// validateRequiredFields
// ---------------------------------------------------------------------------
describe('validateRequiredFields', () => {
  it('returns valid when all required fields are present', () => {
    const result = validateRequiredFields({ name: 'Alice', email: 'a@b.c' }, ['name', 'email']);
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('catches a single missing field', () => {
    const result = validateRequiredFields({ name: 'Alice' }, ['name', 'email']);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('email');
    expect(result.errors.email).toBeDefined();
  });

  it('catches an empty-string value as missing', () => {
    const result = validateRequiredFields({ name: '' }, ['name']);
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('name');
  });

  it('catches null value as missing', () => {
    const result = validateRequiredFields({ name: null }, ['name']);
    expect(result.isValid).toBe(false);
  });

  it('handles empty required list', () => {
    const result = validateRequiredFields({}, []);
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------
describe('validateEmail', () => {
  it.each([
    ['user@example.com', true],
    ['user+tag@sub.domain.io', true],
    ['a@b.c', true],
  ])('accepts valid email: %s', (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
  });

  it.each([
    ['not-an-email', false],
    ['missing@tld', false],    // no dot in domain
    ['@domain.com', false],
    ['plaintext', false],
    ['', false],
  ])('rejects invalid email: %s', (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// validateSlug
// ---------------------------------------------------------------------------
describe('validateSlug', () => {
  it('accepts valid slugs', () => {
    expect(validateSlug('hello-world')).toBe(true);
    expect(validateSlug('abc123')).toBe(true);
    expect(validateSlug('00000000-0000-4000-8000-0000000003f7')).toBe(true);
  });

  it('rejects slugs with uppercase', () => {
    expect(validateSlug('Hello')).toBe(false);
  });

  it('rejects slugs with spaces', () => {
    expect(validateSlug('hello world')).toBe(false);
  });

  it('rejects slugs with special chars', () => {
    expect(validateSlug('hello_world')).toBe(false);
    expect(validateSlug('hello.world')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPaginationParams
// ---------------------------------------------------------------------------
describe('getPaginationParams', () => {
  function sp(obj: Record<string, string>) {
    return new URLSearchParams(obj);
  }

  it('returns default page=1, limit=20', () => {
    const { page, limit, offset } = getPaginationParams(sp({}));
    expect(page).toBe(1);
    expect(limit).toBe(20);
    expect(offset).toBe(0);
  });

  it('computes correct offset', () => {
    const { offset } = getPaginationParams(sp({ page: '3', limit: '10' }));
    expect(offset).toBe(20);
  });

  it('clamps page to minimum 1', () => {
    const { page } = getPaginationParams(sp({ page: '-5' }));
    expect(page).toBe(1);
  });

  it('clamps limit to maximum 100', () => {
    const { limit } = getPaginationParams(sp({ limit: '999' }));
    expect(limit).toBe(100);
  });

  it('clamps limit to minimum 1', () => {
    const { limit } = getPaginationParams(sp({ limit: '0' }));
    expect(limit).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getSortParams
// ---------------------------------------------------------------------------
describe('getSortParams', () => {
  it('defaults to created_at desc', () => {
    const params = getSortParams(new URLSearchParams());
    expect(params.sort).toBe('created_at');
    expect(params.order).toBe('desc');
  });

  it('reads custom sort and order', () => {
    const params = getSortParams(new URLSearchParams({ sort: 'name', order: 'asc' }));
    expect(params.sort).toBe('name');
    expect(params.order).toBe('asc');
  });
});

// ---------------------------------------------------------------------------
// getSearchParam
// ---------------------------------------------------------------------------
describe('getSearchParam', () => {
  it('returns null when no search', () => {
    expect(getSearchParam(new URLSearchParams())).toBeNull();
  });

  it('returns the search string', () => {
    expect(getSearchParam(new URLSearchParams({ search: 'netflix' }))).toBe('netflix');
  });
});



// ---------------------------------------------------------------------------
// validateAccountAccess
// ---------------------------------------------------------------------------
describe('validateAccountAccess', () => {
  it('returns valid for a non-empty id', () => {
    expect(validateAccountAccess('acc_123').isValid).toBe(true);
  });

  it('returns invalid for null', () => {
    const result = validateAccountAccess(null);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns invalid for empty string', () => {
    // empty string is falsy
    const result = validateAccountAccess('');
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDaysRemaining
// ---------------------------------------------------------------------------
describe('getDaysRemaining', () => {
  it('returns a positive number for a future date', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const days = getDaysRemaining(future);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(6);
  });

  it('returns a negative number for a past date', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(getDaysRemaining(past)).toBeLessThan(0);
  });

  it('returns 0 or 1 for today (within same day)', () => {
    const nearNow = new Date(Date.now() + 60 * 1000).toISOString();
    const days = getDaysRemaining(nearNow);
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// isExpiringSoon
// ---------------------------------------------------------------------------
describe('isExpiringSoon', () => {
  function futureDate(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  it('returns true for date within threshold (default 7)', () => {
    expect(isExpiringSoon(futureDate(5))).toBe(true);
  });

  it('returns false for date beyond threshold', () => {
    expect(isExpiringSoon(futureDate(10))).toBe(false);
  });

  it('returns false for already expired date', () => {
    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(past)).toBe(false);
  });

  it('respects custom threshold', () => {
    expect(isExpiringSoon(futureDate(25), 30)).toBe(true);
    expect(isExpiringSoon(futureDate(35), 30)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateProratedRefund
// ---------------------------------------------------------------------------
describe('calculateProratedRefund', () => {
  beforeEach(() => {
    // Tests are deterministic relative to current time
  });

  it('returns 0 for an already-expired subscription', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const refund = calculateProratedRefund(
      100,
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      past.toISOString()
    );
    expect(refund).toBe(0);
  });

  it('returns full price when only 1 day used out of many', () => {
    const start = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const expiry = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
    const refund = calculateProratedRefund(
      30,
      start.toISOString(),
      expiry.toISOString()
    );
    // ~29/30 * 30 ≈ 29
    expect(refund).toBeGreaterThan(28);
    expect(refund).toBeLessThanOrEqual(30);
  });

  it('rounds to 2 decimal places', () => {
    const start = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const expiry = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    const refund = calculateProratedRefund(10, start.toISOString(), expiry.toISOString());
    const decimals = refund.toString().split('.')[1];
    expect(decimals === undefined || decimals.length <= 2).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getMonthsFromBillingCycle
// ---------------------------------------------------------------------------
describe('getMonthsFromBillingCycle', () => {
  it.each([
    ['1month', 1],
    ['3months', 3],
    ['6months', 6],
    ['1year', 12],
  ] as const)('maps %s → %d months', (cycle, expected) => {
    expect(getMonthsFromBillingCycle(cycle)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// addMonths / calculateExpiryDate
// ---------------------------------------------------------------------------
describe('addMonths', () => {
  it('adds months correctly', () => {
    const base = new Date('2026-01-15');
    const result = addMonths(base, 3);
    expect(result.getMonth()).toBe(3); // April (0-indexed)
    expect(result.getFullYear()).toBe(2026);
  });

  it('handles year rollover', () => {
    const base = new Date('2026-11-15');
    const result = addMonths(base, 2);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0); // January
  });
});

describe('calculateExpiryDate', () => {
  it('computes expiry for 1year cycle', () => {
    const start = new Date('2026-03-05');
    const expiry = calculateExpiryDate(start, '1year');
    expect(expiry.getFullYear()).toBe(2027);
    expect(expiry.getMonth()).toBe(2); // March
  });

  it('computes expiry for 3months cycle', () => {
    const start = new Date('2026-03-05');
    const expiry = calculateExpiryDate(start, '3months');
    expect(expiry.getMonth()).toBe(5); // June
  });
});
