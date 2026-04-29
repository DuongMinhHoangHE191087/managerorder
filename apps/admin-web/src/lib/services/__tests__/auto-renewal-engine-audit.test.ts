import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_RENEWAL_ENGINE_ACTION_TYPE,
  getAutoRenewalEngineRunHistory,
  recordAutoRenewalEngineRun,
} from "../auto-renewal-engine-audit";

const mocks = vi.hoisted(() => ({
  createActivityLog: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: mocks.createActivityLog,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}));

function createActivityLogsBuilder<T>(
  result: { data: T | null; error: unknown; count?: number },
  terminal: "order" | "range",
) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    order: vi.fn(() => (terminal === "order" ? Promise.resolve(result) : chain)),
    range: vi.fn(() => Promise.resolve(result)),
  };

  return chain;
}

describe("auto-renewal-engine-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a run as an activity log", async () => {
    mocks.createActivityLog.mockResolvedValue({
      id: "00000000-0000-4000-8000-00000000000e",
      account_id: "00000000-0000-4000-8000-000000000016",
      action_type: AUTO_RENEWAL_ENGINE_ACTION_TYPE,
      customer_id: null,
      order_id: null,
      source_account_id: null,
      details: null,
      created_by: "00000000-0000-4000-8000-000000000088",
      created_at: "2026-04-22T02:00:00.000Z",
    });

    await recordAutoRenewalEngineRun({
      accountId: "00000000-0000-4000-8000-000000000016",
      createdBy: "00000000-0000-4000-8000-000000000088",
      mode: "manual",
      snapshot: {
        scannedCount: 4,
        eligibleCount: 1,
        createdCount: 1,
        skippedCount: 3,
        skippedReasons: {
          customer_has_debt: 2,
          low_reliability: 1,
        },
        created: [
          {
            accountId: "00000000-0000-4000-8000-000000000016",
            subscriptionId: "00000000-0000-4000-8000-000000000017",
            renewalId: "00000000-0000-4000-8000-000000000018",
            customerId: "00000000-0000-4000-8000-000000000005",
            customerName: "Nguyen Van A",
            daysRemaining: 4,
          },
        ],
      },
      options: {
        daysThreshold: 7,
        maxCreated: 20,
        minReliabilityScore: 70,
      },
    });

    expect(mocks.createActivityLog).toHaveBeenCalledWith({
      account_id: "00000000-0000-4000-8000-000000000016",
      action_type: AUTO_RENEWAL_ENGINE_ACTION_TYPE,
      created_by: "00000000-0000-4000-8000-000000000088",
      details: {
        mode: "manual",
        scannedCount: 4,
        eligibleCount: 1,
        createdCount: 1,
        skippedCount: 3,
        skippedReasons: {
          customer_has_debt: 2,
          low_reliability: 1,
        },
        created: [
          {
            accountId: "00000000-0000-4000-8000-000000000016",
            subscriptionId: "00000000-0000-4000-8000-000000000017",
            renewalId: "00000000-0000-4000-8000-000000000018",
            customerId: "00000000-0000-4000-8000-000000000005",
            customerName: "Nguyen Van A",
            daysRemaining: 4,
          },
        ],
        daysThreshold: 7,
        maxCreated: 20,
        minReliabilityScore: 70,
      },
    });
  });

  it("parses engine history rows back into typed entries", async () => {
    const historyRows = [
      {
        id: "00000000-0000-4000-8000-00000000000e",
        account_id: "00000000-0000-4000-8000-000000000016",
        action_type: AUTO_RENEWAL_ENGINE_ACTION_TYPE,
        customer_id: null,
        order_id: null,
        source_account_id: null,
        details: {
          mode: "cron",
          scannedCount: 6,
          eligibleCount: 2,
          createdCount: 2,
          skippedCount: 4,
          skippedReasons: JSON.stringify({
            customer_has_debt: 3,
            low_reliability: 1,
          }),
          created: JSON.stringify([
            {
              accountId: "00000000-0000-4000-8000-000000000016",
              subscriptionId: "00000000-0000-4000-8000-000000000017",
              renewalId: "00000000-0000-4000-8000-000000000018",
              customerId: "00000000-0000-4000-8000-000000000005",
              customerName: "Nguyen Van A",
              daysRemaining: 4,
            },
          ]),
          daysThreshold: 5,
          maxCreated: 3,
          minReliabilityScore: 80,
        },
        created_by: "00000000-0000-4000-8000-00000000007f",
        created_at: "2026-04-22T03:15:00.000Z",
      },
    ];
    const dataBuilder = createActivityLogsBuilder(
      {
        data: historyRows,
        error: null,
        count: 1,
      },
      "range",
    );
    const summaryBuilder = createActivityLogsBuilder(
      {
        data: historyRows,
        error: null,
      },
      "order",
    );
    mocks.supabaseFrom.mockImplementationOnce(() => dataBuilder).mockImplementationOnce(() => summaryBuilder);

    const history = await getAutoRenewalEngineRunHistory("00000000-0000-4000-8000-000000000016", {
      page: 2,
      limit: 5,
    });

    expect(mocks.supabaseFrom).toHaveBeenCalledTimes(2);
    expect(dataBuilder.select).toHaveBeenCalledWith("*", { count: "exact" });
    expect(summaryBuilder.select).toHaveBeenCalledWith("id, account_id, created_by, created_at, details");
    expect(dataBuilder.eq).toHaveBeenCalledWith("account_id", "00000000-0000-4000-8000-000000000016");
    expect(dataBuilder.eq).toHaveBeenCalledWith("action_type", AUTO_RENEWAL_ENGINE_ACTION_TYPE);
    expect(summaryBuilder.eq).toHaveBeenCalledWith("account_id", "00000000-0000-4000-8000-000000000016");
    expect(summaryBuilder.eq).toHaveBeenCalledWith("action_type", AUTO_RENEWAL_ENGINE_ACTION_TYPE);
    expect(dataBuilder.range).toHaveBeenCalledWith(5, 9);

    expect(history).toEqual({
      items: [
        {
          id: "00000000-0000-4000-8000-00000000000e",
          accountId: "00000000-0000-4000-8000-000000000016",
          createdBy: "00000000-0000-4000-8000-00000000007f",
          createdAt: "2026-04-22T03:15:00.000Z",
          mode: "cron",
          scannedCount: 6,
          eligibleCount: 2,
          createdCount: 2,
          skippedCount: 4,
          skippedReasons: {
            customer_has_debt: 3,
            low_reliability: 1,
          },
          created: [
            {
              accountId: "00000000-0000-4000-8000-000000000016",
              subscriptionId: "00000000-0000-4000-8000-000000000017",
              renewalId: "00000000-0000-4000-8000-000000000018",
              customerId: "00000000-0000-4000-8000-000000000005",
              customerName: "Nguyen Van A",
              daysRemaining: 4,
            },
          ],
          daysThreshold: 5,
          maxCreated: 3,
          minReliabilityScore: 80,
        },
      ],
      meta: {
        count: 1,
        page: 2,
        limit: 5,
        totalPages: 1,
      },
      summary: {
        manualCount: 0,
        cronCount: 1,
        systemCount: 0,
        userCount: 1,
      },
    });
  });
});
