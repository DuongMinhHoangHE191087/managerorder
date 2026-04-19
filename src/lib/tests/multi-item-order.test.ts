// ============================================================
// UNIT TESTS: Multi-Item Order Logic & Invoice Computation
//
// Tests the pure business logic for:
//  - Multi-item order totals (sum across all line items)
//  - Per-item price snapshots must be independent
//  - Invoice number generation
//  - Payment summary computation (subtotal / paid / remaining / fully_paid)
//  - Line-item subtotal invariant (price_vnd × quantity = subtotal_vnd)
//  - Legacy single-item order fallback
//  - Orders with duplicate product IDs (treated as separate line items)
// ============================================================

import { describe, it, expect } from 'vitest';

// ── Types (mirroring DB schema) ───────────────────────────────────────────────

interface ProductSnapshot {
  id: string;
  name: string;
  sell_price_vnd: number;
  duration_days: number;
  is_active: boolean;
}

interface LineItem {
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  price_vnd: number;
  subtotal_vnd: number;
  notes: string | null;
}

interface OrderHeader {
  id: string;
  customer_id: string;
  product_id: string | null;
  product_name_snapshot: string | null;
  unit_price_vnd: number | null;
  quantity: number;
  total_amount_vnd: number;
  total_paid: number;
  status: 'draft' | 'pending_payment' | 'paid' | 'provisioning' | 'active' | 'expired' | 'refunded';
  expires_at: string;
  items: LineItem[];
}

interface OrderInput {
  productId: string;
  quantity: number;
  notes?: string;
}

// ── Pure helpers matching route logic ─────────────────────────────────────────

function buildOrder(
  customerId: string,
  inputs: OrderInput[],
  productMap: Map<string, ProductSnapshot>,
  paymentMethod: 'paid' | 'debt' | 'cod' = 'debt',
): OrderHeader {
  const lineItems: LineItem[] = inputs.map(inp => {
    const p = productMap.get(inp.productId)!;
    return {
      product_id: p.id,
      product_name_snapshot: p.name,
      quantity: inp.quantity,
      price_vnd: p.sell_price_vnd,
      subtotal_vnd: p.sell_price_vnd * inp.quantity,
      notes: inp.notes ?? null,
    };
  });

  const totalAmountVnd = lineItems.reduce((sum, li) => sum + li.subtotal_vnd, 0);
  const totalQuantity = lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const maxDuration = Math.max(...inputs.map(i => productMap.get(i.productId)!.duration_days));
  const isMultiProduct = new Set(inputs.map(i => i.productId)).size > 1;
  const primary = lineItems[0];

  return {
    id: `ord_${Date.now()}`,
    customer_id: customerId,
    product_id: primary.product_id,
    product_name_snapshot: isMultiProduct ? null : primary.product_name_snapshot,
    unit_price_vnd: isMultiProduct ? null : primary.price_vnd,
    quantity: totalQuantity,
    total_amount_vnd: totalAmountVnd,
    total_paid: paymentMethod === 'paid' ? totalAmountVnd : 0,
    status: paymentMethod === 'paid' ? 'paid' : 'pending_payment',
    expires_at: new Date(Date.now() + maxDuration * 86400_000).toISOString(),
    items: lineItems,
  };
}

function buildInvoicePaymentSummary(order: OrderHeader) {
  const totalVnd = order.total_amount_vnd;
  const totalPaidVnd = order.total_paid;
  const remainingVnd = Math.max(totalVnd - totalPaidVnd, 0);
  return {
    subtotal_vnd: totalVnd,
    discount_vnd: 0,
    total_vnd: totalVnd,
    total_paid_vnd: totalPaidVnd,
    remaining_vnd: remainingVnd,
    fully_paid: remainingVnd === 0,
  };
}

function buildInvoiceNumber(orderId: string, createdAt: string): string {
  const dateStr = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '');
  const shortId = orderId.slice(-6).toUpperCase();
  return `INV-${dateStr}-${shortId}`;
}

// ── Test catalogue ────────────────────────────────────────────────────────────

const netflix = { id: 'prod_001', name: 'Netflix 1 tháng', sell_price_vnd: 100_000, duration_days: 30, is_active: true };
const spotify = { id: 'prod_002', name: 'Spotify 3 tháng', sell_price_vnd: 150_000, duration_days: 90, is_active: true };
const youtube = { id: 'prod_003', name: 'YouTube Premium', sell_price_vnd: 80_000, duration_days: 30, is_active: true };

const catalog = new Map([
  [netflix.id, netflix],
  [spotify.id, spotify],
  [youtube.id, youtube],
]);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Single-item order', () => {
  it('computes total correctly', () => {
    const order = buildOrder('cust_1', [{ productId: 'prod_001', quantity: 2 }], catalog);
    expect(order.total_amount_vnd).toBe(200_000);
    expect(order.quantity).toBe(2);
  });

  it('stores product_name_snapshot and unit_price_vnd on header', () => {
    const order = buildOrder('cust_1', [{ productId: 'prod_001', quantity: 1 }], catalog);
    expect(order.product_name_snapshot).toBe('Netflix 1 tháng');
    expect(order.unit_price_vnd).toBe(100_000);
  });

  it('single line item subtotal = price × qty', () => {
    const order = buildOrder('cust_1', [{ productId: 'prod_001', quantity: 3 }], catalog);
    expect(order.items[0].subtotal_vnd).toBe(300_000);
    expect(order.items[0].subtotal_vnd).toBe(order.items[0].price_vnd * order.items[0].quantity);
  });

  it('fully paid when paymentMethod = paid', () => {
    const order = buildOrder('cust_1', [{ productId: 'prod_001', quantity: 1 }], catalog, 'paid');
    expect(order.total_paid).toBe(100_000);
    expect(order.status).toBe('paid');
  });
});

describe('Multi-item order (different products)', () => {
  it('totals correctly across all line items', () => {
    // Netflix (100k × 2) + Spotify (150k × 1) = 350k
    const order = buildOrder('cust_1', [
      { productId: 'prod_001', quantity: 2 },
      { productId: 'prod_002', quantity: 1 },
    ], catalog);
    expect(order.total_amount_vnd).toBe(350_000);
    expect(order.quantity).toBe(3);
    expect(order.items).toHaveLength(2);
  });

  it('clears unit_price_vnd and product_name_snapshot on header (ambiguous for multi-product)', () => {
    const order = buildOrder('cust_1', [
      { productId: 'prod_001', quantity: 1 },
      { productId: 'prod_002', quantity: 1 },
    ], catalog);
    expect(order.unit_price_vnd).toBeNull();
    expect(order.product_name_snapshot).toBeNull();
  });

  it('each line item preserves its own price snapshot independently', () => {
    const order = buildOrder('cust_1', [
      { productId: 'prod_001', quantity: 1 },
      { productId: 'prod_002', quantity: 2 },
    ], catalog);
    expect(order.items[0].price_vnd).toBe(100_000);
    expect(order.items[1].price_vnd).toBe(150_000);
    expect(order.items[0].product_name_snapshot).toBe('Netflix 1 tháng');
    expect(order.items[1].product_name_snapshot).toBe('Spotify 3 tháng');
  });

  it('line item subtotals sum to order total', () => {
    const order = buildOrder('cust_1', [
      { productId: 'prod_001', quantity: 2 },
      { productId: 'prod_002', quantity: 3 },
      { productId: 'prod_003', quantity: 1 },
    ], catalog);
    const sumOfSubtotals = order.items.reduce((s, li) => s + li.subtotal_vnd, 0);
    expect(sumOfSubtotals).toBe(order.total_amount_vnd);
  });

  it('uses max duration_days for expires_at across all products', () => {
    // Netflix=30d, Spotify=90d → expires_at should be 90 days from now
    const now = Date.now();
    const order = buildOrder('cust_1', [
      { productId: 'prod_001', quantity: 1 },
      { productId: 'prod_002', quantity: 1 },
    ], catalog);
    const expiresMs = new Date(order.expires_at).getTime();
    const diffDays = Math.round((expiresMs - now) / 86400_000);
    expect(diffDays).toBe(90);
  });
});

describe('Multi-quantity same product', () => {
  it('correctly handles quantity > 1 for repeated same product', () => {
    // Two rows of same product with qty 3 each
    const order = buildOrder('cust_1', [
      { productId: 'prod_001', quantity: 3 },
      { productId: 'prod_001', quantity: 2 },
    ], catalog);
    // Both treated as separate line items (split explicitly by caller)
    expect(order.total_amount_vnd).toBe(100_000 * 5);
    expect(order.items).toHaveLength(2);
  });
});

describe('Invoice payment summary', () => {
  it('remaining = 0 when fully paid', () => {
    const order = buildOrder('cust_1', [{ productId: 'prod_001', quantity: 1 }], catalog, 'paid');
    const summary = buildInvoicePaymentSummary(order);
    expect(summary.remaining_vnd).toBe(0);
    expect(summary.fully_paid).toBe(true);
    expect(summary.total_paid_vnd).toBe(100_000);
  });

  it('remaining = total when unpaid', () => {
    const order = buildOrder('cust_1', [{ productId: 'prod_001', quantity: 1 }], catalog, 'debt');
    const summary = buildInvoicePaymentSummary(order);
    expect(summary.remaining_vnd).toBe(100_000);
    expect(summary.fully_paid).toBe(false);
    expect(summary.total_paid_vnd).toBe(0);
  });

  it('subtotal_vnd === total_vnd (no discount by default)', () => {
    const order = buildOrder('cust_1', [
      { productId: 'prod_001', quantity: 2 },
      { productId: 'prod_002', quantity: 1 },
    ], catalog);
    const summary = buildInvoicePaymentSummary(order);
    expect(summary.subtotal_vnd).toBe(summary.total_vnd);
    expect(summary.discount_vnd).toBe(0);
  });
});

describe('Invoice number', () => {
  it('generates deterministic INV-YYYYMMDD-SHORTID format', () => {
    const inv = buildInvoiceNumber('abc123XYZXYZ', '2026-03-06T10:00:00.000Z');
    expect(inv).toBe('INV-20260306-XYZXYZ');
  });

  it('invoice number is always uppercase', () => {
    const inv = buildInvoiceNumber('order_abcdef', '2026-01-15T00:00:00.000Z');
    expect(inv).toMatch(/^INV-\d{8}-[A-Z0-9]+$/);
  });
});

describe('Invoice line items — all data present for rendering', () => {
  it('every line item has all mandatory invoice fields', () => {
    const order = buildOrder('cust_1', [
      { productId: 'prod_001', quantity: 1, notes: 'Account A' },
      { productId: 'prod_002', quantity: 2 },
    ], catalog);
    for (const li of order.items) {
      expect(li.product_id).toBeTruthy();
      expect(li.product_name_snapshot).toBeTruthy();
      expect(li.quantity).toBeGreaterThan(0);
      expect(li.price_vnd).toBeGreaterThan(0);
      expect(li.subtotal_vnd).toBe(li.price_vnd * li.quantity);
    }
  });
});
