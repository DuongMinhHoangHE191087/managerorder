// ===========================================================
// UNIT TESTS: src/lib/utils/premium-accounts-helpers.ts
// Pure helper functions only (no Supabase I/O)
// ===========================================================

import { describe, it, expect } from 'vitest';
import {
  hasAvailableSlots,
  isExpired,
  isExpiringSoon,
  getDaysRemaining,
} from '@/lib/utils/premium-accounts-helpers';

// ---------------------------------------------------------------------------
// hasAvailableSlots
// ---------------------------------------------------------------------------
describe('hasAvailableSlots', () => {
  it('returns true when used < total', () => {
    expect(hasAvailableSlots(5, 3)).toBe(true);
  });

  it('returns false when used === total (full)', () => {
    expect(hasAvailableSlots(5, 5)).toBe(false);
  });

  it('returns false when used > total (over-allocated)', () => {
    expect(hasAvailableSlots(5, 6)).toBe(false);
  });

  it('returns false when totalSlots is 0', () => {
    expect(hasAvailableSlots(0, 0)).toBe(false);
  });

  it('returns true when usedSlots is 0', () => {
    expect(hasAvailableSlots(5, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isExpired
// ---------------------------------------------------------------------------
describe('isExpired', () => {
  it('returns true for a past date', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it('returns false for a future date', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDaysRemaining (re-exported / same logic as api-helpers)
// ---------------------------------------------------------------------------
describe('getDaysRemaining (premium-accounts-helpers)', () => {
  it('positive for future date', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(getDaysRemaining(future)).toBeGreaterThan(0);
  });

  it('returns 0 for a past date (clamped)', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(getDaysRemaining(past)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isExpiringSoon (premium-accounts-helpers)
// ---------------------------------------------------------------------------
describe('isExpiringSoon (premium-accounts-helpers)', () => {
  it('true when within default 7-day window', () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(soon)).toBe(true);
  });

  it('false when beyond 7 days', () => {
    const later = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(later)).toBe(false);
  });

  it('false when already expired', () => {
    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon(past)).toBe(false);
  });
});
