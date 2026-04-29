/**
 * Module 4: Inventory Intelligence — Unit Tests
 * Tests for profit calculation, mapper purchase fields, and dashboard aggregation.
 */

import { describe, it, expect } from "vitest";
import { mapRowToSourceAccount } from "@/lib/mappers/source-account.mapper";
import type { SourceAccountRow } from "@/lib/supabase/repositories/source-accounts.repo";

/* ─── Source Account Mapper: Purchase Fields ──────────────────────────── */

describe("mapRowToSourceAccount — purchase fields", () => {
  const baseRow: SourceAccountRow = {
    id: "00000000-0000-4000-8000-000000000036",
    account_id: "00000000-0000-4000-8000-000000000009",
    email: "test@example.com",
    provider: "netflix",
    max_slots: 6,
    used_slots: 2,
    product_ids: ["00000000-0000-4000-8000-000000000039"],
    notes: null,
    reserved_nicks: null,
    status: "active",
    expires_at: "2025-06-01T00:00:00Z",
    purchase_cost_vnd: null,
    purchase_date: null,
    purchase_source: null,
    deleted_at: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  it("maps null purchase fields to undefined", () => {
    const result = mapRowToSourceAccount(baseRow);
    expect(result.purchaseCostVnd).toBeUndefined();
    expect(result.purchaseDate).toBeUndefined();
    expect(result.purchaseSource).toBeUndefined();
  });

  it("maps populated purchase fields correctly", () => {
    const row = {
      ...baseRow,
      purchase_cost_vnd: 150000,
      purchase_date: "2025-01-15",
      purchase_source: "Shopee",
    };
    const result = mapRowToSourceAccount(row);
    expect(result.purchaseCostVnd).toBe(150000);
    expect(result.purchaseDate).toBe("2025-01-15");
    expect(result.purchaseSource).toBe("Shopee");
  });

  it("maps zero purchase cost correctly", () => {
    const row = { ...baseRow, purchase_cost_vnd: 0 };
    const result = mapRowToSourceAccount(row);
    // 0 ?? undefined === 0 (nullish coalescing doesn't treat 0 as null)
    expect(result.purchaseCostVnd).toBe(0);
  });

  it("preserves all other fields when purchase fields are set", () => {
    const row = {
      ...baseRow,
      purchase_cost_vnd: 200000,
      purchase_date: "2025-03-01",
      purchase_source: "Direct",
    };
    const result = mapRowToSourceAccount(row);
    expect(result.id).toBe("00000000-0000-4000-8000-000000000036");
    expect(result.email).toBe("test@example.com");
    expect(result.provider).toBe("netflix");
    expect(result.maxSlots).toBe(6);
    expect(result.usedSlots).toBe(2);
    expect(result.expiresAt).toBe("2025-06-01T00:00:00Z");
  });
});

/* ─── Profit Calculation Logic (Unit) ─────────────────────────────────── */

describe("Profit calculation logic", () => {
  /**
   * Simulates the profit calculation from the API route
   * to verify the math is correct independent of HTTP layer.
   */
  function calculateProfit(
    purchaseCost: number,
    revenue: number,
  ) {
    const profit = revenue - purchaseCost;
    const roi = purchaseCost > 0 ? Math.round((profit / purchaseCost) * 100) : null;
    return { purchaseCost, revenue, profit, roi };
  }

  it("calculates positive profit with correct ROI", () => {
    const result = calculateProfit(100000, 300000);
    expect(result.profit).toBe(200000);
    expect(result.roi).toBe(200);
  });

  it("calculates negative profit (loss)", () => {
    const result = calculateProfit(500000, 200000);
    expect(result.profit).toBe(-300000);
    expect(result.roi).toBe(-60);
  });

  it("handles zero cost (ROI = null)", () => {
    const result = calculateProfit(0, 150000);
    expect(result.profit).toBe(150000);
    expect(result.roi).toBeNull();
  });

  it("handles zero revenue", () => {
    const result = calculateProfit(100000, 0);
    expect(result.profit).toBe(-100000);
    expect(result.roi).toBe(-100);
  });

  it("handles break-even", () => {
    const result = calculateProfit(100000, 100000);
    expect(result.profit).toBe(0);
    expect(result.roi).toBe(0);
  });
});

/* ─── Dashboard Aggregation Logic ─────────────────────────────────────── */

describe("Dashboard aggregation — totalPurchaseCostVnd", () => {
  function aggregatePurchaseCost(
    accounts: Array<{ purchase_cost_vnd: number | null }>,
  ): number {
    return accounts.reduce((s, a) => s + (a.purchase_cost_vnd ?? 0), 0);
  }

  it("sums purchase costs across accounts", () => {
    const accounts = [
      { purchase_cost_vnd: 100000 },
      { purchase_cost_vnd: 200000 },
      { purchase_cost_vnd: 50000 },
    ];
    expect(aggregatePurchaseCost(accounts)).toBe(350000);
  });

  it("treats null costs as zero", () => {
    const accounts = [
      { purchase_cost_vnd: 100000 },
      { purchase_cost_vnd: null },
      { purchase_cost_vnd: 200000 },
    ];
    expect(aggregatePurchaseCost(accounts)).toBe(300000);
  });

  it("returns 0 for empty array", () => {
    expect(aggregatePurchaseCost([])).toBe(0);
  });

  it("returns 0 when all costs are null", () => {
    const accounts = [
      { purchase_cost_vnd: null },
      { purchase_cost_vnd: null },
    ];
    expect(aggregatePurchaseCost(accounts)).toBe(0);
  });
});
