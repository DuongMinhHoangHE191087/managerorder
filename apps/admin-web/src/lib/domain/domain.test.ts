// ===========================================================
// UNIT TESTS: Domain Logic
// - debt-policy.ts
// - order-state-machine.ts
// - allocation-engine.ts
// ===========================================================

import { describe, it, expect } from 'vitest';
import { evaluateDebtPolicy } from '@/lib/domain/debt-policy';
import {
  canTransitionOrder,
  transitionOrder,
  getOrderNextStatuses,
} from '@/lib/domain/order-state-machine';
import { createAllocationSuggestion } from '@/lib/domain/allocation-engine';
import type { Order, OrderItem, ProductService, SourceAccount, LicenseKey } from '@/lib/domain/types';

// ===========================================================
// DEBT POLICY
// ===========================================================
describe('evaluateDebtPolicy', () => {
  it('allows order with zero debt', () => {
    const result = evaluateDebtPolicy(0, 0);
    expect(result.allowCreateOrder).toBe(true);
    expect(result.severity).toBe('none');
    expect(result.shouldAutoLockService).toBe(false);
    expect(result.reminderRequired).toBe(false);
  });

  it('warning severity for small debt, no overdue', () => {
    const result = evaluateDebtPolicy(100_000, 2);
    expect(result.allowCreateOrder).toBe(true);
    expect(result.severity).toBe('warning');
    expect(result.shouldAutoLockService).toBe(false);
    expect(result.reminderRequired).toBe(true);
  });

  it('critical severity when debt >= 500,000 VND', () => {
    const result = evaluateDebtPolicy(500_000, 0);
    expect(result.severity).toBe('critical');
  });

  it('auto-locks service when overdue >= 7 days', () => {
    const result = evaluateDebtPolicy(10_000, 7);
    expect(result.shouldAutoLockService).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('does not auto-lock when overdue < 7 days', () => {
    const result = evaluateDebtPolicy(10_000, 6);
    expect(result.shouldAutoLockService).toBe(false);
  });

  it('critical when both large debt AND long overdue', () => {
    const result = evaluateDebtPolicy(1_000_000, 10);
    expect(result.severity).toBe('critical');
    expect(result.shouldAutoLockService).toBe(true);
  });

  it('respects custom config thresholds', () => {
    const config = { autoLockAfterOverdueDays: 3, warningThresholdVnd: 100_000 };
    const result = evaluateDebtPolicy(50_000, 4, config);
    expect(result.shouldAutoLockService).toBe(true);
  });
});

// ===========================================================
// ORDER STATE MACHINE
// ===========================================================
describe('canTransitionOrder', () => {
  it('allows draft → pending_payment', () => {
    expect(canTransitionOrder('draft', 'pending_payment')).toBe(true);
  });

  it('allows draft → refunded', () => {
    expect(canTransitionOrder('draft', 'refunded')).toBe(true);
  });

  it('blocks draft → active (not adjacent)', () => {
    expect(canTransitionOrder('draft', 'active')).toBe(false);
  });

  it('allows paid → provisioning', () => {
    expect(canTransitionOrder('paid', 'provisioning')).toBe(true);
  });

  it('blocks refunded → active', () => {
    expect(canTransitionOrder('refunded', 'active')).toBe(false);
  });

  it('allows active → expired', () => {
    expect(canTransitionOrder('active', 'expired')).toBe(true);
  });
});

describe('transitionOrder', () => {
  const base: Order = {
    id: 'ord_001',
    customerId: 'cust_001',
    items: [],
    status: 'draft',
    totalAmountVnd: 0,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };

  it('returns updated order with new status', () => {
    const updated = transitionOrder(base, 'pending_payment');
    expect(updated.status).toBe('pending_payment');
    expect(updated.id).toBe(base.id);
    expect(updated.updatedAt).not.toBe(base.updatedAt);
  });

  it('does not mutate the original order', () => {
    transitionOrder(base, 'pending_payment');
    expect(base.status).toBe('draft');
  });

  it('throws on invalid transition', () => {
    expect(() => transitionOrder(base, 'active')).toThrow();
  });
});

describe('getOrderNextStatuses', () => {
  it('lists valid next statuses for draft', () => {
    const statuses = getOrderNextStatuses('draft');
    expect(statuses).toContain('pending_payment');
    expect(statuses).toContain('refunded');
  });

  it('returns empty array for refunded', () => {
    expect(getOrderNextStatuses('refunded')).toHaveLength(0);
  });
});

// ===========================================================
// ALLOCATION ENGINE
// ===========================================================
describe('createAllocationSuggestion', () => {
  const product: ProductService = {
    id: 'prod_001',
    name: 'ChatGPT Plus',
    mode: 'slot',
    buyPriceVnd: 300_000,
    sellPriceVnd: 450_000,
    durationType: 'days', durationValue: 30,
    isActive: true,
  };

  const orderItem: OrderItem = {
    id: 'oi_001',
    productId: 'prod_001',
    quantity: 1,
    priceVnd: 450_000,
  };

  const goodAccount: SourceAccount = {
    id: 'sa_001',
    email: 'source@example.com',
    provider: 'ChatGPT',
    productIds: ['prod_001'],
    maxSlots: 5,
    usedSlots: 2,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  it('returns valid suggestion with a matching account', () => {
    const result = createAllocationSuggestion({
      orderId: 'ord_001',
      orderItem,
      product,
      sourceAccounts: [goodAccount],
      licenseKeys: [],
    });
    expect(result.isValid).toBe(true);
    expect(result.sourceAccountId).toBe('sa_001');
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when no account has free slots', () => {
    const fullAccount: SourceAccount = { ...goodAccount, usedSlots: 5 };
    const result = createAllocationSuggestion({
      orderId: 'ord_002',
      orderItem,
      product,
      sourceAccounts: [fullAccount],
      licenseKeys: [],
    });
    expect(result.isValid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('warns when no account supports the product', () => {
    const wrongAccount: SourceAccount = { ...goodAccount, productIds: ['other_prod'] };
    const result = createAllocationSuggestion({
      orderId: 'ord_003',
      orderItem,
      product,
      sourceAccounts: [wrongAccount],
      licenseKeys: [],
    });
    expect(result.isValid).toBe(false);
  });

  it('assigns a license key for key-mode product', () => {
    const keyProduct: ProductService = { ...product, mode: 'key' };
    const availableKey: LicenseKey = { id: 'lk_001', keyCode: 'KEY-ABC', productId: 'prod_001', status: 'available' };
    const result = createAllocationSuggestion({
      orderId: 'ord_004',
      orderItem,
      product: keyProduct,
      sourceAccounts: [],
      licenseKeys: [availableKey],
    });
    expect(result.licenseKeyId).toBe('lk_001');
  });

  it('ignores used/reserved keys', () => {
    const keyProduct: ProductService = { ...product, mode: 'key' };
    const usedKey: LicenseKey = { id: 'lk_002', keyCode: 'KEY-DEF', productId: 'prod_001', status: 'used' };
    const result = createAllocationSuggestion({
      orderId: 'ord_005',
      orderItem,
      product: keyProduct,
      sourceAccounts: [],
      licenseKeys: [usedKey],
    });
    expect(result.isValid).toBe(false);
    expect(result.licenseKeyId).toBeUndefined();
  });

  it('prefers almost-full account (fill-first strategy)', () => {
    const accountA: SourceAccount = { ...goodAccount, id: 'sa_a', usedSlots: 4, maxSlots: 5 }; // 1 free
    const accountB: SourceAccount = { ...goodAccount, id: 'sa_b', usedSlots: 1, maxSlots: 5 }; // 4 free
    const result = createAllocationSuggestion({
      orderId: 'ord_006',
      orderItem,
      product,
      sourceAccounts: [accountA, accountB],
      licenseKeys: [],
    });
    // Fill-first: prefer sa_a (almost full) to consolidate slots
    expect(result.sourceAccountId).toBe('sa_a');
  });
});
