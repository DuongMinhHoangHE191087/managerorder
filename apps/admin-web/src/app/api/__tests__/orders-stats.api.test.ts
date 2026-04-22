/**
 * ============================================================
 * ORDERS STATS API — Multi-Filter & RPC Fallback Tests
 * Covers: GET /api/orders/stats
 *
 * Strategy: Mock getOrdersStats → verify filter passthrough,
 * status counts, debt calculation, and RPC fallback behavior.
 * ============================================================
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  TEST_ACCOUNT_ID,
} from "./helpers/setup";

// ── Mocks ───────────────────────────────────────────────────
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  getOrdersStats: vi.fn(),
}));

import { getOrdersStats } from "@/lib/supabase/repositories/orders.repo";
import { GET } from "@/app/api/orders/stats/route";

// ── Test Data ───────────────────────────────────────────────

function makeStats(overrides: Record<string, unknown> = {}) {
  return {
    total_orders: 100,
    total_revenue: 10_000_000,
    total_cost: 4_000_000,
    total_profit: 6_000_000,
    total_paid_amount: 8_000_000,
    total_debt: 2_000_000,
    pending_count: 15,
    active_count: 50,
    paid_count: 25,
    expired_count: 10,
    ...overrides,
  };
}

async function fetchOrderStats(params: Record<string, string> = {}) {
  const search = new URLSearchParams(params).toString();
  const url = `http://localhost/api/orders/stats${search ? `?${search}` : ""}`;
  return GET(createTestRequest(url), { params: {} } as any);
}

// ═══════════════════════════════════════════════════════════════
describe("GET /api/orders/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrdersStats).mockResolvedValue(makeStats());
  });

  // ── Basic Response ────────────────────────────────────────
  describe("Basic Response", () => {
    it("returns 200 with stats data", async () => {
      const res = await fetchOrderStats();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.total_orders).toBe(100);
    });

    it("returns all stat fields", async () => {
      const res = await fetchOrderStats();
      const body = await res.json();
      const { data } = body;

      expect(data).toHaveProperty("total_orders");
      expect(data).toHaveProperty("total_revenue");
      expect(data).toHaveProperty("total_cost");
      expect(data).toHaveProperty("total_profit");
      expect(data).toHaveProperty("total_paid_amount");
      expect(data).toHaveProperty("total_debt");
      expect(data).toHaveProperty("pending_count");
      expect(data).toHaveProperty("active_count");
      expect(data).toHaveProperty("paid_count");
      expect(data).toHaveProperty("expired_count");
    });
  });

  // ── Filter Passthrough ────────────────────────────────────
  describe("Filter Passthrough", () => {
    it("passes status filter to getOrdersStats", async () => {
      await fetchOrderStats({ status: "pending_payment" });

      expect(getOrdersStats).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({ status: "pending_payment" })
      );
    });

    it("passes customer_id filter", async () => {
      await fetchOrderStats({ customer_id: "cust-123" });

      expect(getOrdersStats).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({ customerId: "cust-123" })
      );
    });

    it("passes date_from and date_to filters", async () => {
      await fetchOrderStats({
        date_from: "2025-01-01",
        date_to: "2025-12-31",
      });

      expect(getOrdersStats).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({
          date_from: "2025-01-01",
          date_to: "2025-12-31",
        })
      );
    });

    it("passes search filter", async () => {
      await fetchOrderStats({ search: "DMH_001" });

      expect(getOrdersStats).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({ search: "DMH_001" })
      );
    });

    it("passes all filters combined", async () => {
      await fetchOrderStats({
        search: "DMH",
        status: "paid",
        customer_id: "c1",
        date_from: "2025-01-01",
        date_to: "2025-06-30",
      });

      expect(getOrdersStats).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({
          search: "DMH",
          status: "paid",
          customerId: "c1",
          date_from: "2025-01-01",
          date_to: "2025-06-30",
        })
      );
    });

    it("omits undefined params (no filter = all orders)", async () => {
      await fetchOrderStats();

      expect(getOrdersStats).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({
          search: undefined,
          status: undefined,
          customerId: undefined,
          date_from: undefined,
          date_to: undefined,
        })
      );
    });
  });

  // ── Debt Calculation ──────────────────────────────────────
  describe("Debt Calculation", () => {
    it("total_debt = total_revenue - total_paid_amount", async () => {
      vi.mocked(getOrdersStats).mockResolvedValue(
        makeStats({
          total_revenue: 5_000_000,
          total_paid_amount: 3_500_000,
          total_debt: 1_500_000,
        })
      );

      const res = await fetchOrderStats();
      const body = await res.json();

      expect(body.data.total_debt).toBe(1_500_000);
      expect(body.data.total_debt).toBe(
        body.data.total_revenue - body.data.total_paid_amount
      );
    });

    it("total_debt = 0 when fully paid", async () => {
      vi.mocked(getOrdersStats).mockResolvedValue(
        makeStats({
          total_revenue: 2_000_000,
          total_paid_amount: 2_000_000,
          total_debt: 0,
        })
      );

      const res = await fetchOrderStats();
      const body = await res.json();

      expect(body.data.total_debt).toBe(0);
    });
  });

  // ── Status Counts ─────────────────────────────────────────
  describe("Status Counts", () => {
    it("all status counts sum correctly", async () => {
      vi.mocked(getOrdersStats).mockResolvedValue(
        makeStats({
          total_orders: 100,
          pending_count: 15,
          active_count: 50,
          paid_count: 25,
          expired_count: 10,
        })
      );

      const res = await fetchOrderStats();
      const body = await res.json();

      expect(body.data.pending_count).toBe(15);
      expect(body.data.active_count).toBe(50);
      expect(body.data.paid_count).toBe(25);
      expect(body.data.expired_count).toBe(10);

      const statusSum =
        body.data.pending_count +
        body.data.active_count +
        body.data.paid_count +
        body.data.expired_count;
      expect(statusSum).toBe(100);
    });

    it("handles zero orders gracefully", async () => {
      vi.mocked(getOrdersStats).mockResolvedValue(
        makeStats({
          total_orders: 0,
          total_revenue: 0,
          total_cost: 0,
          total_profit: 0,
          total_paid_amount: 0,
          total_debt: 0,
          pending_count: 0,
          active_count: 0,
          paid_count: 0,
          expired_count: 0,
        })
      );

      const res = await fetchOrderStats();
      const body = await res.json();

      expect(body.data.total_orders).toBe(0);
      expect(body.data.total_revenue).toBe(0);
    });
  });

  // ── Error Handling ────────────────────────────────────────
  describe("Error Handling", () => {
    it("returns 500 when getOrdersStats throws", async () => {
      vi.mocked(getOrdersStats).mockRejectedValue(
        new Error("Database connection timeout")
      );

      const res = await fetchOrderStats();
      expect(res.status).toBe(500);
    });
  });

  // ── Integer Safety ────────────────────────────────────────
  describe("Integer Safety (VND)", () => {
    it("all monetary values are integers", async () => {
      vi.mocked(getOrdersStats).mockResolvedValue(
        makeStats({
          total_revenue: 15_750_000,
          total_cost: 6_300_000,
          total_profit: 9_450_000,
          total_paid_amount: 12_600_000,
          total_debt: 3_150_000,
        })
      );

      const res = await fetchOrderStats();
      const body = await res.json();

      expect(Number.isInteger(body.data.total_revenue)).toBe(true);
      expect(Number.isInteger(body.data.total_cost)).toBe(true);
      expect(Number.isInteger(body.data.total_profit)).toBe(true);
      expect(Number.isInteger(body.data.total_paid_amount)).toBe(true);
      expect(Number.isInteger(body.data.total_debt)).toBe(true);
    });
  });
});
