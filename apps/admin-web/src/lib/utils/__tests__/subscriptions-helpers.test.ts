import { describe, it, expect } from 'vitest';
import {
  validateSubscriptionData,
  getCycleMonths,
  calculateExpiryDate,
} from '../subscriptions-helpers';

// ── getCycleMonths ─────────────────────────────────────────────
describe('getCycleMonths', () => {
  it('returns 1 for "1month"', () => {
    expect(getCycleMonths('1month')).toBe(1);
  });

  it('returns 3 for "3months"', () => {
    expect(getCycleMonths('3months')).toBe(3);
  });

  it('returns 6 for "6months"', () => {
    expect(getCycleMonths('6months')).toBe(6);
  });

  it('returns 12 for "1year"', () => {
    expect(getCycleMonths('1year')).toBe(12);
  });

  it('returns 1 for unknown cycle (fallback)', () => {
    expect(getCycleMonths('2years')).toBe(1);
    expect(getCycleMonths('')).toBe(1);
  });
});

// ── calculateExpiryDate ────────────────────────────────────────
describe('calculateExpiryDate', () => {
  it('adds 1 month for 1month cycle', () => {
    expect(calculateExpiryDate('2026-01-15', '1month')).toBe('2026-02-15');
  });

  it('adds 3 months for 3months cycle', () => {
    expect(calculateExpiryDate('2026-01-15', '3months')).toBe('2026-04-15');
  });

  it('adds 6 months for 6months cycle', () => {
    expect(calculateExpiryDate('2026-01-15', '6months')).toBe('2026-07-15');
  });

  it('adds 12 months for 1year cycle', () => {
    expect(calculateExpiryDate('2026-01-15', '1year')).toBe('2027-01-15');
  });

  it('handles month overflow (Jan 31 + 1 month)', () => {
    const result = calculateExpiryDate('2026-01-31', '1month');
    // Feb doesn't have 31 days → may roll to March
    const d = new Date(result);
    expect(d.getMonth()).toBeGreaterThanOrEqual(1); // Feb or March
  });

  it('handles year boundary correctly', () => {
    expect(calculateExpiryDate('2026-11-15', '3months')).toBe('2027-02-15');
  });

  it('returns ISO date format (YYYY-MM-DD)', () => {
    expect(calculateExpiryDate('2026-06-01', '1month')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('throws for invalid start date strings', () => {
    expect(() => calculateExpiryDate('invalid-date', '1month')).toThrow();
  });
});

// ── validateSubscriptionData ───────────────────────────────────
describe('validateSubscriptionData', () => {
  const validData = {
    premium_account_id: '00000000-0000-4000-8000-000000000016',
    service_type_id: '00000000-0000-4000-8000-000000000085',
    package_id: '00000000-0000-4000-8000-000000000086',
    billing_cycle: '1month',
    start_date: '2026-01-01',
    expiry_date: '2026-02-01',
    original_price: 100000,
    final_price: 90000,
  };

  it('returns isValid true for valid data', () => {
    const result = validateSubscriptionData(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('rejects missing premium_account_id', () => {
    const { premium_account_id: _premium_account_id, ...rest } = validData;
    const result = validateSubscriptionData(rest);
    expect(result.isValid).toBe(false);
    expect(result.errors?.premium_account_id).toBeDefined();
  });

  it('rejects missing service_type_id', () => {
    const result = validateSubscriptionData({ ...validData, service_type_id: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing package_id', () => {
    const result = validateSubscriptionData({ ...validData, package_id: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid billing_cycle', () => {
    const result = validateSubscriptionData({ ...validData, billing_cycle: '2weeks' });
    expect(result.isValid).toBe(false);
    expect(result.errors?.billing_cycle).toBeDefined();
  });

  it('accepts all valid billing cycles', () => {
    for (const cycle of ['1month', '3months', '6months', '1year']) {
      const result = validateSubscriptionData({ ...validData, billing_cycle: cycle });
      expect(result.isValid).toBe(true);
    }
  });

  it('rejects missing start_date', () => {
    const result = validateSubscriptionData({ ...validData, start_date: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects missing expiry_date', () => {
    const result = validateSubscriptionData({ ...validData, expiry_date: '' });
    expect(result.isValid).toBe(false);
  });

  it('rejects expiry_date <= start_date', () => {
    const result = validateSubscriptionData({
      ...validData,
      start_date: '2026-02-01',
      expiry_date: '2026-01-01',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors?.expiry_date).toBeDefined();
  });

  it('rejects invalid date strings before comparing the period', () => {
    const result = validateSubscriptionData({
      ...validData,
      start_date: 'not-a-date',
      expiry_date: 'still-not-a-date',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors?.start_date).toEqual(['Start date is invalid']);
    expect(result.errors?.expiry_date).toEqual(['Expiry date is invalid']);
  });

  it('rejects original_price <= 0', () => {
    const result = validateSubscriptionData({ ...validData, original_price: 0 });
    expect(result.isValid).toBe(false);
  });

  it('rejects final_price <= 0', () => {
    const result = validateSubscriptionData({ ...validData, final_price: -100 });
    expect(result.isValid).toBe(false);
  });

  it('collects multiple errors at once', () => {
    const result = validateSubscriptionData({});
    expect(result.isValid).toBe(false);
    const errorKeys = Object.keys(result.errors ?? {});
    expect(errorKeys.length).toBeGreaterThan(3);
  });
});
