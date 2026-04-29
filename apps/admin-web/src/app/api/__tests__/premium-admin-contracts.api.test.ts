import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TEST_ACCOUNT_ID,
  createTestRequest,
  mockRBAC,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

type LoadRouteOptions = {
  supabaseAdmin?: { from: ReturnType<typeof vi.fn> };
  unauthorized?: boolean;
  rbacFactory?: () => Promise<object>;
  extraMocks?: Record<string, () => object | Promise<object>>;
};

const PREMIUM_ROUTE_TIMEOUT_MS = 15_000;

const emptySupabaseAdmin = {
  from: vi.fn(() => {
    throw new Error("Supabase should not be called in this contract test");
  }),
};

async function loadRoute(routePath: string, options: LoadRouteOptions = {}) {
  vi.resetModules();

  vi.doMock(
    "@/lib/api/with-account",
    () =>
      options.unauthorized
        ? {
            withAccount: () => async () =>
              NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
          }
        : mockWithAccount(),
  );
  vi.doMock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
  vi.doMock("@/lib/supabase/admin", () => ({
    supabaseAdmin: options.supabaseAdmin ?? emptySupabaseAdmin,
  }));
  vi.doMock("@/lib/api/rbac", options.rbacFactory ?? (() => mockRBAC()));

  for (const [modulePath, factory] of Object.entries(options.extraMocks ?? {})) {
    vi.doMock(modulePath, factory);
  }

  return import(routePath);
}

describe("premium admin contract routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe("GET/PATCH /api/premium/accounts/[id]", () => {
    it("returns the local premium account detail for premium-local-spotify", async () => {
      vi.stubEnv("NODE_ENV", "development");

      const { GET } = await loadRoute("@/app/api/premium/accounts/[id]/route");
      const response = await GET(
        createTestRequest("http://localhost/api/premium/accounts/premium-local-spotify"),
        { params: { id: "premium-local-spotify" } } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.id).toBe("premium-local-spotify");
      expect(body.data.primary_email).toBeTruthy();
      expect(body.data.subscriptions.length).toBeGreaterThan(0);
      expect(body.data.renewals.length).toBeGreaterThan(0);
      expect(body.data.migrations.length).toBeGreaterThan(0);
      expect(body.data.audit.meta.page).toBe(1);
    }, PREMIUM_ROUTE_TIMEOUT_MS);

    it("patches local premium account detail without hitting a missing detail route", async () => {
      vi.stubEnv("NODE_ENV", "development");

      const { PATCH } = await loadRoute("@/app/api/premium/accounts/[id]/route");
      const response = await PATCH(
        createTestRequest("http://localhost/api/premium/accounts/premium-local-spotify", {
          method: "PATCH",
          body: {
            primary_email: "spotify-updated@example.com",
            total_slots: 7,
            status: "suspended",
            notes: "Updated from contract test",
          },
        }),
        { params: { id: "premium-local-spotify" } } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.id).toBe("premium-local-spotify");
      expect(body.data.primary_email).toBe("spotify-updated@example.com");
      expect(body.data.total_slots).toBe(7);
      expect(body.data.status).toBe("suspended");
      expect(body.data.notes).toBe("Updated from contract test");
    });
  });

  describe("GET /api/premium/renewals/auto-run/history", () => {
    it("parses mode, created_by, date range, page, and limit into the service query", async () => {
      const getAutoRenewalEngineRunHistory = vi.fn().mockResolvedValue({
        items: [
          {
            id: "00000000-0000-4000-8000-000000000071",
            accountId: "00000000-0000-4000-8000-000000000016",
            createdBy: null,
            createdAt: "2026-04-20T10:00:00.000Z",
            mode: "cron",
            daysThreshold: 7,
            maxCreated: 20,
            minReliabilityScore: 70,
            scannedCount: 10,
            eligibleCount: 4,
            createdCount: 2,
            skippedCount: 8,
            skippedReasons: { debt: 2 },
            created: [],
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
          systemCount: 1,
          userCount: 0,
        },
      });

      const { GET } = await loadRoute(
        "@/app/api/premium/renewals/auto-run/history/route",
        {
          extraMocks: {
            "@/lib/services/auto-renewal-engine-audit": () => ({
              getAutoRenewalEngineRunHistory,
            }),
          },
        },
      );

      const response = await GET(
        createTestRequest(
          "http://localhost/api/premium/renewals/auto-run/history?mode=cron&created_by=system&from_date=2026-04-01&to_date=2026-04-20&page=2&limit=5",
        ),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(getAutoRenewalEngineRunHistory).toHaveBeenCalledWith(TEST_ACCOUNT_ID, {
        page: 2,
        limit: 5,
        mode: "cron",
        createdBy: "system",
        fromDate: "2026-04-01",
        toDate: "2026-04-20",
      });
      expect(body.data.meta.page).toBe(2);
      expect(body.data.summary.systemCount).toBe(1);
    });

    it("blocks callers without admin_owner role", async () => {
      const { GET } = await loadRoute(
        "@/app/api/premium/renewals/auto-run/history/route",
        {
          rbacFactory: () => mockRBAC({ allowRoles: false }),
          extraMocks: {
            "@/lib/services/auto-renewal-engine-audit": () => ({
              getAutoRenewalEngineRunHistory: vi.fn(),
            }),
          },
        },
      );

      const response = await GET(
        createTestRequest("http://localhost/api/premium/renewals/auto-run/history"),
        { params: {} } as any,
      );

      expect(response.status).toBe(403);
    });
  });

  describe("PATCH /api/premium/migrations/[id]", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("updates pending migration metadata in local fallback mode", async () => {
      const { PATCH } = await loadRoute("@/app/api/premium/migrations/[id]/route");
      const response = await PATCH(
        createTestRequest("http://localhost/api/premium/migrations/mig-local-pending", {
          method: "PATCH",
          body: {
            target_account_id: "premium-local-youtube",
            reason: "Move to cleaner target account",
            notes: "Prioritize reliability",
          },
        }),
        { params: { id: "mig-local-pending" } } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.id).toBe("mig-local-pending");
      expect(body.data.target_account_id).toBe("premium-local-youtube");
      expect(body.data.reason).toBe("Move to cleaner target account");
      expect(body.data.notes).toBe("Prioritize reliability");
    });

    it("starts pending migrations through the PATCH action surface", async () => {
      const { PATCH } = await loadRoute("@/app/api/premium/migrations/[id]/route");
      const response = await PATCH(
        createTestRequest("http://localhost/api/premium/migrations/mig-local-pending", {
          method: "PATCH",
          body: { action: "start" },
        }),
        { params: { id: "mig-local-pending" } } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.status).toBe("in_progress");
    });

    it("completes migrations through the PATCH action surface", async () => {
      const { PATCH } = await loadRoute("@/app/api/premium/migrations/[id]/route");
      const response = await PATCH(
        createTestRequest("http://localhost/api/premium/migrations/mig-local-pending", {
          method: "PATCH",
          body: {
            action: "complete",
            target_user_id: "00000000-0000-4000-8000-000000000072",
          },
        }),
        { params: { id: "mig-local-pending" } } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.status).toBe("completed");
      expect(body.data.completed_at).toBeTruthy();
    });

    it("fails migrations through the PATCH action surface", async () => {
      const { PATCH } = await loadRoute("@/app/api/premium/migrations/[id]/route");
      const response = await PATCH(
        createTestRequest("http://localhost/api/premium/migrations/mig-local-pending", {
          method: "PATCH",
          body: {
            action: "fail",
            failure_reason: "Target login check failed",
          },
        }),
        { params: { id: "mig-local-pending" } } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.status).toBe("failed");
      expect(body.data.completed_at).toBeTruthy();
      expect(body.data.details.terminal_reason).toBe("failed_by_admin");
    });

    it("cancels migrations as failed+cancelled_by_admin in local fallback mode", async () => {
      const { PATCH } = await loadRoute("@/app/api/premium/migrations/[id]/route");
      const response = await PATCH(
        createTestRequest("http://localhost/api/premium/migrations/mig-local-pending", {
          method: "PATCH",
          body: { action: "cancel" },
        }),
        { params: { id: "mig-local-pending" } } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.status).toBe("failed");
      expect(body.data.details.terminal_reason).toBe("cancelled_by_admin");
    });
  });
});
