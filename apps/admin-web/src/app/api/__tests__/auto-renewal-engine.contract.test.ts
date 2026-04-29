import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRequest } from "./helpers/setup";

type RouteModule = typeof import("@/app/api/cron/auto-renewal-engine/route");

const mocks = vi.hoisted(() => ({
  runAutoRenewalEngine: vi.fn(),
  recordAutoRenewalEngineRun: vi.fn(),
}));

vi.mock("@/lib/services/auto-renewal-engine", () => ({
  runAutoRenewalEngine: mocks.runAutoRenewalEngine,
}));
vi.mock("@/lib/services/auto-renewal-engine-audit", () => ({
  recordAutoRenewalEngineRun: mocks.recordAutoRenewalEngineRun,
}));

async function loadRoute(): Promise<RouteModule> {
  vi.resetModules();
  return import("@/app/api/cron/auto-renewal-engine/route");
}

describe("GET /api/cron/auto-renewal-engine", () => {
  const previousCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const route = await loadRoute();

    const response = await route.GET(
      createTestRequest("http://localhost/api/cron/auto-renewal-engine"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "CRON_SECRET not configured",
    });
    expect(mocks.runAutoRenewalEngine).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer secret is invalid", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const route = await loadRoute();

    const response = await route.GET(
      createTestRequest("http://localhost/api/cron/auto-renewal-engine", {
        headers: {
          authorization: "Bearer wrong-secret",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
    expect(mocks.runAutoRenewalEngine).not.toHaveBeenCalled();
  });

  it("passes query params to the engine service and returns the report", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const report = {
      scannedCount: 3,
      eligibleCount: 1,
      createdCount: 1,
      skippedCount: 2,
      skippedReasons: {
        customer_has_debt: 1,
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
      accountSummaries: [
        {
          accountId: "00000000-0000-4000-8000-000000000016",
          scannedCount: 3,
          eligibleCount: 1,
          createdCount: 1,
          skippedCount: 2,
          skippedReasons: {
            customer_has_debt: 1,
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
      ],
    };

    mocks.runAutoRenewalEngine.mockResolvedValue(report);

    const route = await loadRoute();
    const response = await route.GET(
      createTestRequest(
        "http://localhost/api/cron/auto-renewal-engine?days_threshold=5&max_created=3&min_reliability_score=80",
        {
          headers: {
            authorization: "Bearer cron-secret",
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.runAutoRenewalEngine).toHaveBeenCalledWith({
      daysThreshold: 5,
      maxCreated: 3,
      minReliabilityScore: 80,
    });
    expect(mocks.recordAutoRenewalEngineRun).toHaveBeenCalledWith({
      accountId: "00000000-0000-4000-8000-000000000016",
      createdBy: null,
      mode: "cron",
      snapshot: report.accountSummaries[0],
      options: {
        daysThreshold: 5,
        maxCreated: 3,
        minReliabilityScore: 80,
      },
    });
    expect(await response.json()).toEqual({
      success: true,
      ...report,
    });
  });
});
