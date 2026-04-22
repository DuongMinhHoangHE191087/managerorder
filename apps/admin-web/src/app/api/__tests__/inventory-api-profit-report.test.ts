/**
 * ============================================================
 * INVENTORY PROFIT REPORT API — Tests
 * Covers: GET /api/inventory/profit-report
 *
 * Tests revenue mapping, ROI calculation, and summary totals.
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
vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  listSourceAccounts: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// ── Imports ─────────────────────────────────────────────────
import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GET } from "@/app/api/inventory/profit-report/route";

// ── Helpers ─────────────────────────────────────────────────
function makeSourceAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "sa-001",
    email: "test@example.com",
    provider: "netflix",
    purchase_cost_vnd: 500000,
    purchase_date: "2026-01-15",
    purchase_source: "shopee",
    ...overrides,
  };
}

function mockOrdersQuery(orders: Array<Record<string, unknown>>) {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: orders, error: null }),
      }),
    }),
  });
  vi.mocked(supabaseAdmin).from = from;
}

// ═════════════════════════════════════════════════════════════
describe("GET /api/inventory/profit-report", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Revenue Mapping ────────────────────────────────────
  it("maps order revenue to correct source accounts", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ id: "sa-A", purchase_cost_vnd: 100000 }),
      makeSourceAccount({ id: "sa-B", purchase_cost_vnd: 200000 }),
    ] as any);
    mockOrdersQuery([
      { id: "o1", source_account_id: "sa-A", total_price_vnd: 150000, status: "delivered" },
      { id: "o2", source_account_id: "sa-A", total_price_vnd: 50000, status: "completed" },
      { id: "o3", source_account_id: "sa-B", total_price_vnd: 300000, status: "active" },
    ]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/profit-report"), { params: {} } as any);
    const body = await res.json();

    const rowA = body.data.find((r: any) => r.id === "sa-A");
    const rowB = body.data.find((r: any) => r.id === "sa-B");

    expect(rowA.revenueVnd).toBe(200000); // 150k + 50k
    expect(rowA.profitVnd).toBe(100000);  // 200k - 100k
    expect(rowB.revenueVnd).toBe(300000);
    expect(rowB.profitVnd).toBe(100000);  // 300k - 200k
  });

  // ── ROI Calculation ────────────────────────────────────
  it("calculates ROI correctly as integer percentage", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ id: "sa-1", purchase_cost_vnd: 100000 }),
    ] as any);
    mockOrdersQuery([
      { id: "o1", source_account_id: "sa-1", total_price_vnd: 250000, status: "delivered" },
    ]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/profit-report"), { params: {} } as any);
    const body = await res.json();

    // ROI = (250k - 100k) / 100k * 100 = 150%
    expect(body.data[0].roi).toBe(150);
  });

  it("returns ROI = null when purchase cost is 0", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ id: "sa-free", purchase_cost_vnd: 0 }),
    ] as any);
    mockOrdersQuery([
      { id: "o1", source_account_id: "sa-free", total_price_vnd: 100000, status: "delivered" },
    ]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/profit-report"), { params: {} } as any);
    const body = await res.json();

    expect(body.data[0].roi).toBeNull();
  });

  // ── Summary Totals ─────────────────────────────────────
  it("calculates summary totals across all accounts", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ id: "sa-1", purchase_cost_vnd: 100000 }),
      makeSourceAccount({ id: "sa-2", purchase_cost_vnd: 200000 }),
    ] as any);
    mockOrdersQuery([
      { id: "o1", source_account_id: "sa-1", total_price_vnd: 300000, status: "delivered" },
      { id: "o2", source_account_id: "sa-2", total_price_vnd: 100000, status: "active" },
    ]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/profit-report"), { params: {} } as any);
    const body = await res.json();

    expect(body.summary.totalCost).toBe(300000);
    expect(body.summary.totalRevenue).toBe(400000);
    expect(body.summary.totalProfit).toBe(100000);
    expect(body.summary.avgRoi).toBe(33); // Math.round(100k/300k * 100)
    expect(body.summary.accountsWithCost).toBe(2);
    expect(body.summary.totalAccounts).toBe(2);
  });

  // ── Account with No Orders ─────────────────────────────
  it("shows zero revenue and negative profit for accounts with no orders", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ id: "sa-lonely", purchase_cost_vnd: 150000 }),
    ] as any);
    mockOrdersQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/profit-report"), { params: {} } as any);
    const body = await res.json();

    expect(body.data[0].revenueVnd).toBe(0);
    expect(body.data[0].profitVnd).toBe(-150000);
    expect(body.data[0].orderCount).toBe(0);
  });

  // ── Null Purchase Fields ───────────────────────────────
  it("handles null purchase fields gracefully", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({
        id: "sa-null",
        purchase_cost_vnd: null,
        purchase_date: null,
        purchase_source: null,
      }),
    ] as any);
    mockOrdersQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/profit-report"), { params: {} } as any);
    const body = await res.json();

    expect(body.data[0].purchaseCostVnd).toBe(0);
    expect(body.data[0].purchaseDate).toBeNull();
    expect(body.data[0].purchaseSource).toBeNull();
  });

  // ── Orders Without source_account_id ───────────────────
  it("ignores orders without source_account_id", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ id: "sa-1", purchase_cost_vnd: 100000 }),
    ] as any);
    mockOrdersQuery([
      { id: "o1", source_account_id: null, total_price_vnd: 99999, status: "delivered" },
      { id: "o2", source_account_id: "sa-1", total_price_vnd: 50000, status: "delivered" },
    ]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/profit-report"), { params: {} } as any);
    const body = await res.json();

    expect(body.data[0].revenueVnd).toBe(50000); // only o2
  });

  // ── Empty State ────────────────────────────────────────
  it("returns empty data and zero summary when no accounts", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([] as any);
    mockOrdersQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/profit-report"), { params: {} } as any);
    const body = await res.json();

    expect(body.data).toEqual([]);
    expect(body.summary.totalCost).toBe(0);
    expect(body.summary.totalRevenue).toBe(0);
    expect(body.summary.totalProfit).toBe(0);
    expect(body.summary.avgRoi).toBeNull();
  });
});
