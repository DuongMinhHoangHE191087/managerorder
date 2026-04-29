import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestRequest,
  TEST_ACCOUNT_ID,
  mockRBAC,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

type RouteModule = typeof import("@/app/api/premium/renewals/auto-run/history/route");

const mocks = vi.hoisted(() => ({
  getAutoRenewalEngineRunHistory: vi.fn(),
}));
const PREMIUM_ROUTE_TIMEOUT_MS = 15_000;

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
  vi.doMock("@/lib/services/auto-renewal-engine-audit", () => ({
    getAutoRenewalEngineRunHistory: mocks.getAutoRenewalEngineRunHistory,
  }));

  return import("@/app/api/premium/renewals/auto-run/history/route") as Promise<RouteModule>;
}

describe("GET /api/premium/renewals/auto-run/history", () => {
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

    const response = await route.GET(
      createTestRequest("http://localhost/api/premium/renewals/auto-run/history"),
      { params: Promise.resolve({}) } as any,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Ban khong co quyen thuc hien thao tac nay",
      requiredRoles: ["admin_owner"],
      currentRole: "sales_staff",
    });
    expect(mocks.getAutoRenewalEngineRunHistory).not.toHaveBeenCalled();
  }, PREMIUM_ROUTE_TIMEOUT_MS);

  it("returns the paginated engine history for the current account", async () => {
    const history = {
      items: [
        {
          id: "00000000-0000-4000-8000-00000000000e",
          accountId: TEST_ACCOUNT_ID,
          createdBy: "00000000-0000-4000-8000-00000000007f",
          createdAt: "2026-04-22T02:30:00.000Z",
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
              accountId: TEST_ACCOUNT_ID,
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
      ],
      meta: {
        count: 12,
        page: 2,
        limit: 5,
        totalPages: 3,
      },
    };

    mocks.getAutoRenewalEngineRunHistory.mockResolvedValue(history);

    const route = await loadRoute();
    const response = await route.GET(
      createTestRequest("http://localhost/api/premium/renewals/auto-run/history?page=2&limit=5"),
      { params: Promise.resolve({}) } as any,
    );

    expect(response.status).toBe(200);
    expect(mocks.getAutoRenewalEngineRunHistory).toHaveBeenCalledWith(TEST_ACCOUNT_ID, {
      page: 2,
      limit: 5,
    });
    const body = await response.json();
    expect(body.data).toEqual(history);
  });
});
