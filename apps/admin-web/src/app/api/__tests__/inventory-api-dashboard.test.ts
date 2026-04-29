/**
 * ============================================================
 * INVENTORY DASHBOARD API — Aggregated Metrics Tests
 * Covers: GET /api/inventory/dashboard
 *
 * Tests KPI calculations for source accounts and license keys:
 * - Account counts (total, active, expired, expiring soon)
 * - Slot metrics (total, used, available, utilization)
 * - Low capacity detection (< 20% free)
 * - License key breakdown by status
 * - Purchase cost aggregation
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
import { GET } from "@/app/api/inventory/dashboard/route";

// ── Helpers ─────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;

function makeSourceAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-00000000004a",
    email: "test@example.com",
    provider: "netflix",
    product_ids: ["00000000-0000-4000-8000-000000000039"],
    max_slots: 10,
    used_slots: 5,
    expires_at: new Date(Date.now() + 60 * DAY_MS).toISOString(),
    purchase_cost_vnd: 500000,
    account_id: TEST_ACCOUNT_ID,
    ...overrides,
  };
}

function mockSupabaseLicenseKeysQuery(keys: Array<{ id: string; status: string; product_id: string }>) {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: keys, error: null }),
    }),
  });
  vi.mocked(supabaseAdmin).from = from;
}

// ═════════════════════════════════════════════════════════════
describe("GET /api/inventory/dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Core Metrics ─────────────────────────────────────────
  it("returns all expected KPI fields", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount(),
    ] as any);
    mockSupabaseLicenseKeysQuery([
      { id: "k1", status: "available", product_id: "00000000-0000-4000-8000-000000000039" },
    ]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Verify all required fields exist
    expect(body).toHaveProperty("totalAccounts");
    expect(body).toHaveProperty("activeAccounts");
    expect(body).toHaveProperty("expiredAccounts");
    expect(body).toHaveProperty("expiringSoon7d");
    expect(body).toHaveProperty("expiringSoon30d");
    expect(body).toHaveProperty("totalSlots");
    expect(body).toHaveProperty("usedSlots");
    expect(body).toHaveProperty("availableSlots");
    expect(body).toHaveProperty("avgUtilization");
    expect(body).toHaveProperty("totalPurchaseCostVnd");
    expect(body).toHaveProperty("lowCapacityCount");
    expect(body).toHaveProperty("lowCapacityList");
    expect(body).toHaveProperty("expiringSoonList");
    expect(body).toHaveProperty("keys");
  });

  // ── Account Counting ────────────────────────────────────
  it("correctly counts active vs expired accounts", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ id: "00000000-0000-4000-8000-0000000003ea" }), // future expiry
      makeSourceAccount({ id: "00000000-0000-4000-8000-0000000003eb" }),
      makeSourceAccount({
        id: "00000000-0000-4000-8000-00000000004b",
        expires_at: new Date(Date.now() - DAY_MS).toISOString(),
      }),
    ] as any);
    mockSupabaseLicenseKeysQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.totalAccounts).toBe(3);
    expect(body.activeAccounts).toBe(2);
    expect(body.expiredAccounts).toBe(1);
  });

  // ── Expiring Soon ───────────────────────────────────────
  it("detects accounts expiring within 7 and 30 days", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({
        id: "expiring-3d",
        email: "soon3@test.com",
        expires_at: new Date(Date.now() + 3 * DAY_MS).toISOString(),
      }),
      makeSourceAccount({
        id: "expiring-15d",
        email: "soon15@test.com",
        expires_at: new Date(Date.now() + 15 * DAY_MS).toISOString(),
      }),
      makeSourceAccount({
        id: "safe-90d",
        expires_at: new Date(Date.now() + 90 * DAY_MS).toISOString(),
      }),
    ] as any);
    mockSupabaseLicenseKeysQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.expiringSoon7d).toBe(1); // only 3d account
    expect(body.expiringSoon30d).toBe(2); // 3d + 15d accounts
    expect(body.expiringSoonList).toHaveLength(1);
    expect(body.expiringSoonList[0].email).toBe("soon3@test.com");
  });

  // ── Slot Metrics ────────────────────────────────────────
  it("calculates slot metrics correctly", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ max_slots: 10, used_slots: 8 }),
      makeSourceAccount({ id: "00000000-0000-4000-8000-00000000004c", max_slots: 20, used_slots: 5 }),
    ] as any);
    mockSupabaseLicenseKeysQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.totalSlots).toBe(30);
    expect(body.usedSlots).toBe(13);
    expect(body.availableSlots).toBe(17);
    expect(body.avgUtilization).toBe(43); // Math.round(13/30*100)
  });

  // ── Low Capacity ────────────────────────────────────────
  it("identifies low capacity accounts (< 20% free)", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({
        id: "low-cap",
        email: "lowcap@test.com",
        max_slots: 10,
        used_slots: 9, // 10% free → low
      }),
      makeSourceAccount({
        id: "ok-cap",
        max_slots: 10,
        used_slots: 3, // 70% free → ok
      }),
    ] as any);
    mockSupabaseLicenseKeysQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.lowCapacityCount).toBe(1);
    expect(body.lowCapacityList).toHaveLength(1);
    expect(body.lowCapacityList[0].email).toBe("lowcap@test.com");
    expect(body.lowCapacityList[0].freeSlots).toBe(1);
    expect(body.lowCapacityList[0].freePercent).toBe(10);
  });

  it("excludes expired accounts from low capacity list", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({
        id: "expired-low",
        max_slots: 10,
        used_slots: 9,
        expires_at: new Date(Date.now() - DAY_MS).toISOString(), // expired
      }),
    ] as any);
    mockSupabaseLicenseKeysQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.lowCapacityCount).toBe(0);
  });

  // ── License Key Metrics ─────────────────────────────────
  it("breaks down license keys by status", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([] as any);
    mockSupabaseLicenseKeysQuery([
      { id: "k1", status: "available", product_id: "p1" },
      { id: "k2", status: "available", product_id: "p1" },
      { id: "k3", status: "reserved", product_id: "p1" },
      { id: "k4", status: "used", product_id: "p2" },
      { id: "k5", status: "used", product_id: "p2" },
      { id: "k6", status: "used", product_id: "p2" },
    ]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.keys.total).toBe(6);
    expect(body.keys.available).toBe(2);
    expect(body.keys.reserved).toBe(1);
    expect(body.keys.used).toBe(3);
  });

  // ── Purchase Cost ───────────────────────────────────────
  it("sums purchase costs from all accounts", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ purchase_cost_vnd: 200000 }),
      makeSourceAccount({ id: "00000000-0000-4000-8000-00000000004c", purchase_cost_vnd: 300000 }),
      makeSourceAccount({ id: "00000000-0000-4000-8000-00000000004d", purchase_cost_vnd: null }), // no cost
    ] as any);
    mockSupabaseLicenseKeysQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.totalPurchaseCostVnd).toBe(500000);
  });

  // ── Edge Cases ──────────────────────────────────────────
  it("returns zero-state metrics when no data exists", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([] as any);
    mockSupabaseLicenseKeysQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.totalAccounts).toBe(0);
    expect(body.activeAccounts).toBe(0);
    expect(body.totalSlots).toBe(0);
    expect(body.avgUtilization).toBe(0);
    expect(body.keys.total).toBe(0);
    expect(body.lowCapacityCount).toBe(0);
  });

  it("returns zero utilization when totalSlots is 0", async () => {
    vi.mocked(listSourceAccounts).mockResolvedValue([
      makeSourceAccount({ max_slots: 0, used_slots: 0 }),
    ] as any);
    mockSupabaseLicenseKeysQuery([]);

    const res = await GET(createTestRequest("http://localhost/api/inventory/dashboard"), { params: {} } as any);
    const body = await res.json();

    expect(body.avgUtilization).toBe(0);
  });
});
