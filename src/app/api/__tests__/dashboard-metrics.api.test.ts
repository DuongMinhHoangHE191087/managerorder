/**
 * ============================================================
 * DASHBOARD METRICS API — KPI Accuracy & Aggregation Tests
 * Covers: GET /api/dashboard/stats
 *
 * Strategy: Mock Supabase + repos → verify KPI calculations
 * are mathematically correct against known input data.
 *
 * Cross-check principle:
 *   API totalRevenue === SUM(mock order.total_amount_vnd)
 *   API totalProfit  === totalRevenue - totalCost
 *   API fillRate     === round(usedSlots / totalSlots * 100)
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
  listProducts: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  listSourceAccounts: vi.fn(),
}));
vi.mock("@/lib/cache/db-cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  TTL: { AGGREGATE: 30_000 },
}));

// ── Imports ─────────────────────────────────────────────────
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listProducts } from "@/lib/supabase/repositories/products.repo";
import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { GET } from "@/app/api/dashboard/stats/route";

// ── Helpers ─────────────────────────────────────────────────
const DAY_MS = 86_400_000;

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord-001",
    customer_id: "cust-001",
    product_id: "prod-001",
    total_amount_vnd: 500_000,
    total_cost_vnd: 200_000,
    status: "paid",
    created_at: new Date().toISOString(),
    customer: { full_name: "Nguyễn Văn A" },
    ...overrides,
  };
}

function makeSourceAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "sa-001",
    email: "sa@test.com",
    max_slots: 10,
    used_slots: 5,
    product_ids: ["prod-001"],
    expires_at: new Date(Date.now() + 60 * DAY_MS).toISOString(),
    purchase_cost_vnd: 300_000,
    ...overrides,
  };
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return { id: "prod-001", name: "Netflix Premium", ...overrides };
}

/**
 * Sets up the Supabase mock chain used by the dashboard stats route.
 * The route calls supabase.from() multiple times with Promise.all.
 */
function setupSupabaseMock(
  filteredOrders: unknown[] = [],
  allOrders: unknown[] = [],
  overdueCustomers: unknown[] = []
) {
  let callIndex = 0;

  const createChain = () => {
    const currentCall = callIndex++;
    const chain: Record<string, any> = {};

    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.gt = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);

    // Different data per call order (matches Promise.all in route):
    // 0 = filtered orders, 1 = all orders, 4 = overdue customers
    if (currentCall === 0) {
      chain.order = vi.fn().mockResolvedValue({ data: filteredOrders });
    } else if (currentCall === 1) {
      chain.limit = vi.fn().mockResolvedValue({ data: allOrders });
    } else {
      // customers query (index 4 in Promise.all, but 2nd .from call after repos)
      chain.limit = vi.fn().mockResolvedValue({ data: overdueCustomers });
    }

    return chain;
  };

  vi.mocked(supabaseAdmin.from).mockImplementation(() => createChain() as any);
}

function setupDefaults(
  orders: unknown[] = [makeOrder()],
  accounts: unknown[] = [makeSourceAccount()],
  products: unknown[] = [makeProduct()]
) {
  vi.mocked(listProducts).mockResolvedValue(products as any);
  vi.mocked(listSourceAccounts).mockResolvedValue(accounts as any);
  setupSupabaseMock(orders, orders);
}

async function fetchStats(days = 30) {
  return GET(createTestRequest(`http://localhost/api/dashboard/stats?days=${days}`), { params: {} } as any);
}

// ═══════════════════════════════════════════════════════════════
describe("GET /api/dashboard/stats — KPI Accuracy", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Revenue & Profit Calculations ─────────────────────────
  describe("Revenue & Profit", () => {
    it("totalRevenue = SUM(total_amount_vnd) of filtered orders", async () => {
      const orders = [
        makeOrder({ id: "o1", total_amount_vnd: 300_000, total_cost_vnd: 100_000 }),
        makeOrder({ id: "o2", total_amount_vnd: 700_000, total_cost_vnd: 250_000 }),
      ];
      setupDefaults(orders);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalRevenue).toBe(1_000_000);
      expect(body.data.totalCost).toBe(350_000);
    });

    it("totalProfit = totalRevenue - totalCost (derived, not stored)", async () => {
      const orders = [
        makeOrder({ total_amount_vnd: 1_000_000, total_cost_vnd: 400_000 }),
      ];
      setupDefaults(orders);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalProfit).toBe(600_000);
      expect(body.data.totalProfit).toBe(body.data.totalRevenue - body.data.totalCost);
    });

    it("pendingCount = COUNT orders with status='pending_payment'", async () => {
      const orders = [
        makeOrder({ id: "o1", status: "pending_payment" }),
        makeOrder({ id: "o2", status: "pending_payment" }),
        makeOrder({ id: "o3", status: "paid" }),
        makeOrder({ id: "o4", status: "active" }),
      ];
      setupDefaults(orders);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.pendingCount).toBe(2);
    });
  });

  // ── Data-driven VND Scenarios ─────────────────────────────
  describe("VND precision (no floating-point errors)", () => {
    const vndCases = [
      { label: "zero", revenue: 0, cost: 0 },
      { label: "100K", revenue: 100_000, cost: 30_000 },
      { label: "1M", revenue: 1_000_000, cost: 450_000 },
      { label: "10M", revenue: 10_000_000, cost: 3_500_000 },
      { label: "999M", revenue: 999_000_000, cost: 500_000_000 },
    ];

    it.each(vndCases)(
      "computes correctly for $label VND",
      async ({ revenue, cost }) => {
        setupDefaults([makeOrder({ total_amount_vnd: revenue, total_cost_vnd: cost })]);

        const res = await fetchStats();
        const body = await res.json();

        expect(body.data.totalRevenue).toBe(revenue);
        expect(body.data.totalCost).toBe(cost);
        expect(body.data.totalProfit).toBe(revenue - cost);
        // Verify integer — no floating point
        expect(Number.isInteger(body.data.totalProfit)).toBe(true);
      }
    );
  });

  // ── Slot Metrics ──────────────────────────────────────────
  describe("Slot Metrics", () => {
    it("totalSlots = SUM(max_slots), usedSlots = SUM(used_slots)", async () => {
      const accounts = [
        makeSourceAccount({ id: "sa1", max_slots: 10, used_slots: 7 }),
        makeSourceAccount({ id: "sa2", max_slots: 20, used_slots: 12 }),
      ];
      setupDefaults([], accounts);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalSlots).toBe(30);
      expect(body.data.usedSlots).toBe(19);
      expect(body.data.availableSlots).toBe(11);
    });

    it("fillRate = round(usedSlots/totalSlots * 100)", async () => {
      const accounts = [
        makeSourceAccount({ max_slots: 10, used_slots: 7 }),
      ];
      setupDefaults([], accounts);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.fillRate).toBe(70); // 7/10*100 = 70
    });

    it("fillRate = 0 when totalSlots = 0 (division by zero guard)", async () => {
      const accounts = [
        makeSourceAccount({ max_slots: 0, used_slots: 0 }),
      ];
      setupDefaults([], accounts);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.fillRate).toBe(0);
    });

    it("availableSlots never negative (guard: max(0, total - used))", async () => {
      // Edge case: used > max (data inconsistency)
      const accounts = [
        makeSourceAccount({ max_slots: 5, used_slots: 8 }),
      ];
      setupDefaults([], accounts);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.availableSlots).toBe(0); // max(0, 5-8)
    });
  });

  // ── Top Products ──────────────────────────────────────────
  describe("Top Products", () => {
    it("returns products sorted by revenue DESC, max 5", async () => {
      const products = [
        makeProduct({ id: "p1", name: "Netflix" }),
        makeProduct({ id: "p2", name: "Spotify" }),
        makeProduct({ id: "p3", name: "YouTube" }),
      ];
      const orders = [
        makeOrder({ id: "o1", product_id: "p1", total_amount_vnd: 100_000 }),
        makeOrder({ id: "o2", product_id: "p2", total_amount_vnd: 500_000 }),
        makeOrder({ id: "o3", product_id: "p3", total_amount_vnd: 300_000 }),
        makeOrder({ id: "o4", product_id: "p2", total_amount_vnd: 200_000 }),
      ];
      setupDefaults(orders, [], products);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.topProducts.length).toBeLessThanOrEqual(5);
      expect(body.data.topProducts[0].name).toBe("Spotify"); // 700K
      expect(body.data.topProducts[0].revenue).toBe(700_000);
      expect(body.data.topProducts[0].count).toBe(2);
    });
  });

  // ── Recent Orders ─────────────────────────────────────────
  describe("Recent Orders", () => {
    it("maps customer name, falls back to customer_id when null", async () => {
      const orders = [
        makeOrder({ id: "o1", customer: { full_name: "Trần B" } }),
        makeOrder({ id: "o2", customer_id: "cust-x", customer: null }),
      ];
      setupDefaults(orders);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.recentOrders[0].customerName).toBe("Trần B");
      expect(body.data.recentOrders[1].customerName).toBe("cust-x");
    });

    it("includes product name from products repo", async () => {
      const products = [makeProduct({ id: "prod-001", name: "Disney+" })];
      setupDefaults([makeOrder()], [], products);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.recentOrders[0].productName).toBe("Disney+");
    });
  });

  // ── Expiring Accounts ─────────────────────────────────────
  describe("Expiring Accounts (<7 days)", () => {
    it("includes accounts expiring within 7 days, sorted by nearest", async () => {
      const accounts = [
        makeSourceAccount({
          id: "sa1", email: "expiring3@test.com",
          expires_at: new Date(Date.now() + 3 * DAY_MS).toISOString(),
        }),
        makeSourceAccount({
          id: "sa2", email: "expiring1@test.com",
          expires_at: new Date(Date.now() + 1 * DAY_MS).toISOString(),
        }),
        makeSourceAccount({
          id: "sa3", email: "safe@test.com",
          expires_at: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        }),
      ];
      setupDefaults([], accounts);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.expiringAccounts.length).toBe(2);
      // Sorted: nearest first
      expect(body.data.expiringAccounts[0].email).toBe("expiring1@test.com");
      expect(body.data.expiringAccounts[1].email).toBe("expiring3@test.com");
    });

    it("excludes already-expired accounts", async () => {
      const accounts = [
        makeSourceAccount({
          id: "sa-expired",
          expires_at: new Date(Date.now() - DAY_MS).toISOString(),
        }),
      ];
      setupDefaults([], accounts);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.expiringAccounts.length).toBe(0);
    });
  });

  // ── Zero State ────────────────────────────────────────────
  describe("Zero State", () => {
    it("returns all zeros when no data exists", async () => {
      setupDefaults([], [], []);

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.totalRevenue).toBe(0);
      expect(body.data.totalCost).toBe(0);
      expect(body.data.totalProfit).toBe(0);
      expect(body.data.pendingCount).toBe(0);
      expect(body.data.totalSlots).toBe(0);
      expect(body.data.usedSlots).toBe(0);
      expect(body.data.fillRate).toBe(0);
      expect(body.data.topProducts).toEqual([]);
      expect(body.data.expiringAccounts).toEqual([]);
      expect(body.data.chartData).toBeDefined();
    });
  });

  // ── Response Structure ────────────────────────────────────
  describe("Response Structure", () => {
    it("includes calculatedAt timestamp", async () => {
      setupDefaults();

      const res = await fetchStats();
      const body = await res.json();

      expect(body.data.calculatedAt).toBeDefined();
      expect(new Date(body.data.calculatedAt).getTime()).toBeGreaterThan(0);
    });

    it("returns 200 status", async () => {
      setupDefaults();
      const res = await fetchStats();
      expect(res.status).toBe(200);
    });
  });
});
