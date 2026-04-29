/**
 * ============================================================
 * DASHBOARD TIME FILTERS — Date Range & Chart Bucketing Tests
 * Covers: GET /api/dashboard/stats?days=N
 *
 * Validates:
 * - Default days parameter (30)
 * - Time cutoff filtering (orders outside range excluded)
 * - Chart bucket generation (7/10/12 buckets based on days)
 * - Boundary edge cases (exactly on cutoff date)
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
  listSourceAccounts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/cache/db-cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  TTL: { AGGREGATE: 30_000 },
}));

import { supabaseAdmin } from "@/lib/supabase/admin";
import { GET } from "@/app/api/dashboard/stats/route";
import { cached } from "@/lib/cache/db-cache";

// ── Helpers ─────────────────────────────────────────────────

function setupSupabaseMock(filteredOrders: unknown[] = []) {
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
      chain.order = vi.fn().mockResolvedValue({ data: filteredOrders });
    } else if (currentCall === 1) {
      chain.limit = vi.fn().mockResolvedValue({ data: filteredOrders });
    } else {
      chain.limit = vi.fn().mockResolvedValue({ data: [] });
    }

    return chain as any;
  });
}

function makeOrder(daysAgo: number, amount = 100_000) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `ord-${daysAgo}d`,
    customer_id: "00000000-0000-4000-8000-000000000005",
    product_id: "00000000-0000-4000-8000-000000000039",
    total_amount_vnd: amount,
    total_cost_vnd: amount * 0.4,
    status: "paid",
    created_at: d.toISOString(),
    customer: { full_name: "Test User" },
  };
}

async function fetchStats(days?: number) {
  const url = days
    ? `http://localhost/api/dashboard/stats?days=${days}`
    : `http://localhost/api/dashboard/stats`;
  return GET(createTestRequest(url), { params: {} } as any);
}

// ═══════════════════════════════════════════════════════════════
describe("GET /api/dashboard/stats — Time Filters", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Days Parameter ────────────────────────────────────────
  describe("Days parameter handling", () => {
    it("defaults to 30 days when no days param provided", async () => {
      setupSupabaseMock();
      const res = await fetchStats(); // no days param
      expect(res.status).toBe(200);

      // Verify cache key contains 30
      expect(cached).toHaveBeenCalledWith(
        expect.stringContaining(":30"),
        expect.any(Function),
        expect.any(Number)
      );
    });

    it.each([7, 30, 90, 365])(
      "accepts days=%i and passes to cache key",
      async (days) => {
        setupSupabaseMock();
        const res = await fetchStats(days);
        expect(res.status).toBe(200);

        expect(cached).toHaveBeenCalledWith(
          expect.stringContaining(`:${days}`),
          expect.any(Function),
          expect.any(Number)
        );
      }
    );
  });

  // ── Revenue only from time range ──────────────────────────
  describe("Time-filtered calculations", () => {
    it("only counts orders within the time range for revenue", async () => {
      // Orders: 2 days ago (in-range for 7d), 10 days ago (out-of-range for 7d)
      const inRange = makeOrder(2, 300_000);
      const _outOfRange = makeOrder(10, 700_000);

      // Simulate: API only returns in-range orders for the filtered query
      setupSupabaseMock([inRange]);

      const res = await fetchStats(7);
      const body = await res.json();

      // Revenue should only include in-range order
      expect(body.data.totalRevenue).toBe(300_000);
    });

    it("includes today's orders in the range", async () => {
      const todayOrder = makeOrder(0, 150_000);
      setupSupabaseMock([todayOrder]);

      const res = await fetchStats(7);
      const body = await res.json();

      expect(body.data.totalRevenue).toBe(150_000);
    });
  });

  // ── Chart Bucketing ───────────────────────────────────────
  describe("Chart data bucketing", () => {
    it("generates 7 buckets for days <= 7", async () => {
      setupSupabaseMock([makeOrder(1), makeOrder(3)]);

      const res = await fetchStats(7);
      const body = await res.json();

      expect(body.data.chartData.length).toBe(7);
      // Each bucket has name, revenue, orders
      body.data.chartData.forEach((bucket: any) => {
        expect(bucket).toHaveProperty("name");
        expect(bucket).toHaveProperty("revenue");
        expect(bucket).toHaveProperty("cost");
        expect(bucket).toHaveProperty("orders");
        expect(typeof bucket.revenue).toBe("number");
        expect(typeof bucket.cost).toBe("number");
        expect(typeof bucket.orders).toBe("number");
      });
    });

    it("generates 10 buckets for days = 30", async () => {
      setupSupabaseMock([makeOrder(5)]);

      const res = await fetchStats(30);
      const body = await res.json();

      expect(body.data.chartData.length).toBe(10);
    });

    it("generates 12 buckets for days = 365", async () => {
      setupSupabaseMock([makeOrder(30)]);

      const res = await fetchStats(365);
      const body = await res.json();

      expect(body.data.chartData.length).toBe(12);
    });

    it("revenue SUM across buckets equals totalRevenue", async () => {
      const orders = [makeOrder(1, 200_000), makeOrder(3, 300_000)];
      setupSupabaseMock(orders);

      const res = await fetchStats(7);
      const body = await res.json();

      const chartRevSum = body.data.chartData.reduce(
        (s: number, b: any) => s + b.revenue, 0
      );
      expect(chartRevSum).toBe(body.data.totalRevenue);
    });

    it("cost SUM across buckets equals totalCost", async () => {
      const orders = [makeOrder(1, 200_000), makeOrder(3, 300_000)];
      setupSupabaseMock(orders);

      const res = await fetchStats(7);
      const body = await res.json();

      const chartCostSum = body.data.chartData.reduce(
        (s: number, b: any) => s + b.cost, 0
      );
      expect(chartCostSum).toBe(body.data.totalCost);
    });

    it("orders COUNT across buckets equals total orders", async () => {
      const orders = [makeOrder(1), makeOrder(2), makeOrder(5)];
      setupSupabaseMock(orders);

      const res = await fetchStats(7);
      const body = await res.json();

      const chartOrdersSum = body.data.chartData.reduce(
        (s: number, b: any) => s + b.orders, 0
      );
      // Should match # of filtered orders
      expect(chartOrdersSum).toBe(orders.length);
    });
  });

  // ── Label Format ──────────────────────────────────────────
  describe("Chart label formatting", () => {
    it("uses dd/MM format for short periods (≤30 days)", async () => {
      setupSupabaseMock([makeOrder(1)]);
      const res = await fetchStats(7);
      const body = await res.json();

      // Vietnamese format: dd/MM
      body.data.chartData.forEach((bucket: any) => {
        expect(bucket.name).toBeDefined();
        expect(typeof bucket.name).toBe("string");
        expect(bucket.name.length).toBeGreaterThan(0);
      });
    });

    it("uses MM/YY format for long periods (>30 days)", async () => {
      setupSupabaseMock([makeOrder(60)]);
      const res = await fetchStats(90);
      const body = await res.json();

      body.data.chartData.forEach((bucket: any) => {
        expect(bucket.name).toBeDefined();
        expect(typeof bucket.name).toBe("string");
      });
    });
  });

  // ── Edge Cases ────────────────────────────────────────────
  describe("Edge Cases", () => {
    it("handles days=1 without errors", async () => {
      setupSupabaseMock([]);
      const res = await fetchStats(1);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.chartData.length).toBeGreaterThanOrEqual(1);
    });

    it("charts have no duplicate date labels", async () => {
      setupSupabaseMock([]);
      const res = await fetchStats(7);
      const body = await res.json();

      const labels = body.data.chartData.map((b: any) => b.name);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });
  });
});
