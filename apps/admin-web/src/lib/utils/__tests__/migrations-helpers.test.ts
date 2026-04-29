import { describe, it, expect, vi } from "vitest";
import {
  validateMigrationEligibility,
  checkTargetCapacity,
  checkNoPendingMigration,
  setStepStatus,
  decrementUsedSlots,
  incrementUsedSlots,
  getMigrationWithSteps,
} from "../migrations-helpers";

// Create a mock Supabase client builder for testing
function createMockSupabase() {
  const mockUpdate = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockIn = vi.fn().mockReturnThis();
  const mockIs = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null });
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });

  const chain = {
    select: mockSelect,
    update: mockUpdate,
    eq: mockEq,
    in: mockIn,
    is: mockIs,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  };

  // Make each method return `chain` so chaining works
  Object.values(chain).forEach((fn) => {
    if (fn !== mockSingle && fn !== mockMaybeSingle) {
      (fn as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    }
  });

  return {
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
    _mocks: { mockUpdate, mockEq, mockIn, mockIs, mockOrder, mockSelect, mockSingle, mockMaybeSingle },
  };
}

import type { MigrationContext } from "../migrations-helpers";

// --- Tests for pure validation logic ---
// Note: These functions rely on Supabase, so we test with mocked clients

describe("validateMigrationEligibility", () => {
  it("returns invalid when subscription not found", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: null });

    const result = await validateMigrationEligibility(
      db as any,
      "00000000-0000-4000-8000-000000000017",
      "00000000-0000-4000-8000-000000000016",
      "00000000-0000-4000-8000-000000000066",
      "00000000-0000-4000-8000-00000000015a"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Subscription not found");
  });

  it("returns invalid for cancelled subscription", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "00000000-0000-4000-8000-000000000017", status: "cancelled", premium_account_id: "00000000-0000-4000-8000-000000000066" },
    });

    const result = await validateMigrationEligibility(
      db as any,
      "00000000-0000-4000-8000-000000000017",
      "00000000-0000-4000-8000-000000000016",
      "00000000-0000-4000-8000-000000000066",
      "00000000-0000-4000-8000-00000000015a"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("cancelled");
  });

  it("returns invalid when source != subscription account", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "00000000-0000-4000-8000-000000000017", status: "active", premium_account_id: "other-source" },
    });

    const result = await validateMigrationEligibility(
      db as any,
      "00000000-0000-4000-8000-000000000017",
      "00000000-0000-4000-8000-000000000016",
      "00000000-0000-4000-8000-000000000066",
      "00000000-0000-4000-8000-00000000015a"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("does not belong");
  });

  it("returns invalid when source == target", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "00000000-0000-4000-8000-000000000017", status: "active", premium_account_id: "same-id" },
    });

    const result = await validateMigrationEligibility(
      db as any,
      "00000000-0000-4000-8000-000000000017",
      "00000000-0000-4000-8000-000000000016",
      "same-id",
      "same-id"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("must be different");
  });

  it("returns valid for eligible migration", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "00000000-0000-4000-8000-000000000017", status: "active", premium_account_id: "00000000-0000-4000-8000-000000000066" },
    });

    const result = await validateMigrationEligibility(
      db as any,
      "00000000-0000-4000-8000-000000000017",
      "00000000-0000-4000-8000-000000000016",
      "00000000-0000-4000-8000-000000000066",
      "00000000-0000-4000-8000-00000000015a"
    );
    expect(result.isValid).toBe(true);
  });
});

describe("checkTargetCapacity", () => {
  it("returns invalid when target not found", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: null });

    const result = await checkTargetCapacity(db as any, "00000000-0000-4000-8000-00000000015a", "00000000-0000-4000-8000-000000000016");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns invalid when target is not active", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "t1", status: "inactive", total_slots: 5, used_slots: 2 },
    });

    const result = await checkTargetCapacity(db as any, "00000000-0000-4000-8000-00000000015a", "00000000-0000-4000-8000-000000000016");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("not active");
  });

  it("returns invalid when no available slots", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "t1", status: "active", total_slots: 5, used_slots: 5 },
    });

    const result = await checkTargetCapacity(db as any, "00000000-0000-4000-8000-00000000015a", "00000000-0000-4000-8000-000000000016");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("no available slots");
  });

  it("returns valid when has available slots", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "t1", status: "active", total_slots: 5, used_slots: 3 },
    });

    const result = await checkTargetCapacity(db as any, "00000000-0000-4000-8000-00000000015a", "00000000-0000-4000-8000-000000000016");
    expect(result.isValid).toBe(true);
  });
});

describe("checkNoPendingMigration", () => {
  it("returns valid when no pending migration exists", async () => {
    const db = createMockSupabase();
    db._mocks.mockMaybeSingle.mockResolvedValue({ data: null });

    const result = await checkNoPendingMigration(db as any, "00000000-0000-4000-8000-000000000017");
    expect(result.isValid).toBe(true);
  });

  it("returns invalid when pending migration exists", async () => {
    const db = createMockSupabase();
    db._mocks.mockMaybeSingle.mockResolvedValue({
      data: { id: "00000000-0000-4000-8000-00000000008f", status: "pending" },
    });

    const result = await checkNoPendingMigration(db as any, "00000000-0000-4000-8000-000000000017");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("pending");
  });

  it("returns invalid when in_progress migration exists", async () => {
    const db = createMockSupabase();
    db._mocks.mockMaybeSingle.mockResolvedValue({
      data: { id: "00000000-0000-4000-8000-00000000015b", status: "in_progress" },
    });

    const result = await checkNoPendingMigration(db as any, "00000000-0000-4000-8000-000000000017");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("in_progress");
  });
});

describe("setStepStatus", () => {
  it("calls update with correct params for completed status", async () => {
    const db = createMockSupabase();

    const ctx: MigrationContext = {
      migrationId: "00000000-0000-4000-8000-00000000008f",
      accountId: "00000000-0000-4000-8000-000000000016",
      supabase: db as any,
    };

    await setStepStatus(ctx, 1, "completed");
    expect(db.from).toHaveBeenCalledWith("account_migration_history");
    expect(db._mocks.mockUpdate).toHaveBeenCalled();
    const updateArg = db._mocks.mockUpdate.mock.calls[0][0];
    expect(updateArg.step_status).toBe("completed");
    expect(updateArg.completed_at).toBeDefined();
  });

  it("calls update with error_message for failed status", async () => {
    const db = createMockSupabase();

    const ctx: MigrationContext = {
      migrationId: "00000000-0000-4000-8000-00000000008f",
      accountId: "00000000-0000-4000-8000-000000000016",
      supabase: db as any,
    };

    await setStepStatus(ctx, 2, "failed", { errorMessage: "connection lost" });
    const updateArg = db._mocks.mockUpdate.mock.calls[0][0];
    expect(updateArg.step_status).toBe("failed");
    expect(updateArg.error_message).toBe("connection lost");
  });
});

describe("decrementUsedSlots", () => {
  it("decrements when used_slots > 0", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: { used_slots: 3 } });

    await decrementUsedSlots(db as any, "00000000-0000-4000-8000-0000000003f0");
    expect(db._mocks.mockUpdate).toHaveBeenCalled();
    const updateArg = db._mocks.mockUpdate.mock.calls[0][0];
    expect(updateArg.used_slots).toBe(2);
  });

  it("does not decrement when used_slots is 0", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: { used_slots: 0 } });

    await decrementUsedSlots(db as any, "00000000-0000-4000-8000-0000000003f0");
    expect(db._mocks.mockUpdate).not.toHaveBeenCalled();
  });
});

describe("incrementUsedSlots", () => {
  it("increments used_slots", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: { used_slots: 3 } });

    await incrementUsedSlots(db as any, "00000000-0000-4000-8000-0000000003f0");
    const updateArg = db._mocks.mockUpdate.mock.calls[0][0];
    expect(updateArg.used_slots).toBe(4);
  });

  it("does nothing when data is null", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: null });

    await incrementUsedSlots(db as any, "00000000-0000-4000-8000-0000000003f0");
    expect(db._mocks.mockUpdate).not.toHaveBeenCalled();
  });
});

describe("getMigrationWithSteps", () => {
  it("returns null when migration not found", async () => {
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: null });

    const result = await getMigrationWithSteps(db as any, "00000000-0000-4000-8000-00000000008f", "00000000-0000-4000-8000-000000000016");
    expect(result).toBeNull();
  });
});
