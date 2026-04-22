import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_RENEWAL_ENGINE_ACTION_TYPE,
  getAutoRenewalEngineRunHistory,
  recordAutoRenewalEngineRun,
} from "../auto-renewal-engine-audit";

const mocks = vi.hoisted(() => ({
  createActivityLog: vi.fn(),
  getActivityLogsPaginated: vi.fn(),
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: mocks.createActivityLog,
  getActivityLogsPaginated: mocks.getActivityLogsPaginated,
}));

describe("auto-renewal-engine-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a run as an activity log", async () => {
    mocks.createActivityLog.mockResolvedValue({
      id: "log-1",
      account_id: "acc-1",
      action_type: AUTO_RENEWAL_ENGINE_ACTION_TYPE,
      customer_id: null,
      order_id: null,
      source_account_id: null,
      details: null,
      created_by: "user-1",
      created_at: "2026-04-22T02:00:00.000Z",
    });

    await recordAutoRenewalEngineRun({
      accountId: "acc-1",
      createdBy: "user-1",
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
            accountId: "acc-1",
            subscriptionId: "sub-1",
            renewalId: "renew-1",
            customerId: "cust-1",
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
      account_id: "acc-1",
      action_type: AUTO_RENEWAL_ENGINE_ACTION_TYPE,
      created_by: "user-1",
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
            accountId: "acc-1",
            subscriptionId: "sub-1",
            renewalId: "renew-1",
            customerId: "cust-1",
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
    mocks.getActivityLogsPaginated.mockResolvedValue({
      data: [
        {
          id: "log-1",
          account_id: "acc-1",
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
                accountId: "acc-1",
                subscriptionId: "sub-1",
                renewalId: "renew-1",
                customerId: "cust-1",
                customerName: "Nguyen Van A",
                daysRemaining: 4,
              },
            ]),
            daysThreshold: 5,
            maxCreated: 3,
            minReliabilityScore: 80,
          },
          created_by: "test-user-id-001",
          created_at: "2026-04-22T03:15:00.000Z",
        },
      ],
      meta: {
        count: 1,
        page: 2,
        limit: 5,
        totalPages: 1,
      },
    });

    const history = await getAutoRenewalEngineRunHistory("acc-1", {
      page: 2,
      limit: 5,
    });

    expect(mocks.getActivityLogsPaginated).toHaveBeenCalledWith("acc-1", {
      page: 2,
      limit: 5,
      actionType: AUTO_RENEWAL_ENGINE_ACTION_TYPE,
    });
    expect(history).toEqual({
      items: [
        {
          id: "log-1",
          accountId: "acc-1",
          createdBy: "test-user-id-001",
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
              accountId: "acc-1",
              subscriptionId: "sub-1",
              renewalId: "renew-1",
              customerId: "cust-1",
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
    });
  });
});
