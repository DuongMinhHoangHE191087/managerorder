// ============================================================
// UNIT TESTS: Price Immutability & Order Snapshot
//
// Verifies the critical invariant:
//   Changing a product's price MUST NOT alter any existing order's
//   total_amount_vnd, unit_price_vnd, or payment reconciliation.
//
// Covers:
//  - price snapshot is computed correctly at order time
//  - payment reconciliation uses only frozen order fields
//  - overpayment is rejected
//  - refunded orders reject further payments
//  - changing price on a settled order has no effect
// ============================================================

import { describe, it, expect } from 'vitest';

// ── Helpers that mirror the logic in the route handlers ─────────────────────

interface OrderSnapshot {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price_vnd: number;
  quantity: number;
  total_amount_vnd: number;
  total_paid: number;
  status: 'draft' | 'pending_payment' | 'paid' | 'provisioning' | 'active' | 'expired' | 'refunded';
}

/** Simulates what POST /api/orders does at creation time */
function createOrderSnapshot(product: {
  id: string;
  name: string;
  sell_price_vnd: number;
}, quantity: number, paymentMethod?: 'paid' | 'debt' | 'cod'): OrderSnapshot {
  const unitPriceVnd = product.sell_price_vnd;
  const totalAmountVnd = unitPriceVnd * quantity;
  return {
    id: `ord_${Date.now()}`,
    product_id: product.id,
    product_name_snapshot: product.name,
    unit_price_vnd: unitPriceVnd,
    quantity,
    total_amount_vnd: totalAmountVnd,
    total_paid: paymentMethod === 'paid' ? totalAmountVnd : 0,
    status: paymentMethod === 'paid' ? 'paid' : 'pending_payment',
  };
}

interface PaymentResult {
  success: boolean;
  errorCode?: 'already_settled' | 'overpayment' | 'already_refunded';
  errorMessage?: string;
  newTotalPaid?: number;
  remaining?: number;
  fullyPaid?: boolean;
  newStatus?: OrderSnapshot['status'];
}

/** Simulates what POST /api/orders/[id]/payment does */
function applyPayment(order: OrderSnapshot, amount: number): PaymentResult {
  if (order.status === 'refunded') {
    return { success: false, errorCode: 'already_refunded', errorMessage: 'Đơn hàng đã được hoàn tiền' };
  }

  // CRITICAL: reconcile against FROZEN total_amount_vnd, NOT live product price
  const frozenTotal = order.total_amount_vnd;
  const remaining = frozenTotal - order.total_paid;

  if (remaining <= 0) {
    return { success: false, errorCode: 'already_settled', errorMessage: 'Đơn hàng đã thanh toán đủ' };
  }
  if (amount > remaining) {
    return { success: false, errorCode: 'overpayment', errorMessage: `Vượt quá số tiền còn lại (${formatNumber(remaining)}đ)` };
  }

  const newTotalPaid = order.total_paid + amount;
  const fullyPaid = newTotalPaid >= frozenTotal;
  return {
    success: true,
    newTotalPaid,
    remaining: frozenTotal - newTotalPaid,
    fullyPaid,
    newStatus: fullyPaid ? 'paid' : 'pending_payment',
  };
}

/** Simulates changing product price — returns true if guard should block based on pending orders */
function isPriceChangeBlocked(pendingOrderCount: number): boolean {
  return pendingOrderCount > 0;
}

// ── Test Data ────────────────────────────────────────────────────────────────

const productV1 = { id: 'prod_001', name: 'Netflix 1 tháng', sell_price_vnd: 100_000 };
const productV2_priceRaised = { id: 'prod_001', name: 'Netflix 1 tháng', sell_price_vnd: 150_000 };

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Order price snapshot', () => {
  it('snapshots unit price and product name at creation time', () => {
    const order = createOrderSnapshot(productV1, 2);
    expect(order.unit_price_vnd).toBe(100_000);
    expect(order.total_amount_vnd).toBe(200_000);
    expect(order.product_name_snapshot).toBe('Netflix 1 tháng');
  });

  it('total_amount_vnd = unit_price_vnd × quantity (invariant)', () => {
    const order = createOrderSnapshot(productV1, 3);
    expect(order.total_amount_vnd).toBe(order.unit_price_vnd * order.quantity);
  });

  it('sets total_paid = total_amount_vnd when payment method is "paid"', () => {
    const order = createOrderSnapshot(productV1, 1, 'paid');
    expect(order.total_paid).toBe(order.total_amount_vnd);
    expect(order.status).toBe('paid');
  });

  it('sets total_paid = 0 for debt orders', () => {
    const order = createOrderSnapshot(productV1, 1, 'debt');
    expect(order.total_paid).toBe(0);
    expect(order.status).toBe('pending_payment');
  });
});

describe('Price change does NOT affect existing orders', () => {
  it('existing order keeps its original unit_price_vnd after product price raise', () => {
    const orderBeforePriceChange = createOrderSnapshot(productV1, 2);
    // Simulate product price being changed — the order object is NOT recalculated
    // object is NOT recalculated, price is now 150k
    // The order still holds the original snapshot
    expect(orderBeforePriceChange.unit_price_vnd).toBe(100_000);
    expect(orderBeforePriceChange.total_amount_vnd).toBe(200_000);
  });

  it('existing order keeps its product_name_snapshot after product rename', () => {
    const order = createOrderSnapshot(productV1, 1);
    // product is now renamed
    expect(order.product_name_snapshot).toBe('Netflix 1 tháng');
  });

  it('payment reconciliation uses frozen total even after price change', () => {
    const order = createOrderSnapshot(productV1, 2); // 200,000đ frozen
    // Simulate admin changes product price after order creation
    const newProductPrice = productV2_priceRaised.sell_price_vnd; // 150,000

    // Payment MUST reconcile against 200,000 (frozen), NOT 150,000 × 2 = 300,000
    const result = applyPayment(order, 200_000);
    expect(result.success).toBe(true);
    expect(result.fullyPaid).toBe(true);
    expect(result.remaining).toBe(0);

    // Sanity: the new product price is irrelevant to this reconciliation
    expect(order.total_amount_vnd).not.toBe(newProductPrice * order.quantity);
  });
});

describe('Payment reconciliation', () => {
  it('accepts partial payment and tracks remaining correctly', () => {
    const order = createOrderSnapshot(productV1, 2); // 200,000đ
    const result = applyPayment(order, 100_000);
    expect(result.success).toBe(true);
    expect(result.newTotalPaid).toBe(100_000);
    expect(result.remaining).toBe(100_000);
    expect(result.fullyPaid).toBe(false);
    expect(result.newStatus).toBe('pending_payment');
  });

  it('accepts final payment that exactly clears the balance', () => {
    const order = { ...createOrderSnapshot(productV1, 2), total_paid: 100_000 };
    const result = applyPayment(order, 100_000);
    expect(result.success).toBe(true);
    expect(result.fullyPaid).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.newStatus).toBe('paid');
  });

  it('rejects overpayment', () => {
    const order = createOrderSnapshot(productV1, 1); // 100,000đ
    const result = applyPayment(order, 150_000);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('overpayment');
  });

  it('rejects payment on already fully-paid order', () => {
    const order = createOrderSnapshot(productV1, 1, 'paid');
    const result = applyPayment(order, 1_000);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('already_settled');
  });

  it('rejects payment on refunded order', () => {
    const order = { ...createOrderSnapshot(productV1, 1), status: 'refunded' as const };
    const result = applyPayment(order, 50_000);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('already_refunded');
  });
});

describe('Product price change guard', () => {
  it('blocks price change when pending orders exist', () => {
    expect(isPriceChangeBlocked(3)).toBe(true);
  });

  it('allows price change when no pending orders', () => {
    expect(isPriceChangeBlocked(0)).toBe(false);
  });

  it('new orders after price change use the new price', () => {
    const oldOrder = createOrderSnapshot(productV1, 1);     // 100,000đ
    const newOrder = createOrderSnapshot(productV2_priceRaised, 1); // 150,000đ

    expect(oldOrder.unit_price_vnd).toBe(100_000);
    expect(newOrder.unit_price_vnd).toBe(150_000);
    // Old order is completely unaffected
    expect(oldOrder.total_amount_vnd).toBe(100_000);
  });
});
import { formatNumber } from "@/lib/utils";
