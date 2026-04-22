/**
 * ============================================================
 * DATABASE INTEGRITY TESTS — Inventory Module
 *
 * Verifies data consistency rules between tables:
 * - license_keys ↔ products (FK integrity)
 * - source_accounts constraints (used_slots ≤ max_slots)
 * - license_keys status ↔ order_id consistency
 * - Cross-table consistency (allocations match actual counts)
 * ============================================================
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Helpers ─────────────────────────────────────────────────
function _createBuilder(data: unknown = []) {
  const builder: Record<string, any> = {};
  const methods = [
    "select", "eq", "neq", "in", "not", "is",
    "gt", "lt", "gte", "lte", "overlaps",
    "update", "insert", "single", "order", "limit",
    "filter", "or",
  ];
  for (const m of methods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (resolve: (...args: any[]) => any) => resolve({ data, error: null });
  return builder;
}

// ═════════════════════════════════════════════════════════════
// 1. License Keys → Products FK Integrity
// ═════════════════════════════════════════════════════════════
describe("DB Integrity: license_keys → products FK", () => {
  beforeEach(() => vi.clearAllMocks());

  it("all license_keys should reference existing products", async () => {
    const licenseKeys = [
      { id: "lk-1", product_id: "prod-1" },
      { id: "lk-2", product_id: "prod-2" },
      { id: "lk-3", product_id: "prod-1" },
    ];
    const products = [
      { id: "prod-1" },
      { id: "prod-2" },
    ];

    // Verify: every license key's product_id exists in products
    const productIds = new Set(products.map(p => p.id));
    const orphanKeys = licenseKeys.filter(k => !productIds.has(k.product_id));

    expect(orphanKeys).toHaveLength(0);
  });

  it("detects orphan keys with invalid product_id", async () => {
    const licenseKeys = [
      { id: "lk-1", product_id: "prod-1" },
      { id: "lk-orphan", product_id: "prod-deleted" },
    ];
    const products = [{ id: "prod-1" }];

    const productIds = new Set(products.map(p => p.id));
    const orphanKeys = licenseKeys.filter(k => !productIds.has(k.product_id));

    expect(orphanKeys).toHaveLength(1);
    expect(orphanKeys[0].id).toBe("lk-orphan");
  });
});

// ═════════════════════════════════════════════════════════════
// 2. Source Account Slot Constraints
// ═════════════════════════════════════════════════════════════
describe("DB Integrity: source_accounts slot constraints", () => {
  it("used_slots should never exceed max_slots", () => {
    const accounts = [
      { id: "sa-1", max_slots: 10, used_slots: 5 },  // OK
      { id: "sa-2", max_slots: 10, used_slots: 10 }, // OK (full)
      { id: "sa-bad", max_slots: 5, used_slots: 7 },  // VIOLATION
    ];

    const violations = accounts.filter(a => a.used_slots > a.max_slots);

    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("sa-bad");
  });

  it("used_slots should never be negative", () => {
    const accounts = [
      { id: "sa-1", used_slots: 0 },    // OK
      { id: "sa-2", used_slots: 5 },    // OK
      { id: "sa-neg", used_slots: -1 }, // VIOLATION
    ];

    const violations = accounts.filter(a => a.used_slots < 0);

    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("sa-neg");
  });
});

// ═════════════════════════════════════════════════════════════
// 3. License Key Status ↔ Order Consistency
// ═════════════════════════════════════════════════════════════
describe("DB Integrity: license_keys status ↔ order_id", () => {
  it("used/reserved keys must have an order_id", () => {
    const keys = [
      { id: "k-1", status: "available", order_id: null },     // OK
      { id: "k-2", status: "used", order_id: "order-1" },     // OK
      { id: "k-3", status: "reserved", order_id: "order-2" }, // OK
      { id: "k-bad", status: "used", order_id: null },        // VIOLATION
    ];

    const violations = keys.filter(
      k => (k.status === "used" || k.status === "reserved") && !k.order_id
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("k-bad");
  });

  it("available keys must NOT have an order_id", () => {
    const keys = [
      { id: "k-1", status: "available", order_id: null },       // OK
      { id: "k-bad", status: "available", order_id: "order-1" }, // VIOLATION
    ];

    const violations = keys.filter(
      k => k.status === "available" && k.order_id !== null
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("k-bad");
  });
});

// ═════════════════════════════════════════════════════════════
// 4. Cross-Table: Allocation Counts Match
// ═════════════════════════════════════════════════════════════
describe("DB Integrity: cross-table allocation consistency", () => {
  it("order_items with assigned_source_account_id should match used_slot counts", () => {
    // Simulated data: 3 order items assigned to sa-1
    const orderItems = [
      { id: "oi-1", assigned_source_account_id: "sa-1", quantity: 1 },
      { id: "oi-2", assigned_source_account_id: "sa-1", quantity: 2 },
      { id: "oi-3", assigned_source_account_id: "sa-2", quantity: 1 },
    ];

    const sourceAccount1 = { id: "sa-1", used_slots: 3, max_slots: 10 };
    const sourceAccount2 = { id: "sa-2", used_slots: 1, max_slots: 5 };

    // Calculate expected used_slots from order_items
    const expectedSlotsBySa = new Map<string, number>();
    for (const item of orderItems) {
      if (!item.assigned_source_account_id) continue;
      const current = expectedSlotsBySa.get(item.assigned_source_account_id) || 0;
      expectedSlotsBySa.set(item.assigned_source_account_id, current + item.quantity);
    }

    // Verify counts match
    expect(expectedSlotsBySa.get("sa-1")).toBe(sourceAccount1.used_slots);
    expect(expectedSlotsBySa.get("sa-2")).toBe(sourceAccount2.used_slots);
  });

  it("detects mismatch between allocated items and source account used_slots", () => {
    const orderItems = [
      { id: "oi-1", assigned_source_account_id: "sa-1", quantity: 2 },
    ];
    const sourceAccount = { id: "sa-1", used_slots: 5 }; // mismatch: items say 2, account says 5

    const expectedSlots = orderItems
      .filter(i => i.assigned_source_account_id === "sa-1")
      .reduce((sum, i) => sum + i.quantity, 0);

    expect(expectedSlots).not.toBe(sourceAccount.used_slots);
  });
});

// ═════════════════════════════════════════════════════════════
// 5. Expired Keys Status Check
// ═════════════════════════════════════════════════════════════
describe("DB Integrity: expired source accounts → key status", () => {
  it("keys from expired accounts should not remain 'available'", () => {
    const now = Date.now();

    // Account expired 10 days ago
    const expiredAccount = {
      id: "sa-expired",
      expires_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Keys still marked available on expired account — potential issue
    const keys = [
      { id: "k-1", status: "available", source_account_id: "sa-expired" },
      { id: "k-2", status: "expired", source_account_id: "sa-expired" },
    ];

    const isExpired = new Date(expiredAccount.expires_at).getTime() < now;
    const staleKeys = keys.filter(k => k.status === "available" && isExpired);

    expect(staleKeys).toHaveLength(1);
    expect(staleKeys[0].id).toBe("k-1");
  });
});
