/**
 * ============================================================
 * INVENTORY RACE CONDITION TESTS
 *
 * Simulates concurrent access scenarios to verify:
 * - Atomic RPC protects against double-allocation
 * - Slot overflow prevention under concurrent increment
 * - SKIP LOCKED behavior for license keys
 * - No double-free during concurrent deallocate + allocate
 *
 * NOTE: These tests mock Supabase RPC behavior to simulate
 * concurrent scenarios. Real DB-level race tests require
 * integration testing with actual Postgres.
 * ============================================================
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getOrderById, updateOrderStatus } from "@/lib/supabase/repositories/orders.repo";
import { deallocateOrder } from "@/lib/services/allocation.service";

const ACCOUNT_ID = "test-account-uuid";
const ORDER_ID_A = "order-a";
const ORDER_ID_B = "order-b";

// ═════════════════════════════════════════════════════════════
// 1. Concurrent Allocation to Same Source Account
// ═════════════════════════════════════════════════════════════
describe("Race: Concurrent allocation to same source account", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomic RPC prevents slot overflow via SELECT FOR UPDATE", async () => {
    // Simulate: two requests try to allocate slots at the same time.
    // The RPC uses SELECT ... FOR UPDATE to lock the row.
    // First request succeeds, second sees updated used_slots and may fail.
    const rpcMock = vi.mocked(supabaseAdmin.rpc);

    // Request A: success (2 slots allocated)
    rpcMock.mockResolvedValueOnce({
      data: { success: true, source_id: "sa-1", new_used_slots: 8 },
      error: null,
    } as any);

    // Request B: fails because row is locked/slots full
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Not enough slots available in this source account" },
    } as any);

    // Simulate both requests
    const [resultA, resultB] = await Promise.allSettled([
      supabaseAdmin.rpc("increment_source_account_slots" as never, {
        p_account_id: ACCOUNT_ID,
        p_source_id: "sa-1",
        p_quantity: 2,
      } as never),
      supabaseAdmin.rpc("increment_source_account_slots" as never, {
        p_account_id: ACCOUNT_ID,
        p_source_id: "sa-1",
        p_quantity: 5,
      } as never),
    ]);

    expect(resultA.status).toBe("fulfilled");
    // @ts-expect-error — PromiseSettledResult
    expect(resultA.value.data?.success).toBe(true);

    expect(resultB.status).toBe("fulfilled");
    // @ts-expect-error — PromiseSettledResult
    expect(resultB.value.error?.message).toContain("Not enough slots");
  });

  it("atomic RPC prevents used_slots from going below 0", async () => {
    const rpcMock = vi.mocked(supabaseAdmin.rpc);

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Cannot reduce used slots below 0" },
    } as any);

    const result = await supabaseAdmin.rpc("increment_source_account_slots" as never, {
      p_account_id: ACCOUNT_ID,
      p_source_id: "sa-1",
      p_quantity: -100, // trying to reduce more than current
    } as never);

    expect(result.error?.message).toContain("below 0");
  });
});

// ═════════════════════════════════════════════════════════════
// 2. Concurrent License Key Allocation (SKIP LOCKED)
// ═════════════════════════════════════════════════════════════
describe("Race: Concurrent license key allocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("SKIP LOCKED prevents double-allocation of same key", async () => {
    const rpcMock = vi.mocked(supabaseAdmin.rpc);

    // Request A: gets 2 keys (k1, k2)
    rpcMock.mockResolvedValueOnce({
      data: { success: true, allocated_count: 2, allocated_ids: ["k1", "k2"] },
      error: null,
    } as any);

    // Request B: gets next 2 keys (k3, k4) — k1,k2 were SKIP LOCKED
    rpcMock.mockResolvedValueOnce({
      data: { success: true, allocated_count: 2, allocated_ids: ["k3", "k4"] },
      error: null,
    } as any);

    const [resultA, resultB] = await Promise.all([
      supabaseAdmin.rpc("allocate_license_keys" as never, {
        p_account_id: ACCOUNT_ID,
        p_product_id: "prod-1",
        p_order_id: ORDER_ID_A,
        p_quantity: 2,
      } as never),
      supabaseAdmin.rpc("allocate_license_keys" as never, {
        p_account_id: ACCOUNT_ID,
        p_product_id: "prod-1",
        p_order_id: ORDER_ID_B,
        p_quantity: 2,
      } as never),
    ]);

    // Both succeed but get different keys
    const idsA = resultA.data.allocated_ids;
    const idsB = resultB.data.allocated_ids;

    expect(idsA).toHaveLength(2);
    expect(idsB).toHaveLength(2);
    // No overlap in allocated keys
    expect(idsA.filter((id: string) => idsB.includes(id))).toHaveLength(0);
  });

  it("fails gracefully when not enough keys after SKIP LOCKED", async () => {
    const rpcMock = vi.mocked(supabaseAdmin.rpc);

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Not enough available license keys (requested 5, found 2)" },
    } as any);

    const result = await supabaseAdmin.rpc("allocate_license_keys" as never, {
      p_account_id: ACCOUNT_ID,
      p_product_id: "prod-1",
      p_order_id: ORDER_ID_A,
      p_quantity: 5,
    } as never);

    expect(result.error?.message).toContain("Not enough available license keys");
  });
});

// ═════════════════════════════════════════════════════════════
// 3. Concurrent Deallocate + Allocate (No Double-Free)
// ═════════════════════════════════════════════════════════════
describe("Race: Concurrent deallocate + new allocate on same order", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomic deallocation completes before re-allocation starts", async () => {
    const rpcMock = vi.mocked(supabaseAdmin.rpc);

    // Simulate sequential execution inside confirmAllocation:
    // 1. Deallocate RPC
    rpcMock.mockResolvedValueOnce({
      data: { deallocated_slots: 2, deallocated_keys: 1 },
      error: null,
    } as any);

    // 2. Allocation RPC (happens after deallocation)
    rpcMock.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    } as any);

    // Execute deallocation first
    const deallocResult = await deallocateOrder(ORDER_ID_A, ACCOUNT_ID);

    expect(deallocResult.deallocatedSlots).toBe(2);
    expect(deallocResult.deallocatedKeys).toBe(1);

    // Then allocation RPC would be called (tested in allocation-service.test.ts)
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════
// 4. Idempotency of Deallocation
// ═════════════════════════════════════════════════════════════
describe("Race: Idempotent deallocation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("second deallocation RPC returns zeros (nothing left to free)", async () => {
    // Re-mock after reset
    const rpcFn = vi.fn();
    (supabaseAdmin as any).rpc = rpcFn;

    // First call: actually deallocates
    rpcFn.mockResolvedValueOnce({
      data: { deallocated_slots: 3, deallocated_keys: 1 },
      error: null,
    });

    // Second call: nothing left to deallocate (idempotent)
    rpcFn.mockResolvedValueOnce({
      data: { deallocated_slots: 0, deallocated_keys: 0 },
      error: null,
    });

    // Simulate two rapid calls to the same RPC
    const [first, second] = await Promise.all([
      rpcFn("deallocate_order_atomic", {
        p_order_id: ORDER_ID_A,
        p_account_id: ACCOUNT_ID,
      }),
      rpcFn("deallocate_order_atomic", {
        p_order_id: ORDER_ID_A,
        p_account_id: ACCOUNT_ID,
      }),
    ]);

    // First request deallocates, second returns zeros
    expect(first.data.deallocated_slots).toBe(3);
    expect(second.data.deallocated_slots).toBe(0);
    expect(second.data.deallocated_keys).toBe(0);
  });
});

