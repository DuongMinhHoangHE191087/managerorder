import { describe, it, expect, vi } from "vitest";

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
    const { validateMigrationEligibility } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: null });

    const result = await validateMigrationEligibility(
      db as any,
      "sub-1",
      "acc-1",
      "source-1",
      "target-1"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Subscription not found");
  });

  it("returns invalid for cancelled subscription", async () => {
    const { validateMigrationEligibility } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "sub-1", status: "cancelled", premium_account_id: "source-1" },
    });

    const result = await validateMigrationEligibility(
      db as any,
      "sub-1",
      "acc-1",
      "source-1",
      "target-1"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("cancelled");
  });

  it("returns invalid when source != subscription account", async () => {
    const { validateMigrationEligibility } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "sub-1", status: "active", premium_account_id: "other-source" },
    });

    const result = await validateMigrationEligibility(
      db as any,
      "sub-1",
      "acc-1",
      "source-1",
      "target-1"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("does not belong");
  });

  it("returns invalid when source == target", async () => {
    const { validateMigrationEligibility } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "sub-1", status: "active", premium_account_id: "same-id" },
    });

    const result = await validateMigrationEligibility(
      db as any,
      "sub-1",
      "acc-1",
      "same-id",
      "same-id"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("must be different");
  });

  it("returns valid for eligible migration", async () => {
    const { validateMigrationEligibility } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "sub-1", status: "active", premium_account_id: "source-1" },
    });

    const result = await validateMigrationEligibility(
      db as any,
      "sub-1",
      "acc-1",
      "source-1",
      "target-1"
    );
    expect(result.isValid).toBe(true);
  });
});

describe("checkTargetCapacity", () => {
  it("returns invalid when target not found", async () => {
    const { checkTargetCapacity } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: null });

    const result = await checkTargetCapacity(db as any, "target-1", "acc-1");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns invalid when target is not active", async () => {
    const { checkTargetCapacity } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "t1", status: "inactive", total_slots: 5, used_slots: 2 },
    });

    const result = await checkTargetCapacity(db as any, "target-1", "acc-1");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("not active");
  });

  it("returns invalid when no available slots", async () => {
    const { checkTargetCapacity } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "t1", status: "active", total_slots: 5, used_slots: 5 },
    });

    const result = await checkTargetCapacity(db as any, "target-1", "acc-1");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("no available slots");
  });

  it("returns valid when has available slots", async () => {
    const { checkTargetCapacity } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({
      data: { id: "t1", status: "active", total_slots: 5, used_slots: 3 },
    });

    const result = await checkTargetCapacity(db as any, "target-1", "acc-1");
    expect(result.isValid).toBe(true);
  });
});

describe("checkNoPendingMigration", () => {
  it("returns valid when no pending migration exists", async () => {
    const { checkNoPendingMigration } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockMaybeSingle.mockResolvedValue({ data: null });

    const result = await checkNoPendingMigration(db as any, "sub-1");
    expect(result.isValid).toBe(true);
  });

  it("returns invalid when pending migration exists", async () => {
    const { checkNoPendingMigration } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockMaybeSingle.mockResolvedValue({
      data: { id: "mig-1", status: "pending" },
    });

    const result = await checkNoPendingMigration(db as any, "sub-1");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("pending");
  });

  it("returns invalid when in_progress migration exists", async () => {
    const { checkNoPendingMigration } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockMaybeSingle.mockResolvedValue({
      data: { id: "mig-2", status: "in_progress" },
    });

    const result = await checkNoPendingMigration(db as any, "sub-1");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("in_progress");
  });
});

describe("setStepStatus", () => {
  it("calls update with correct params for completed status", async () => {
    const { setStepStatus } = await import("../migrations-helpers");
    const db = createMockSupabase();

    const ctx: MigrationContext = {
      migrationId: "mig-1",
      accountId: "acc-1",
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
    const { setStepStatus } = await import("../migrations-helpers");
    const db = createMockSupabase();

    const ctx: MigrationContext = {
      migrationId: "mig-1",
      accountId: "acc-1",
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
    const { decrementUsedSlots } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: { used_slots: 3 } });

    await decrementUsedSlots(db as any, "pa-1");
    expect(db._mocks.mockUpdate).toHaveBeenCalled();
    const updateArg = db._mocks.mockUpdate.mock.calls[0][0];
    expect(updateArg.used_slots).toBe(2);
  });

  it("does not decrement when used_slots is 0", async () => {
    const { decrementUsedSlots } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: { used_slots: 0 } });

    await decrementUsedSlots(db as any, "pa-1");
    expect(db._mocks.mockUpdate).not.toHaveBeenCalled();
  });
});

describe("incrementUsedSlots", () => {
  it("increments used_slots", async () => {
    const { incrementUsedSlots } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: { used_slots: 3 } });

    await incrementUsedSlots(db as any, "pa-1");
    const updateArg = db._mocks.mockUpdate.mock.calls[0][0];
    expect(updateArg.used_slots).toBe(4);
  });

  it("does nothing when data is null", async () => {
    const { incrementUsedSlots } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: null });

    await incrementUsedSlots(db as any, "pa-1");
    expect(db._mocks.mockUpdate).not.toHaveBeenCalled();
  });
});

describe("getMigrationWithSteps", () => {
  it("returns null when migration not found", async () => {
    const { getMigrationWithSteps } = await import("../migrations-helpers");
    const db = createMockSupabase();
    db._mocks.mockSingle.mockResolvedValue({ data: null });

    const result = await getMigrationWithSteps(db as any, "mig-1", "acc-1");
    expect(result).toBeNull();
  });
});
