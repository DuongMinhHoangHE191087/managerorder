import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestRequest,
  TEST_ACCOUNT_ID,
  mockRBAC,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

type RouteModule = typeof import("@/app/api/premium/renewals/auto-run/route");

const mocks = vi.hoisted(() => ({
  runAutoRenewalEngine: vi.fn(),
}));

async function loadRoute(options?: { allowRoles?: boolean; role?: string }) {
  vi.resetModules();
  vi.doMock("@/lib/api/with-account", () => mockWithAccount());
  vi.doMock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
  vi.doMock("@/lib/api/rbac", () =>
    mockRBAC({
      user: options?.role ? { role: options.role } : undefined,
      allowRoles: options?.allowRoles ?? true,
    }),
  );
  vi.doMock("@/lib/services/auto-renewal-engine", () => ({
    runAutoRenewalEngine: mocks.runAutoRenewalEngine,
  }));

  return import("@/app/api/premium/renewals/auto-run/route") as Promise<RouteModule>;
}

describe("POST /api/premium/renewals/auto-run", () => {
  const previousCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
  });

  afterEach(() => {
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
  });

  it("returns 403 for non-admin-owner users", async () => {
    const route = await loadRoute({ role: "sales_staff", allowRoles: false });

    const response = await route.POST(
      createTestRequest("http://localhost/api/premium/renewals/auto-run", {
        method: "POST",
        body: {
          days_threshold: 5,
          max_created: 3,
          min_reliability_score: 80,
        },
      }),
      { params: Promise.resolve({}) } as any,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Ban khong co quyen thuc hien thao tac nay",
      requiredRoles: ["admin_owner"],
      currentRole: "sales_staff",
    });
    expect(mocks.runAutoRenewalEngine).not.toHaveBeenCalled();
  });

  it("passes the current account and parsed options to the engine", async () => {
    const report = {
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
          accountId: "account-1",
          subscriptionId: "sub-1",
          renewalId: "renew-1",
          customerId: "cust-1",
          customerName: "Nguyen Van A",
          daysRemaining: 4,
        },
      ],
    };

    mocks.runAutoRenewalEngine.mockResolvedValue(report);

    const route = await loadRoute();
    const response = await route.POST(
      createTestRequest("http://localhost/api/premium/renewals/auto-run", {
        method: "POST",
        body: {
          days_threshold: "5",
          max_created: "3",
          min_reliability_score: "80",
        },
      }),
      { params: Promise.resolve({}) } as any,
    );

    expect(response.status).toBe(200);
    expect(mocks.runAutoRenewalEngine).toHaveBeenCalledWith({
      accountId: TEST_ACCOUNT_ID,
      daysThreshold: 5,
      maxCreated: 3,
      minReliabilityScore: 80,
    });
    const body = await response.json();
    expect(body.data).toEqual(report);
    expect(body.meta).toMatchObject({
      accountId: TEST_ACCOUNT_ID,
      mode: "manual",
    });
  });
});
