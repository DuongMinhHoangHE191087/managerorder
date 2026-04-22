/**
 * ============================================================
 * ALLOCATION SERVICE — Unit Tests (Core Business Logic)
 *
 * Tests the service layer for:
 * - buildAllocationSuggestion (slot/key/hybrid mode)
 * - confirmAllocation (atomic RPC + JS fallback + re-allocation)
 * - deallocateOrder (atomic RPC + JS fallback)
 * ============================================================
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    supabaseAdmin: { from: mockFrom, rpc: mockRpc },
  };
});

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
import {
  buildAllocationSuggestion,
  confirmAllocation,
  deallocateOrder,
} from "@/lib/services/allocation.service";

// ── Constants ───────────────────────────────────────────────
const ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORDER_ID = "order-001";
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Helpers ─────────────────────────────────────────────────
function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    status: "paid",
    account_id: ACCOUNT_ID,
    ...overrides,
  };
}

function makeOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "oi-001",
    order_id: ORDER_ID,
    product_id: "prod-slot",
    quantity: 1,
    product_name_snapshot: "Netflix Premium",
    assigned_source_account_id: null,
    customer_nick_used: null,
    ...overrides,
  };
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-slot",
    name: "Netflix Premium",
    mode: "slot",
    buy_price_vnd: 100000,
    sell_price_vnd: 200000,
    duration_type: "months",
    duration_value: 1,
    is_active: true,
    ...overrides,
  };
}

function makeSourceAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sa-001",
    email: "source@test.com",
    provider: "netflix",
    product_ids: ["prod-slot"],
    max_slots: 10,
    used_slots: 3,
    expires_at: new Date(Date.now() + 60 * DAY_MS).toISOString(),
    account_id: ACCOUNT_ID,
    ...overrides,
  };
}

/**
 * Setup a chained mock for supabase.from().select().eq()... patterns.
 * Returns the configured mock so tests can verify calls.
 */
function setupSupabaseFromMock(queryResults: Record<string, unknown>) {
  // Default: each supabase.from() call returns a builder
  // that chains .select().eq().in() etc. and resolves to the provided data.

  // We use a simple builder pattern that supports arbitrary chaining
  function createBuilder(finalData: unknown = { data: [], error: null }) {
    const builder: Record<string, any> = {};
    const chainMethods = [
      "select", "eq", "in", "overlaps", "not", "is",
      "update", "insert", "single", "order", "limit",
    ];
    for (const m of chainMethods) {
      builder[m] = vi.fn().mockReturnValue(builder);
    }
    // Final resolution: any awaited call returns the data
    builder.then = (resolve: (...args: any[]) => any) => resolve(finalData);
    return builder;
  }

  const fromMock = vi.mocked(supabaseAdmin.from);
  fromMock.mockImplementation((table: string) => {
    const result = queryResults[table] ?? { data: [], error: null };
    return createBuilder(result) as any;
  });

  return fromMock;
}

// ═════════════════════════════════════════════════════════════
// buildAllocationSuggestion
// ═════════════════════════════════════════════════════════════
describe("buildAllocationSuggestion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws if order not found", async () => {
    vi.mocked(getOrderById).mockResolvedValue(null as any);

    await expect(
      buildAllocationSuggestion(ORDER_ID, ACCOUNT_ID)
    ).rejects.toThrow("Order not found");
  });

  it("throws if order has no items", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder() as any);
    setupSupabaseFromMock({
      order_items: { data: [], error: null },
    });

    await expect(
      buildAllocationSuggestion(ORDER_ID, ACCOUNT_ID)
    ).rejects.toThrow("Order has no items");
  });

  it("suggests source account for slot-mode product", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder() as any);
    setupSupabaseFromMock({
      order_items: {
        data: [makeOrderItem({ product_id: "prod-slot", quantity: 1 })],
        error: null,
      },
      products: {
        data: [makeProduct({ id: "prod-slot", mode: "slot" })],
        error: null,
      },
      source_accounts: {
        data: [makeSourceAccountRow({ id: "sa-best", max_slots: 10, used_slots: 2 })],
        error: null,
      },
      license_keys: { data: [], error: null },
    });

    const plan = await buildAllocationSuggestion(ORDER_ID, ACCOUNT_ID);

    expect(plan.isValid).toBe(true);
    expect(plan.warnings).toHaveLength(0);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].requiresSlot).toBe(true);
    expect(plan.items[0].requiresKey).toBe(false);
    expect(plan.items[0].sourceAccountId).toBe("sa-best");
  });

  it("warns when not enough slots available", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder() as any);
    setupSupabaseFromMock({
      order_items: {
        data: [makeOrderItem({ product_id: "prod-slot", quantity: 5 })],
        error: null,
      },
      products: {
        data: [makeProduct({ id: "prod-slot", mode: "slot" })],
        error: null,
      },
      source_accounts: {
        // Only 2 free slots (max=5, used=3)
        data: [makeSourceAccountRow({ max_slots: 5, used_slots: 3 })],
        error: null,
      },
      license_keys: { data: [], error: null },
    });

    const plan = await buildAllocationSuggestion(ORDER_ID, ACCOUNT_ID);

    expect(plan.isValid).toBe(false);
    expect(plan.warnings.some(w => w.includes("Không đủ slot"))).toBe(true);
  });

  it("warns when not enough keys available for key-mode product", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder() as any);
    setupSupabaseFromMock({
      order_items: {
        data: [makeOrderItem({ product_id: "prod-key", quantity: 3 })],
        error: null,
      },
      products: {
        data: [makeProduct({ id: "prod-key", mode: "key" })],
        error: null,
      },
      source_accounts: { data: [], error: null },
      license_keys: {
        // Only 1 available key
        data: [{ id: "k-1", product_id: "prod-key" }],
        error: null,
      },
    });

    const plan = await buildAllocationSuggestion(ORDER_ID, ACCOUNT_ID);

    expect(plan.isValid).toBe(false);
    expect(plan.warnings.some(w => w.includes("Không đủ key"))).toBe(true);
    expect(plan.items[0].requiresSlot).toBe(false);
    expect(plan.items[0].requiresKey).toBe(true);
  });

  it("requires both slot and key for hybrid-mode product", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder() as any);
    setupSupabaseFromMock({
      order_items: {
        data: [makeOrderItem({ product_id: "prod-hybrid", quantity: 1 })],
        error: null,
      },
      products: {
        data: [makeProduct({ id: "prod-hybrid", mode: "hybrid" })],
        error: null,
      },
      source_accounts: {
        data: [makeSourceAccountRow({
          product_ids: ["prod-hybrid"],
          max_slots: 10,
          used_slots: 0,
        })],
        error: null,
      },
      license_keys: {
        data: [{ id: "key-1", product_id: "prod-hybrid" }],
        error: null,
      },
    });

    const plan = await buildAllocationSuggestion(ORDER_ID, ACCOUNT_ID);

    expect(plan.items[0].requiresSlot).toBe(true);
    expect(plan.items[0].requiresKey).toBe(true);
    expect(plan.isValid).toBe(true);
  });

  it("warns for non-existent product", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder() as any);
    setupSupabaseFromMock({
      order_items: {
        data: [makeOrderItem({
          product_id: "prod-ghost",
          product_name_snapshot: "Ghost Product",
        })],
        error: null,
      },
      products: { data: [], error: null }, // product not found
      source_accounts: { data: [], error: null },
      license_keys: { data: [], error: null },
    });

    const plan = await buildAllocationSuggestion(ORDER_ID, ACCOUNT_ID);

    expect(plan.warnings.some(w => w.includes("Sản phẩm không tồn tại"))).toBe(true);
  });

  it("uses pre-assigned source account if already set", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder() as any);
    setupSupabaseFromMock({
      order_items: {
        data: [makeOrderItem({
          assigned_source_account_id: "sa-pre-assigned",
        })],
        error: null,
      },
      products: {
        data: [makeProduct({ id: "prod-slot", mode: "slot" })],
        error: null,
      },
      source_accounts: {
        data: [makeSourceAccountRow({ id: "sa-other" })],
        error: null,
      },
      license_keys: { data: [], error: null },
    });

    const plan = await buildAllocationSuggestion(ORDER_ID, ACCOUNT_ID);

    expect(plan.items[0].sourceAccountId).toBe("sa-pre-assigned");
  });
});

// ═════════════════════════════════════════════════════════════
// deallocateOrder
// ═════════════════════════════════════════════════════════════
describe("deallocateOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses atomic RPC when available", async () => {
    const rpcMock = vi.mocked(supabaseAdmin.rpc);
    rpcMock.mockResolvedValue({
      data: { deallocated_slots: 3, deallocated_keys: 2 },
      error: null,
    } as any);

    const result = await deallocateOrder(ORDER_ID, ACCOUNT_ID);

    expect(result.deallocatedSlots).toBe(3);
    expect(result.deallocatedKeys).toBe(2);
    expect(rpcMock).toHaveBeenCalledWith(
      "deallocate_order_atomic",
      expect.objectContaining({
        p_order_id: ORDER_ID,
        p_account_id: ACCOUNT_ID,
      })
    );
  });

  it("falls back to JS-side batch when RPC fails", async () => {
    const rpcMock = vi.mocked(supabaseAdmin.rpc);
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Function not found" },
    } as any);

    // Setup fallback mocks
    setupSupabaseFromMock({
      order_items: {
        data: [
          makeOrderItem({ assigned_source_account_id: "sa-1", quantity: 2 }),
        ],
        error: null,
      },
      license_keys: {
        data: [{ id: "key-1" }],
        error: null,
      },
    });

    const result = await deallocateOrder(ORDER_ID, ACCOUNT_ID);

    expect(result.deallocatedSlots).toBe(2);
    expect(result.deallocatedKeys).toBe(1);
  });

  it("returns zeros when order has no allocations (fallback)", async () => {
    const rpcMock = vi.mocked(supabaseAdmin.rpc);
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "RPC unavailable" },
    } as any);

    setupSupabaseFromMock({
      order_items: { data: [], error: null },
      license_keys: { data: [], error: null },
    });

    const result = await deallocateOrder(ORDER_ID, ACCOUNT_ID);

    expect(result.deallocatedSlots).toBe(0);
    expect(result.deallocatedKeys).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════
// confirmAllocation
// ═════════════════════════════════════════════════════════════
describe("confirmAllocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws if order not found", async () => {
    vi.mocked(getOrderById).mockResolvedValue(null as any);

    await expect(
      confirmAllocation(ORDER_ID, ACCOUNT_ID)
    ).rejects.toThrow("Order not found");
  });

  it("transitions order to provisioning then active on success", async () => {
    // Setup: order found, no existing allocations
    vi.mocked(getOrderById).mockResolvedValue(makeOrder({ status: "paid" }) as any);
    vi.mocked(updateOrderStatus).mockResolvedValue(makeOrder({ status: "active" }) as any);

    // No existing allocations
    setupSupabaseFromMock({
      order_items: {
        data: [makeOrderItem()],
        error: null,
      },
      products: {
        data: [makeProduct()],
        error: null,
      },
      source_accounts: {
        data: [makeSourceAccountRow()],
        error: null,
      },
      license_keys: { data: [], error: null },
    });

    // RPC succeeds
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    const result = await confirmAllocation(ORDER_ID, ACCOUNT_ID);

    // Should have called updateOrderStatus for provisioning and active
    expect(updateOrderStatus).toHaveBeenCalledWith(
      ORDER_ID, ACCOUNT_ID, "provisioning"
    );
    expect(updateOrderStatus).toHaveBeenCalledWith(
      ORDER_ID, ACCOUNT_ID, "active"
    );
    expect(result.message).toContain("thành công");
  });

  it("rollbacks to paid when plan is not valid", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder({ status: "paid" }) as any);
    vi.mocked(updateOrderStatus).mockResolvedValue(makeOrder({ status: "paid" }) as any);

    // No source accounts = invalid plan
    setupSupabaseFromMock({
      order_items: {
        data: [makeOrderItem()],
        error: null,
      },
      products: {
        data: [makeProduct()],
        error: null,
      },
      source_accounts: {
        // No accounts with enough slots
        data: [makeSourceAccountRow({ max_slots: 1, used_slots: 1 })],
        error: null,
      },
      license_keys: { data: [], error: null },
    });

    const result = await confirmAllocation(ORDER_ID, ACCOUNT_ID);

    expect(result.message).toContain("thất bại");
    expect(updateOrderStatus).toHaveBeenCalledWith(
      ORDER_ID, ACCOUNT_ID, "paid"
    );
  });

  it("deallocates before re-allocating when order has existing allocations", async () => {
    vi.mocked(getOrderById).mockResolvedValue(makeOrder({ status: "active" }) as any);
    vi.mocked(updateOrderStatus).mockResolvedValue(makeOrder({ status: "active" }) as any);

    // Track calls to supabase.from() for proper mock branching
    const mockFrom = vi.mocked(supabaseAdmin.from);
    let orderItemsCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      const builder: Record<string, any> = {};
      const chainMethods = [
        "select", "eq", "in", "overlaps", "not", "is",
        "update", "insert", "single", "order", "limit",
      ];
      for (const m of chainMethods) {
        builder[m] = vi.fn().mockReturnValue(builder);
      }

      if (table === "order_items") {
        orderItemsCallCount++;
        if (orderItemsCallCount === 1) {
          // 1st call: hasExistingAllocations — returns items with assignments
          builder.then = (resolve: (...args: any[]) => any) => resolve({
            data: [makeOrderItem({ assigned_source_account_id: "sa-old" })],
            error: null,
          });
        } else {
          // 2nd+ call: buildAllocationSuggestion — returns items for plan building
          builder.then = (resolve: (...args: any[]) => any) => resolve({
            data: [makeOrderItem()],
            error: null,
          });
        }
      } else if (table === "products") {
        builder.then = (resolve: (...args: any[]) => any) => resolve({
          data: [makeProduct()],
          error: null,
        });
      } else if (table === "source_accounts") {
        builder.then = (resolve: (...args: any[]) => any) => resolve({
          data: [makeSourceAccountRow()],
          error: null,
        });
      } else if (table === "license_keys") {
        // Both hasExistingAllocations (count query) and buildAllocationSuggestion use this
        builder.then = (resolve: (...args: any[]) => any) => resolve({
          data: [], error: null, count: 0,
        });
      } else {
        builder.then = (resolve: (...args: any[]) => any) => resolve({ data: [], error: null });
      }
      return builder as any;
    });

    // RPC calls in order:
    // 1. deallocate_order_atomic (deallocation)
    // 2. confirm_allocation_atomic (allocation)
    const rpcMock = vi.mocked(supabaseAdmin.rpc);
    rpcMock
      .mockResolvedValueOnce({
        data: { deallocated_slots: 1, deallocated_keys: 0 },
        error: null,
      } as any)
      .mockResolvedValue({
        data: { success: true },
        error: null,
      } as any);

    const result = await confirmAllocation(ORDER_ID, ACCOUNT_ID);

    // Deallocation RPC should have been called first
    expect(rpcMock).toHaveBeenCalledWith(
      "deallocate_order_atomic",
      expect.any(Object)
    );
    expect(result.message).toContain("Cấp phát lại thành công");
  });
});
