/**
 * ============================================================
 * TRANSACTION ROLLBACK TESTS — Inventory Module
 *
 * Verifies that failed operations mid-process do not leave
 * the database in an inconsistent state.
 *
 * Tests atomic RPC rollback behavior and JS fallback error
 * handling to ensure no side effects on failure.
 * ============================================================
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  getOrderById: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  recalculateUsedSlots: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ─────────────────────────────────────────────────
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrderById, updateOrderStatus } from "@/lib/supabase/repositories/orders.repo";
import { confirmAllocation } from "@/lib/services/allocation.service";

const ACCOUNT_ID = "00000000-0000-4000-8000-0000000000fa";
const ORDER_ID = "order-rollback-test";

// ── Helpers ─────────────────────────────────────────────────
/**
 * Setup supabase.from() mock with call counting for order_items.
 * 
 * confirmAllocation internally calls:
 * 1. hasExistingAllocations → from("order_items") + from("license_keys")
 * 2. buildAllocationSuggestion → from("order_items") + from("products") + from("source_accounts") + from("license_keys")
 * 
 * We need to differentiate the first order_items call (hasExistingAllocations)
 * from subsequent calls (buildAllocationSuggestion).
 */
function setupMockChain(tableResults: Record<string, unknown>) {
  const mockFrom = vi.mocked(supabaseAdmin.from);
  let orderItemsCallCount = 0;

  mockFrom.mockImplementation((table: string) => {
    const builder: Record<string, any> = {};
    const methods = [
      "select", "eq", "in", "overlaps", "not", "is",
      "update", "insert", "single", "order", "limit",
    ];
    for (const m of methods) {
      builder[m] = vi.fn().mockReturnValue(builder);
    }

    if (table === "order_items") {
      orderItemsCallCount++;
      if (orderItemsCallCount === 1) {
        // hasExistingAllocations — return empty to skip deallocation
        builder.then = (resolve: (...args: any[]) => any) => resolve({ data: [], error: null });
      } else {
        // buildAllocationSuggestion — return actual items
        const result = tableResults[table] ?? { data: [], error: null };
        builder.then = (resolve: (...args: any[]) => any) => resolve(result);
      }
    } else if (table === "license_keys") {
      // hasExistingAllocations uses count query, buildAllocationSuggestion uses data query
      const result = tableResults[table] ?? { data: [], error: null };
      builder.then = (resolve: (...args: any[]) => any) => resolve({ ...(result as any), count: 0 });
    } else {
      const result = tableResults[table] ?? { data: [], error: null };
      builder.then = (resolve: (...args: any[]) => any) => resolve(result);
    }
    return builder as any;
  });
}

// ═════════════════════════════════════════════════════════════
// 1. RPC Exception = No Side Effects
// ═════════════════════════════════════════════════════════════
describe("Rollback: RPC exception leaves no side effects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirm_allocation_atomic rollback on RAISE EXCEPTION", async () => {
    vi.mocked(getOrderById).mockResolvedValue({
      id: ORDER_ID, status: "paid", account_id: ACCOUNT_ID,
    } as any);
    vi.mocked(updateOrderStatus).mockResolvedValue({
      id: ORDER_ID, status: "paid",
    } as any);

    setupMockChain({
      order_items: {
        data: [{
          id: "00000000-0000-4000-8000-0000000000f9", order_id: ORDER_ID, product_id: "00000000-0000-4000-8000-000000000039",
          quantity: 1, product_name_snapshot: "Netflix",
          assigned_source_account_id: null, customer_nick_used: null,
        }],
        error: null,
      },
      products: {
        data: [{ id: "00000000-0000-4000-8000-000000000039", name: "Netflix", mode: "slot",
          buy_price_vnd: 0, sell_price_vnd: 100000,
          duration_type: "months", duration_value: 1, is_active: true,
        }],
        error: null,
      },
      source_accounts: {
        data: [{
          id: "00000000-0000-4000-8000-000000000040", email: "test@test.com", provider: "netflix",
          product_ids: ["00000000-0000-4000-8000-000000000039"], max_slots: 10, used_slots: 3,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          account_id: ACCOUNT_ID,
        }],
        error: null,
      },
      license_keys: { data: [], error: null },
    });

    const rpcMock = vi.mocked(supabaseAdmin.rpc);
    // confirm_allocation_atomic fails
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "could not obtain advisory lock" },
    } as any);
    // Fallback: increment_source_account_slots also fails
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Not enough slots" },
    } as any);

    // confirmAllocation should rollback order status to "paid"
    await expect(
      confirmAllocation(ORDER_ID, ACCOUNT_ID)
    ).rejects.toThrow();

    // Status should have been rolled back to "paid"
    expect(updateOrderStatus).toHaveBeenCalledWith(
      ORDER_ID, ACCOUNT_ID, "paid"
    );
  });
});

// ═════════════════════════════════════════════════════════════
// 2. Partial Slot Allocation Failure → Rollback
// ═════════════════════════════════════════════════════════════
describe("Rollback: partial allocation failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fallback slot allocation error triggers status rollback", async () => {
    vi.mocked(getOrderById).mockResolvedValue({
      id: ORDER_ID, status: "paid", account_id: ACCOUNT_ID,
    } as any);
    vi.mocked(updateOrderStatus).mockResolvedValue({
      id: ORDER_ID, status: "paid",
    } as any);

    setupMockChain({
      order_items: {
        data: [{
          id: "00000000-0000-4000-8000-0000000000f9", order_id: ORDER_ID, product_id: "00000000-0000-4000-8000-000000000039",
          quantity: 1, product_name_snapshot: "Netflix",
          assigned_source_account_id: null, customer_nick_used: null,
        }],
        error: null,
      },
      products: {
        data: [{ id: "00000000-0000-4000-8000-000000000039", name: "Netflix", mode: "slot",
          buy_price_vnd: 0, sell_price_vnd: 100000,
          duration_type: "months", duration_value: 1, is_active: true,
        }],
        error: null,
      },
      source_accounts: {
        data: [{
          id: "00000000-0000-4000-8000-000000000040", email: "test@test.com", provider: "netflix",
          product_ids: ["00000000-0000-4000-8000-000000000039"], max_slots: 10, used_slots: 3,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          account_id: ACCOUNT_ID,
        }],
        error: null,
      },
      license_keys: { data: [], error: null },
    });

    const rpcMock = vi.mocked(supabaseAdmin.rpc);
    // Main atomic RPC fails → triggers fallback
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "RPC not found" },
    } as any);
    // Fallback increment_source_account_slots also fails
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Not enough slots available" },
    } as any);

    await expect(
      confirmAllocation(ORDER_ID, ACCOUNT_ID)
    ).rejects.toThrow("Lỗi cấp phát slot");

    // Order status should rollback to "paid"
    expect(updateOrderStatus).toHaveBeenCalledWith(
      ORDER_ID, ACCOUNT_ID, "paid"
    );
  });
});

// ═════════════════════════════════════════════════════════════
// 3. Key Allocation Rollback
// ═════════════════════════════════════════════════════════════
describe("Rollback: key allocation failure after slot success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("key allocation RPC failure in fallback mode triggers rollback", async () => {
    vi.mocked(getOrderById).mockResolvedValue({
      id: ORDER_ID, status: "paid", account_id: ACCOUNT_ID,
    } as any);
    vi.mocked(updateOrderStatus).mockResolvedValue({
      id: ORDER_ID, status: "paid",
    } as any);

    setupMockChain({
      order_items: {
        data: [{
          id: "00000000-0000-4000-8000-0000000000f9", order_id: ORDER_ID, product_id: "prod-hybrid",
          quantity: 1, product_name_snapshot: "Hybrid Product",
          assigned_source_account_id: null, customer_nick_used: null,
        }],
        error: null,
      },
      products: {
        data: [{ id: "prod-hybrid", name: "Hybrid Product", mode: "hybrid",
          buy_price_vnd: 0, sell_price_vnd: 100000,
          duration_type: "months", duration_value: 1, is_active: true,
        }],
        error: null,
      },
      source_accounts: {
        data: [{
          id: "00000000-0000-4000-8000-000000000040", email: "test@test.com", provider: "hybrid_provider",
          product_ids: ["prod-hybrid"], max_slots: 10, used_slots: 3,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          account_id: ACCOUNT_ID,
        }],
        error: null,
      },
      license_keys: {
        data: [{ id: "00000000-0000-4000-8000-0000000000e5", product_id: "prod-hybrid" }],
        error: null,
      },
    });

    const rpcMock = vi.mocked(supabaseAdmin.rpc);
    // Main atomic RPC fails
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "RPC not available" },
    } as any);
    // Fallback: increment slots succeeds
    rpcMock.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any);
    // Fallback: allocate keys fails
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Not enough available license keys" },
    } as any);

    await expect(
      confirmAllocation(ORDER_ID, ACCOUNT_ID)
    ).rejects.toThrow("Lỗi cấp phát key");

    // Rollback should be triggered
    expect(updateOrderStatus).toHaveBeenCalledWith(
      ORDER_ID, ACCOUNT_ID, "paid"
    );
  });
});
