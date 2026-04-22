/**
 * ============================================================
 * DASHBOARD CROSS-CHECK — API vs Raw Data Integrity
 * Covers: Verifying API aggregation matches raw source data
 *
 * Principle: Create known test data → call API → assert
 * output matches manually computed expected values.
 *
 * CRITICAL: These tests verify business accuracy, catching
 * aggregation bugs that would cause incorrect financial reports.
 * ============================================================
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
} from "./helpers/setup";

// ── Mocks ───────────────────────────────────────────────────
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/supabase/repositories/products.repo", () => ({
  listProducts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  listSourceAccounts: vi.fn(),
}));
vi.mock("@/lib/cache/db-cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  TTL: { AGGREGATE: 30_000 },
}));

import { supabaseAdmin } from "@/lib/supabase/admin";
import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { listProducts } from "@/lib/supabase/repositories/products.repo";
import { GET } from "@/app/api/dashboard/stats/route";

// ── Test Data Factory ───────────────────────────────────────

const KNOWN_ORDERS = [
  { id: "o1", customer_id: "c1", product_id: "p1", total_amount_vnd: 500_000, total_cost_vnd: 200_000, status: "paid", created_at: new Date().toISOString(), customer: { full_name: "Hoàng A" } },
  { id: "o2", customer_id: "c2", product_id: "p1", total_amount_vnd: 300_000, total_cost_vnd: 120_000, status: "pending_payment", created_at: new Date().toISOString(), customer: { full_name: "Trần B" } },
  { id: "o3", customer_id: "c1", product_id: "p2", total_amount_vnd: 1_000_000, total_cost_vnd: 400_000, status: "active", created_at: new Date().toISOString(), customer: { full_name: "Hoàng A" } },
  { id: "o4", customer_id: "c3", product_id: "p2", total_amount_vnd: 200_000, total_cost_vnd: 80_000, status: "pending_payment", created_at: new Date().toISOString(), customer: { full_name: "Lê C" } },
  { id: "o5", customer_id: "c2", product_id: "p1", total_amount_vnd: 750_000, total_cost_vnd: 300_000, status: "paid", created_at: new Date().toISOString(), customer: null },
];

// Pre-computed expected values from KNOWN_ORDERS
const EXPECTED = {
  totalRevenue: 500_000 + 300_000 + 1_000_000 + 200_000 + 750_000, // 2,750,000
  totalCost: 200_000 + 120_000 + 400_000 + 80_000 + 300_000, // 1,100,000
  totalProfit: 2_750_000 - 1_100_000, // 1,650,000
  pendingCount: 2, // o2, o4
  totalOrders: 5,
};

const KNOWN_ACCOUNTS = [
  { id: "sa1", email: "sa1@test.com", max_slots: 10, used_slots: 8, product_ids: ["p1"], expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), purchase_cost_vnd: 500_000 },
  { id: "sa2", email: "sa2@test.com", max_slots: 20, used_slots: 5, product_ids: ["p2"], expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(), purchase_cost_vnd: 1_000_000 },
  { id: "sa3", email: "sa3@test.com", max_slots: 5, used_slots: 5, product_ids: ["p1"], expires_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), purchase_cost_vnd: 200_000 },
];

const EXPECTED_SLOTS = {
  totalSlots: 10 + 20 + 5, // 35
  usedSlots: 8 + 5 + 5, // 18
  availableSlots: 35 - 18, // 17
  fillRate: Math.round((18 / 35) * 100), // 51
  expiringCount: 2, // sa1, sa3 (within 7 days)
};

function setupMocks() {
  let callIndex = 0;

  vi.mocked(supabaseAdmin.from).mockImplementation(() => {
    const currentCall = callIndex++;
    const chain: Record<string, any> = {};

    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.gt = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue({ data: [] });

    if (currentCall === 0) {
      chain.order = vi.fn().mockResolvedValue({ data: KNOWN_ORDERS });
    } else if (currentCall === 1) {
      chain.limit = vi.fn().mockResolvedValue({ data: KNOWN_ORDERS });
    } else {
      chain.limit = vi.fn().mockResolvedValue({ data: [] });
    }

    return chain as any;
  });

  vi.mocked(listSourceAccounts).mockResolvedValue(KNOWN_ACCOUNTS as any);
  vi.mocked(listProducts).mockResolvedValue([
    { id: "p1", name: "Netflix" },
    { id: "p2", name: "Spotify" },
  ] as any);
}

async function fetchStats(days = 30) {
  return GET(createTestRequest(`http://localhost/api/dashboard/stats?days=${days}`), { params: {} } as any);
}

// ═══════════════════════════════════════════════════════════════
describe("Dashboard Cross-Check — API vs Expected Values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // ── Revenue Cross-Check ───────────────────────────────────
  describe("Revenue Accuracy", () => {
    it("totalRevenue === hand-calculated SUM(total_amount_vnd)", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalRevenue).toBe(EXPECTED.totalRevenue);
      expect(body.data.totalRevenue).toBe(2_750_000);
    });

    it("totalCost === hand-calculated SUM(total_cost_vnd)", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalCost).toBe(EXPECTED.totalCost);
      expect(body.data.totalCost).toBe(1_100_000);
    });
  });

  // ── Profit Formula Cross-Check ────────────────────────────
  describe("Profit Formula Integrity", () => {
    it("totalProfit === totalRevenue - totalCost (always derived)", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalProfit).toBe(EXPECTED.totalProfit);
      expect(body.data.totalProfit).toBe(body.data.totalRevenue - body.data.totalCost);
      expect(body.data.totalProfit).toBe(1_650_000);
    });

    it("profit is never negative when revenue > cost", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalProfit).toBeGreaterThan(0);
    });
  });

  // ── Status Count Cross-Check ──────────────────────────────
  describe("Status Count Accuracy", () => {
    it("pendingCount === COUNT where status='pending_payment'", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.pendingCount).toBe(EXPECTED.pendingCount);
      expect(body.data.pendingCount).toBe(2);
    });
  });

  // ── Slot Cross-Check ──────────────────────────────────────
  describe("Slot Aggregation Cross-Check", () => {
    it("totalSlots === SUM(max_slots) from source_accounts", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalSlots).toBe(EXPECTED_SLOTS.totalSlots);
      expect(body.data.totalSlots).toBe(35);
    });

    it("usedSlots === SUM(used_slots) from source_accounts", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.usedSlots).toBe(EXPECTED_SLOTS.usedSlots);
      expect(body.data.usedSlots).toBe(18);
    });

    it("availableSlots === totalSlots - usedSlots", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.availableSlots).toBe(EXPECTED_SLOTS.availableSlots);
      expect(body.data.availableSlots).toBe(17);
    });

    it("fillRate === round(usedSlots / totalSlots * 100)", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.fillRate).toBe(EXPECTED_SLOTS.fillRate);
      expect(body.data.fillRate).toBe(51);
    });
  });

  // ── Expiring Accounts Cross-Check ─────────────────────────
  describe("Expiring Accounts Cross-Check", () => {
    it("only includes accounts expiring within 7 days from now", async () => {
      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.expiringAccounts.length).toBe(EXPECTED_SLOTS.expiringCount);
      expect(body.data.expiringAccounts.length).toBe(2);
    });

    it("sorted by nearest expiry first", async () => {
      const res = await fetchStats();
      const body = await res.json();

      if (body.data.expiringAccounts.length >= 2) {
        const days = body.data.expiringAccounts.map((a: any) => a.daysLeft);
        // Ascending order
        for (let i = 1; i < days.length; i++) {
          expect(days[i]).toBeGreaterThanOrEqual(days[i - 1]);
        }
      }
    });
  });

  // ── Top Products Cross-Check ──────────────────────────────
  describe("Top Products Cross-Check", () => {
    it("aggregates revenue per product correctly", async () => {
      const res = await fetchStats();
      const body = await res.json();

      const top = body.data.topProducts;
      expect(top.length).toBe(2);

      // p1: o1(500K) + o2(300K) + o5(750K) = 1,550,000 (orders: 3)
      // p2: o3(1M) + o4(200K) = 1,200,000 (orders: 2)
      const p1 = top.find((p: any) => p.name === "Netflix");
      const p2 = top.find((p: any) => p.name === "Spotify");

      expect(p1.revenue).toBe(1_550_000);
      expect(p1.count).toBe(3);
      expect(p2.revenue).toBe(1_200_000);
      expect(p2.count).toBe(2);
    });

    it("sorted by revenue DESC", async () => {
      const res = await fetchStats();
      const body = await res.json();

      const top = body.data.topProducts;
      // Netflix (1.55M) > Spotify (1.2M)
      expect(top[0].name).toBe("Netflix");
      expect(top[1].name).toBe("Spotify");
    });
  });

  // ── Chart Data Integrity ──────────────────────────────────
  describe("Chart Data Integrity", () => {
    it("SUM(chart bucket revenues) === totalRevenue", async () => {
      const res = await fetchStats();
      const body = await res.json();

      const chartRevSum = body.data.chartData.reduce(
        (s: number, b: any) => s + b.revenue, 0
      );
      expect(chartRevSum).toBe(body.data.totalRevenue);
    });

    it("SUM(chart bucket cost) === totalCost", async () => {
      const res = await fetchStats();
      const body = await res.json();

      const chartCostSum = body.data.chartData.reduce(
        (s: number, b: any) => s + b.cost, 0
      );
      expect(chartCostSum).toBe(body.data.totalCost);
    });

    it("SUM(chart bucket orders) === total orders count", async () => {
      const res = await fetchStats();
      const body = await res.json();

      const chartOrdersSum = body.data.chartData.reduce(
        (s: number, b: any) => s + b.orders, 0
      );
      expect(chartOrdersSum).toBe(EXPECTED.totalOrders);
    });
  });
});
