import { describe, it, expect } from 'vitest';
import { generateOrderCode } from '../order-code';

describe('generateOrderCode', () => {
  // ── Format & Structure ──────────────────────────────────────
  it('returns DMH_ prefix', () => {
    const code = generateOrderCode('2026-06-15');
    expect(code.startsWith('DMH_')).toBe(true);
  });

  it('contains 6 random chars between underscores', () => {
    const code = generateOrderCode('2026-06-15');
    const parts = code.split('_');
    // DMH, XXXXXX, ddmmyy
    expect(parts).toHaveLength(3);
    expect(parts[1]).toHaveLength(6);
  });

  it('random chars only use collision-safe charset (no 0,O,1,I)', () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 50; i++) {
      const code = generateOrderCode('2026-01-01');
      const randomPart = code.split('_')[1];
      expect(randomPart).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  // ── Date Suffix ─────────────────────────────────────────────
  it('appends ddmmyy date suffix for valid date string', () => {
    const code = generateOrderCode('2026-06-15');
    expect(code).toMatch(/_150626$/);
  });

  it('appends ddmmyy date suffix for Date object', () => {
    const code = generateOrderCode(new Date('2026-12-01T00:00:00.000Z'));
    expect(code).toMatch(/_011226$/);
  });

  it('pads single-digit day and month', () => {
    const code = generateOrderCode('2026-01-05');
    expect(code).toMatch(/_050126$/);
  });

  it('uses UTC date parts to avoid timezone-dependent suffix mismatch', () => {
    const code = generateOrderCode('2026-06-15T23:30:00.000Z');
    expect(code).toMatch(/_150626$/);
  });

  // ── No Date ─────────────────────────────────────────────────
  it('omits date suffix when expiresAt is null', () => {
    const code = generateOrderCode(null);
    const parts = code.split('_');
    expect(parts).toHaveLength(2); // DMH, XXXXXX only
  });

  it('omits date suffix when expiresAt is undefined', () => {
    const code = generateOrderCode(undefined);
    const parts = code.split('_');
    expect(parts).toHaveLength(2);
  });

  it('omits date suffix when expiresAt is empty string', () => {
    const code = generateOrderCode('');
    const parts = code.split('_');
    expect(parts).toHaveLength(2);
  });

  it('omits date suffix for invalid date string', () => {
    const code = generateOrderCode('not-a-date');
    const parts = code.split('_');
    expect(parts).toHaveLength(2);
  });

  // ── Uniqueness ──────────────────────────────────────────────
  it('generates different codes on each call (high probability)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateOrderCode('2026-06-15'));
    }
    // Should have at least 95 unique out of 100
    expect(codes.size).toBeGreaterThanOrEqual(95);
  });
});
