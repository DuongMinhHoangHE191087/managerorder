/**
 * Order Service — Pure Logic Unit Tests
 * Tests buildLineItems, calculateExpiryDate extracted logic
 * (Service uses Supabase RPC, so we test the pure-function logic portions)
 */

import { describe, it, expect } from "vitest";

// ── buildLineItems logic extraction ──────────────────────────
// Replicate the pure logic since the function is not exported
interface ProductSnapshot {
  id: string;
  name: string;
  buy_price_vnd: number;
  sell_price_vnd: number;
  duration_type: string;
  duration_value: number;
  is_active: boolean;
}

interface LineItem {
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  price_vnd: number;
  cost_price_vnd: number;
  subtotal_vnd: number;
}

function buildLineItems(
  items: Array<{ productId: string; quantity: number }>,
  productMap: Map<string, ProductSnapshot>,
): LineItem[] {
  return items.map(item => {
    const p = productMap.get(item.productId);
    if (!p) throw new Error(`Product not found: ${item.productId}`);
    return {
      product_id: item.productId,
      product_name_snapshot: p.name,
      quantity: item.quantity,
      price_vnd: p.sell_price_vnd,
      cost_price_vnd: p.buy_price_vnd,
      subtotal_vnd: p.sell_price_vnd * item.quantity,
    };
  });
}

function calculateExpiryDate(
  durationType: "days" | "months" | "years",
  durationValue: number,
  registeredAt?: string,
): string {
  const dt = registeredAt ? new Date(registeredAt) : new Date();
  if (durationType === "years") {
    dt.setFullYear(dt.getFullYear() + durationValue);
  } else if (durationType === "months") {
    dt.setMonth(dt.getMonth() + durationValue);
  } else {
    dt.setDate(dt.getDate() + durationValue);
  }
  return dt.toISOString();
}

// ── Tests ────────────────────────────────────────────────────

describe("buildLineItems (order service logic)", () => {
  const products = new Map<string, ProductSnapshot>([
    ["prod-001", {
      id: "prod-001", name: "Netflix Premium",
      buy_price_vnd: 100_000, sell_price_vnd: 150_000,
      duration_type: "months", duration_value: 1, is_active: true,
    }],
    ["prod-002", {
      id: "prod-002", name: "Spotify Family",
      buy_price_vnd: 50_000, sell_price_vnd: 80_000,
      duration_type: "months", duration_value: 1, is_active: true,
    }],
  ]);

  it("builds line items with correct prices", () => {
    const items = buildLineItems([
      { productId: "prod-001", quantity: 2 },
    ], products);
    expect(items).toHaveLength(1);
    expect(items[0].price_vnd).toBe(150_000);
    expect(items[0].cost_price_vnd).toBe(100_000);
    expect(items[0].subtotal_vnd).toBe(300_000);
  });

  it("handles multi-product orders", () => {
    const items = buildLineItems([
      { productId: "prod-001", quantity: 1 },
      { productId: "prod-002", quantity: 3 },
    ], products);
    expect(items).toHaveLength(2);
    expect(items[1].subtotal_vnd).toBe(240_000);
  });

  it("throws for non-existent product", () => {
    expect(() => buildLineItems([
      { productId: "prod-999", quantity: 1 },
    ], products)).toThrow("Product not found");
  });

  it("calculates subtotal correctly for quantity > 1", () => {
    const items = buildLineItems([
      { productId: "prod-002", quantity: 5 },
    ], products);
    expect(items[0].subtotal_vnd).toBe(400_000);
  });

  it("preserves product name snapshot", () => {
    const items = buildLineItems([{ productId: "prod-001", quantity: 1 }], products);
    expect(items[0].product_name_snapshot).toBe("Netflix Premium");
  });
});

describe("calculateExpiryDate (order service logic)", () => {
  it("adds days correctly", () => {
    const result = calculateExpiryDate("days", 30, "2026-01-01T00:00:00Z");
    expect(new Date(result).getDate()).toBe(31);
    expect(new Date(result).getMonth()).toBe(0); // January
  });

  it("adds months correctly", () => {
    const result = calculateExpiryDate("months", 3, "2026-01-15T00:00:00Z");
    expect(new Date(result).getMonth()).toBe(3); // April
  });

  it("adds years correctly", () => {
    const result = calculateExpiryDate("years", 1, "2026-01-15T00:00:00Z");
    expect(new Date(result).getFullYear()).toBe(2027);
  });

  it("handles month overflow (Nov + 3 = Feb next year)", () => {
    const result = calculateExpiryDate("months", 3, "2026-11-15T00:00:00Z");
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(1); // February
  });

  it("uses current date when registeredAt is undefined", () => {
    const result = calculateExpiryDate("days", 30);
    const expected = new Date();
    expected.setDate(expected.getDate() + 30);
    // Should be within 1 day of expected
    expect(Math.abs(new Date(result).getTime() - expected.getTime())).toBeLessThan(86400000);
  });

  it("handles leap year", () => {
    const result = calculateExpiryDate("days", 366, "2024-01-01T00:00:00Z");
    expect(new Date(result).getFullYear()).toBe(2025);
  });
});

describe("order totals calculation", () => {
  it("sums total amount and cost correctly", () => {
    const lineItems: LineItem[] = [
      { product_id: "p1", product_name_snapshot: "A", quantity: 2, price_vnd: 100_000, cost_price_vnd: 70_000, subtotal_vnd: 200_000 },
      { product_id: "p2", product_name_snapshot: "B", quantity: 1, price_vnd: 150_000, cost_price_vnd: 100_000, subtotal_vnd: 150_000 },
    ];
    const totalAmount = lineItems.reduce((s, li) => s + li.subtotal_vnd, 0);
    const totalCost = lineItems.reduce((s, li) => s + (li.cost_price_vnd * li.quantity), 0);
    expect(totalAmount).toBe(350_000);
    expect(totalCost).toBe(240_000);
  });

  it("handles empty line items", () => {
    const lineItems: LineItem[] = [];
    const totalAmount = lineItems.reduce((s, li) => s + li.subtotal_vnd, 0);
    expect(totalAmount).toBe(0);
  });
});
