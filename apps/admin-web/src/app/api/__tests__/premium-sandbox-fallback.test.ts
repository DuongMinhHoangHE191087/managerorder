import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  TEST_ACCOUNT_ID,
  createTestRequest,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

const PREMIUM_ROUTE_TIMEOUT_MS = 15_000;

function createSandboxFetchError() {
  const inner = new Error("connect EACCES 127.0.0.1:443 - Local");
  const aggregate = new AggregateError([inner], "fetch failed");
  return Object.assign(new TypeError("fetch failed"), { cause: aggregate });
}

function createFailingSupabaseAdminMock(error: Error) {
  return {
    from: vi.fn(() => {
      throw error;
    }),
  };
}

async function loadRoute(
  routePath: string,
  options: {
    supabaseAdmin: { from: ReturnType<typeof vi.fn> };
    unauthorized?: boolean;
  },
) {
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
    supabaseAdmin: options.supabaseAdmin,
  }));

  return import(routePath);
}

describe("premium sandbox fallback routes", () => {
  it("returns local premium accounts when Supabase is unreachable", async () => {
    const supabaseAdmin = createFailingSupabaseAdminMock(createSandboxFetchError());
    const { GET } = await loadRoute("@/app/api/premium/accounts/route", {
      supabaseAdmin,
    });

    const response = await GET(
      createTestRequest("http://localhost/api/premium/accounts"),
      { params: {} } as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account_id: TEST_ACCOUNT_ID,
          available_slots: expect.any(Number),
          service: expect.objectContaining({ name: "Netflix" }),
          package: expect.objectContaining({ total_slots: expect.any(Number) }),
        }),
      ]),
    );
  }, PREMIUM_ROUTE_TIMEOUT_MS);

  it("returns local premium migrations when Supabase is unreachable", async () => {
    const supabaseAdmin = createFailingSupabaseAdminMock(createSandboxFetchError());
    const { GET } = await loadRoute("@/app/api/premium/migrations/route", {
      supabaseAdmin,
    });

    const response = await GET(
      createTestRequest("http://localhost/api/premium/migrations?status=pending"),
      { params: {} } as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.status).toBe("pending");
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        account_id: TEST_ACCOUNT_ID,
        customer_name: "Nguyen Minh Anh",
        source_account_email: "netflix-team@local",
        target_account_email: "spotify-main@local",
      }),
    );
  });

  it("returns local notifications when Supabase is unreachable", async () => {
    const supabaseAdmin = createFailingSupabaseAdminMock(createSandboxFetchError());
    const { GET } = await loadRoute("@/app/api/notifications/feed/route", {
      supabaseAdmin,
    });

    const response = await GET(
      createTestRequest("http://localhost/api/notifications/feed?limit=12"),
      { params: {} } as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "renewal" }),
        expect.objectContaining({ kind: "migration" }),
        expect.objectContaining({ kind: "premium_health" }),
        expect.objectContaining({ kind: "inventory_capacity" }),
        expect.objectContaining({ kind: "inventory_expiry" }),
      ]),
    );
  });

  it("returns local notifications immediately when local fallback is forced", async () => {
    const previousValue = process.env.CODEX_USE_LOCAL_FALLBACK;
    process.env.CODEX_USE_LOCAL_FALLBACK = "1";

    try {
      const supabaseAdmin = createFailingSupabaseAdminMock(new Error("should not hit supabase"));
      const { GET } = await loadRoute("@/app/api/notifications/feed/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/notifications/feed?limit=12"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "renewal" }),
          expect.objectContaining({ kind: "migration" }),
        ]),
      );
    } finally {
      if (previousValue === undefined) {
        delete process.env.CODEX_USE_LOCAL_FALLBACK;
      } else {
        process.env.CODEX_USE_LOCAL_FALLBACK = previousValue;
      }
    }
  });

  it("returns local premium health check results when Supabase is unreachable", async () => {
    const supabaseAdmin = createFailingSupabaseAdminMock(createSandboxFetchError());
    const { POST } = await loadRoute("@/app/api/premium/health-checks/run/route", {
      supabaseAdmin,
    });

    const response = await POST(
      createTestRequest("http://localhost/api/premium/health-checks/run", {
        method: "POST",
        body: { check_type: "manual" },
      }),
      { params: {} } as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.checked).toBeGreaterThan(0);
    expect(body.data.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "netflix-team@local",
        }),
      ]),
    );
  });

  it("returns local cron health check results when Supabase is unreachable", async () => {
    const previousCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "local-cron-secret";

    try {
      const supabaseAdmin = createFailingSupabaseAdminMock(createSandboxFetchError());
      const { GET } = await loadRoute("@/app/api/cron/premium-health-checks/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/cron/premium-health-checks", {
          headers: {
            authorization: "Bearer local-cron-secret",
          },
        }),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.mode).toBe("local_fallback");
      expect(body.checked).toBeGreaterThan(0);
    } finally {
      if (previousCronSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previousCronSecret;
      }
    }
  });
});
