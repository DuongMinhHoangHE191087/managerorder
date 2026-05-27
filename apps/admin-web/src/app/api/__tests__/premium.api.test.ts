import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TEST_ACCOUNT_ID,
  createTestRequest,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";
import {
  calculateProratedRefund,
  getDaysRemaining,
} from "@/lib/utils/premium-accounts-helpers";

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
  count?: number;
};

const VALID_PREMIUM_KEY = "a".repeat(64);
const VALID_SERVICE_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_PACKAGE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const PREMIUM_ROUTE_TIMEOUT_MS = 25_000;

function createSelectBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "order" | "limit" | "in" | "is" | "range" | "single" | "maybeSingle" = "order",
) {
  const unwrapSingleData = () => {
    if (Array.isArray(result.data)) {
      return result.data[0] ?? null;
    }

    return result.data;
  };
  const resolveMany = () => Promise.resolve(result);
  const resolveSingle = () =>
    Promise.resolve({
      data: unwrapSingleData(),
      error: result.error,
      count: result.count,
    });
  let resolveOnEq = false;
  const chain = {
    select: vi.fn((_: unknown, options?: { head?: boolean }) => {
      resolveOnEq = Boolean(options?.head);
      return chain;
    }),
    eq: vi.fn(() => {
      if (resolveOnEq) {
        resolveOnEq = false;
        return resolveMany();
      }

      return chain;
    }),
    is: vi.fn(() => (terminal === "is" ? resolveMany() : chain)),
    in: vi.fn(() => (terminal === "in" ? resolveMany() : chain)),
    order: vi.fn(() => (terminal === "order" ? resolveMany() : chain)),
    limit: vi.fn(() => (terminal === "limit" ? resolveMany() : chain)),
    range: vi.fn(() => (terminal === "range" ? resolveMany() : chain)),
    single: vi.fn(() => resolveSingle()),
    maybeSingle: vi.fn(() => resolveSingle()),
  };

  return chain;
}

function createQueryResultBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "order" | "limit" | "in" | "range" | "single" | "maybeSingle" = "single",
) {
  const unwrapSingleData = () => {
    if (Array.isArray(result.data)) {
      return result.data[0] ?? null;
    }

    return result.data;
  };
  const resolveMany = () => Promise.resolve(result);
  const resolveSingle = () =>
    Promise.resolve({
      data: unwrapSingleData(),
      error: result.error,
      count: result.count,
    });
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => (terminal === "in" ? resolveMany() : chain)),
    order: vi.fn(() => (terminal === "order" ? resolveMany() : chain)),
    range: vi.fn(() => (terminal === "range" ? resolveMany() : chain)),
    limit: vi.fn(() => (terminal === "limit" ? resolveMany() : chain)),
    single: vi.fn(() => resolveSingle()),
    maybeSingle: vi.fn(() => resolveSingle()),
  };

  return chain;
}

function createInsertBuilder<T, U = T>(
  result: SupabaseResult<T>,
  followUpResult?: SupabaseResult<U>,
) {
  let selectCount = 0;
  const chain = {
    insert: vi.fn((rows: Array<Record<string, unknown>>) => {
      void rows;
      return chain;
    }),
    select: vi.fn(() => {
      selectCount += 1;
      return createQueryResultBuilder(
        (selectCount === 1 || !followUpResult
          ? result
          : followUpResult) as SupabaseResult<T | U>,
        "single",
      );
    }),
  };

  return chain;
}

function createUpdateBuilder<T, U = T>(
  result: SupabaseResult<T>,
  followUpResult?: SupabaseResult<U>,
) {
  let selectCount = 0;
  const chain = {
    update: vi.fn((rows: Array<Record<string, unknown>>) => {
      void rows;
      return chain;
    }),
    eq: vi.fn(() => chain),
    select: vi.fn(() => {
      selectCount += 1;
      return createQueryResultBuilder(
        (selectCount === 1 || !followUpResult
          ? result
          : followUpResult) as SupabaseResult<T | U>,
        "single",
      );
    }),
  };

  return chain;
}

function createMigrationTableBuilder<TExisting, TInsert>(
  existingResult: SupabaseResult<TExisting>,
  insertResult: SupabaseResult<TInsert>,
) {
  let selectCount = 0;
  const chain = {
    insert: vi.fn((rows: Array<Record<string, unknown>>) => {
      void rows;
      return chain;
    }),
    select: vi.fn(() => {
      selectCount += 1;
      return createQueryResultBuilder(
        (selectCount === 1 ? existingResult : insertResult) as SupabaseResult<TExisting | TInsert>,
        selectCount === 1 ? "maybeSingle" : "single",
      );
    }),
  };

  return chain;
}

function createSupabaseAdminMock(builders: Record<string, ReturnType<typeof vi.fn> | object>) {
  return {
    from: vi.fn((table: string) => {
      const builder = builders[table];

      if (!builder) {
        throw new Error(`Missing supabase builder for table ${table}`);
      }

      return builder;
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

describe("premium API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
  });

  describe("GET/POST /api/premium/accounts", () => {
    it("hydrates premium accounts from base rows and lookup tables", async () => {
      const builder = createSelectBuilder({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000016",
            account_id: TEST_ACCOUNT_ID,
            service_type_id: VALID_SERVICE_ID,
            package_id: VALID_PACKAGE_ID,
            primary_email: "owner@example.com",
            primary_password_encrypted: "encrypted",
            total_slots: 5,
            used_slots: 2,
            subscription_start_date: "2026-04-01T00:00:00.000Z",
            subscription_expiry_date: "2027-04-01T00:00:00.000Z",
            status: "active",
            connection_status: "working",
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      });
      const serviceBuilder = createSelectBuilder(
        {
          data: [
            {
              id: VALID_SERVICE_ID,
              name: "Netflix",
              slug: "netflix",
              logo_url: null,
            },
          ],
          error: null,
        },
        "in",
      );
      const packageBuilder = createSelectBuilder(
        {
          data: [
            {
              id: VALID_PACKAGE_ID,
              name: "Premium",
              slug: "premium",
              total_slots: 5,
            },
          ],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        premium_accounts: builder,
        premium_service_types: serviceBuilder,
        premium_packages: packageBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/accounts/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/accounts"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.meta.total).toBe(1);
      expect(body.data[0].service).toEqual({
        name: "Netflix",
        slug: "netflix",
        logo_url: null,
      });
      expect(body.data[0].package).toEqual({
        name: "Premium",
        slug: "premium",
        total_slots: 5,
      });
      expect(builder.select).toHaveBeenCalledWith("*");
      expect(builder.eq).toHaveBeenCalledWith("account_id", TEST_ACCOUNT_ID);
      expect(serviceBuilder.select).toHaveBeenCalledWith(
        "id, name, slug, logo_url",
      );
      expect(packageBuilder.select).toHaveBeenCalledWith(
        "id, name, slug, total_slots",
      );
    }, PREMIUM_ROUTE_TIMEOUT_MS);

    it("still reads premium accounts from supabase in development unless local fallback is forced", async () => {
      vi.stubEnv("NODE_ENV", "development");

      const builder = createSelectBuilder({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000116",
            account_id: TEST_ACCOUNT_ID,
            service_type_id: VALID_SERVICE_ID,
            package_id: VALID_PACKAGE_ID,
            primary_email: "db-owner@example.com",
            primary_password_encrypted: "encrypted",
            total_slots: 6,
            used_slots: 3,
            subscription_start_date: "2026-04-01T00:00:00.000Z",
            subscription_expiry_date: "2027-04-01T00:00:00.000Z",
            status: "active",
            connection_status: "working",
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      });
      const serviceBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_SERVICE_ID, name: "Netflix", slug: "netflix", logo_url: null }],
          error: null,
        },
        "in",
      );
      const packageBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_PACKAGE_ID, name: "Premium", slug: "premium", total_slots: 6 }],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        premium_accounts: builder,
        premium_service_types: serviceBuilder,
        premium_packages: packageBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/accounts/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/accounts"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].primary_email).toBe("db-owner@example.com");
      expect(builder.select).toHaveBeenCalled();
    });

    it("rejects invalid premium account payloads", async () => {
      const builder = createInsertBuilder({ data: null, error: null });
      const supabaseAdmin = createSupabaseAdminMock({ premium_accounts: builder });
      const { POST } = await loadRoute("@/app/api/premium/accounts/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/accounts", {
          method: "POST",
          body: { primary_email: "broken@example.com" },
        }),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(builder.insert).not.toHaveBeenCalled();
    });

    it("returns a clear missing-env error before inserting premium accounts", async () => {
      const builder = createInsertBuilder({ data: null, error: null });
      const supabaseAdmin = createSupabaseAdminMock({ premium_accounts: builder });
      const { POST } = await loadRoute("@/app/api/premium/accounts/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/accounts", {
          method: "POST",
          body: {
            service_type_id: VALID_SERVICE_ID,
            package_id: VALID_PACKAGE_ID,
            primary_email: "owner@example.com",
            primary_password_encrypted: "super-secret",
            total_slots: 5,
            billing_cycle: "1year",
            subscription_expiry_date: "2027-01-01T00:00:00.000Z",
          },
        }),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain("PREMIUM_PASSWORD_ENCRYPTION_KEY");
      expect(body.code).toBe("PREMIUM_ENCRYPTION_KEY_MISSING");
      expect(builder.insert).not.toHaveBeenCalled();
    });

    it("creates premium accounts with encrypted credentials", async () => {
      vi.stubEnv("PREMIUM_PASSWORD_ENCRYPTION_KEY", VALID_PREMIUM_KEY);

      const builder = createInsertBuilder(
        {
          data: {
            id: "00000000-0000-4000-8000-000000000084",
          },
          error: null,
        },
        {
          data: {
            id: "00000000-0000-4000-8000-000000000084",
            account_id: TEST_ACCOUNT_ID,
            service_type_id: VALID_SERVICE_ID,
            package_id: VALID_PACKAGE_ID,
            primary_email: "created@example.com",
            primary_password_encrypted: "encrypted-value",
            total_slots: 5,
            used_slots: 0,
            subscription_start_date: "2026-04-10T00:00:00.000Z",
            subscription_expiry_date: "2027-01-01T00:00:00.000Z",
            status: "active",
            connection_status: "manual_check_needed",
          },
          error: null,
        },
      );
      const serviceBuilder = createSelectBuilder(
        {
          data: [
            {
              id: VALID_SERVICE_ID,
              name: "Netflix",
              slug: "netflix",
              logo_url: null,
            },
          ],
          error: null,
        },
        "in",
      );
      const packageBuilder = createSelectBuilder(
        {
          data: [
            {
              id: VALID_PACKAGE_ID,
              name: "Premium",
              slug: "premium",
              total_slots: 5,
            },
          ],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        premium_accounts: builder,
        premium_service_types: serviceBuilder,
        premium_packages: packageBuilder,
      });
      const { POST } = await loadRoute("@/app/api/premium/accounts/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/accounts", {
          method: "POST",
          body: {
            service_type_id: VALID_SERVICE_ID,
            package_id: VALID_PACKAGE_ID,
            primary_email: "created@example.com",
            primary_password_encrypted: "super-secret",
            total_slots: 5,
            billing_cycle: "1year",
            subscription_expiry_date: "2027-01-01T00:00:00.000Z",
          },
        }),
        { params: {} } as any,
      );
      const body = await response.json();
      const insertRows = builder.insert.mock.calls[0]?.[0] as
        | Array<Record<string, unknown>>
        | undefined;

      if (!insertRows?.[0]) {
        throw new Error("Expected premium account insert payload");
      }

      const insertedRow = insertRows[0] as {
        account_id: string;
        connection_status: string;
        primary_password_encrypted: string;
      };

      expect(response.status).toBe(201);
      expect(body.data.id).toBe("00000000-0000-4000-8000-000000000084");
      expect(insertedRow.account_id).toBe(TEST_ACCOUNT_ID);
      expect(insertedRow.connection_status).toBe("manual_check_needed");
      expect(insertedRow.primary_password_encrypted).not.toBe("super-secret");
      expect(insertedRow.primary_password_encrypted.split(":")).toHaveLength(3);
    });

    it("returns conflict errors for duplicate premium account emails", async () => {
      vi.stubEnv("PREMIUM_PASSWORD_ENCRYPTION_KEY", VALID_PREMIUM_KEY);

      const builder = createInsertBuilder({
        data: null,
        error: { message: "duplicate key value", code: "23505" },
      });
      const supabaseAdmin = createSupabaseAdminMock({ premium_accounts: builder });
      const { POST } = await loadRoute("@/app/api/premium/accounts/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/accounts", {
          method: "POST",
          body: {
            service_type_id: VALID_SERVICE_ID,
            package_id: VALID_PACKAGE_ID,
            primary_email: "created@example.com",
            primary_password_encrypted: "super-secret",
            total_slots: 5,
            billing_cycle: "1year",
            subscription_expiry_date: "2027-01-01T00:00:00.000Z",
          },
        }),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.code).toBe("CONFLICT");
    });

    it("flattens premium account query failures", async () => {
      const builder = createSelectBuilder({
        data: null,
        error: new Error("accounts join failed"),
      });
      const supabaseAdmin = createSupabaseAdminMock({ premium_accounts: builder });
      const { GET } = await loadRoute("@/app/api/premium/accounts/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/accounts"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("accounts join failed");
    });

    it("returns unauthorized when account middleware blocks the request", async () => {
      const supabaseAdmin = createSupabaseAdminMock({});
      const { GET } = await loadRoute("@/app/api/premium/accounts/route", {
        supabaseAdmin,
        unauthorized: true,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/accounts"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

  });

  describe("GET/POST /api/premium/services", () => {
    it("returns premium services with package counts", async () => {
      const builder = createSelectBuilder({
        data: [{ id: "00000000-0000-4000-8000-000000000085", name: "Netflix", packages: [{ count: 2 }] }],
        error: null,
      });
      const packageBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000086",
              service_type_id: "00000000-0000-4000-8000-000000000085",
            },
            {
              id: "00000000-0000-4000-8000-000000000087",
              service_type_id: "00000000-0000-4000-8000-000000000085",
            },
          ],
          error: null,
        },
        "is",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        premium_service_types: builder,
        premium_packages: packageBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/services/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/services"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].package_count).toBe(2);
      expect(body.meta.total).toBe(1);
      expect(packageBuilder.select).toHaveBeenCalledWith("id, service_type_id");
      expect(packageBuilder.eq).toHaveBeenCalledWith("account_id", TEST_ACCOUNT_ID);
      expect(packageBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("rejects invalid service payloads", async () => {
      const builder = createInsertBuilder({ data: null, error: null });
      const supabaseAdmin = createSupabaseAdminMock({
        premium_service_types: builder,
      });
      const { POST } = await loadRoute("@/app/api/premium/services/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/services", {
          method: "POST",
          body: { name: "", slug: "Invalid Slug" },
        }),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(builder.insert).not.toHaveBeenCalled();
    });

    it("returns conflict errors for duplicate service slugs", async () => {
      const builder = createInsertBuilder({
        data: null,
        error: { message: "duplicate key value", code: "23505" },
      });
      const supabaseAdmin = createSupabaseAdminMock({
        premium_service_types: builder,
      });
      const { POST } = await loadRoute("@/app/api/premium/services/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/services", {
          method: "POST",
          body: { name: "Netflix", slug: "netflix" },
        }),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.code).toBe("CONFLICT");
    });

    it("flattens premium service query failures", async () => {
      const builder = createSelectBuilder({
        data: null,
        error: new Error("service query failed"),
      });
      const supabaseAdmin = createSupabaseAdminMock({
        premium_service_types: builder,
      });
      const { GET } = await loadRoute("@/app/api/premium/services/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/services"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("service query failed");
    });

    it("returns unauthorized for blocked premium service requests", async () => {
      const supabaseAdmin = createSupabaseAdminMock({});
      const { GET } = await loadRoute("@/app/api/premium/services/route", {
        supabaseAdmin,
        unauthorized: true,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/services"),
        { params: {} } as any,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/premium/subscriptions", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-10T00:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("hydrates subscriptions from base rows and lookup tables", async () => {
      const builder = createSelectBuilder({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000017",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "00000000-0000-4000-8000-000000000005",
            order_id: "00000000-0000-4000-8000-000000000099",
            premium_account_id: "00000000-0000-4000-8000-000000000016",
            premium_account_user_id: "00000000-0000-4000-8000-000000000088",
            service_type_id: VALID_SERVICE_ID,
            package_id: VALID_PACKAGE_ID,
            purchase_date: "2026-04-01T00:00:00.000Z",
            billing_cycle: "1year",
            cycle_months: 12,
            start_date: "2026-04-01T00:00:00.000Z",
            expiry_date: "2027-04-01T00:00:00.000Z",
            days_remaining: 180,
            status: "active",
            renewal_status: "none",
            original_price: 100,
            final_price: 100,
            discount: 0,
            notes: null,
            refund_amount: null,
            renewal_asked_at: null,
            renewal_confirmed_at: null,
            renewal_denied_at: null,
            renewal_denied_reason: null,
            deleted_at: null,
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      });
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000005", full_name: "Alice" }],
          error: null,
        },
        "in",
      );
      const accountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000016",
              primary_email: "owner@example.com",
              service_type_id: VALID_SERVICE_ID,
            },
          ],
          error: null,
        },
        "in",
      );
      const usersBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000088", user_email: "owner-user@example.com", status: "active" }],
          error: null,
        },
        "in",
      );
      const packagesBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_PACKAGE_ID, name: "Premium", default_price: 80, renewal_price_factor: 1.05 }],
          error: null,
        },
        "in",
      );
      const ordersBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000099",
              order_code: "DMH_A1B2C3",
              contact_snapshot: "Zalo: 0909",
              product_name_snapshot: "Netflix Premium",
              sales_note: "CTV: Team A",
              status: "active",
              sales_channel_id: "00000000-0000-4000-8000-0000000000aa",
            },
          ],
          error: null,
        },
        "in",
      );
      const salesChannelsBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-0000000000aa", name: "CTV Team A" }],
          error: null,
        },
        "in",
      );
      const serviceBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_SERVICE_ID, name: "Netflix" }],
          error: null,
        },
        "in",
      );
      const renewalsBuilder = createSelectBuilder(
        {
          data: [],
          error: null,
        },
        "order",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: builder,
        customers: customersBuilder,
        premium_accounts: accountsBuilder,
        premium_packages: packagesBuilder,
        premium_account_users: usersBuilder,
        orders: ordersBuilder,
        sales_channels: salesChannelsBuilder,
        premium_service_types: serviceBuilder,
        subscription_renewals: renewalsBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/subscriptions/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/subscriptions"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].customer_name).toBe("Alice");
      expect(body.data[0].account_email).toBe("owner@example.com");
      expect(body.data[0].service_name).toBe("Netflix");
      expect(body.data[0].premium_account_users.user_email).toBe("owner-user@example.com");
      expect(body.data[0].package_name).toBe("Premium");
      expect(body.data[0].order_code).toBe("DMH_A1B2C3");
      expect(body.data[0].sales_channel_name).toBe("CTV Team A");
      expect(body.data[0].package_default_price).toBe(80);
      expect(body.data[0].renewal_price_factor).toBe(1.05);
      expect(body.meta.total).toBe(1);
      expect(body.meta.summary.eligibleCount).toBe(1);
      expect(body.meta.filters.services[0].label).toBe("Netflix");
      expect(builder.select).toHaveBeenCalledWith("*");
      expect(customersBuilder.select).toHaveBeenCalledWith("id, full_name");
      expect(accountsBuilder.select).toHaveBeenCalledWith(
        "id, primary_email, service_type_id",
      );
      expect(packagesBuilder.select).toHaveBeenCalledWith(
        "id, name, default_price, renewal_price_factor",
      );
      expect(usersBuilder.select).toHaveBeenCalledWith("id, user_email, status");
      expect(ordersBuilder.select).toHaveBeenCalledWith(
        "id, order_code, contact_snapshot, product_name_snapshot, sales_note, status, sales_channel_id",
      );
      expect(salesChannelsBuilder.select).toHaveBeenCalledWith("id, name");
      expect(serviceBuilder.select).toHaveBeenCalledWith("id, name");
    });

    it("counts expired subscriptions as eligible for renewal handling", async () => {
      const builder = createSelectBuilder({
        data: [
          {
            id: "sub-active",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cus-active",
            order_id: "ord-active",
            premium_account_id: "acc-active",
            premium_account_user_id: null,
            service_type_id: VALID_SERVICE_ID,
            package_id: "pkg-active",
            purchase_date: "2026-04-01T00:00:00.000Z",
            billing_cycle: "1month",
            cycle_months: 1,
            start_date: "2026-04-01T00:00:00.000Z",
            expiry_date: "2026-08-01T00:00:00.000Z",
            days_remaining: 22,
            status: "active",
            renewal_status: "none",
            original_price: 100,
            final_price: 100,
            discount: 0,
            notes: null,
            refund_amount: null,
            renewal_asked_at: null,
            renewal_confirmed_at: null,
            renewal_denied_at: null,
            renewal_denied_reason: null,
            deleted_at: null,
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
          {
            id: "sub-expired",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cus-expired",
            order_id: "ord-expired",
            premium_account_id: "acc-expired",
            premium_account_user_id: null,
            service_type_id: VALID_SERVICE_ID,
            package_id: "pkg-expired",
            purchase_date: "2026-03-01T00:00:00.000Z",
            billing_cycle: "1month",
            cycle_months: 1,
            start_date: "2026-03-01T00:00:00.000Z",
            expiry_date: "2026-07-01T00:00:00.000Z",
            days_remaining: -9,
            status: "expired",
            renewal_status: "none",
            original_price: 100,
            final_price: 100,
            discount: 0,
            notes: null,
            refund_amount: null,
            renewal_asked_at: null,
            renewal_confirmed_at: null,
            renewal_denied_at: null,
            renewal_denied_reason: null,
            deleted_at: null,
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      });
      const customersBuilder = createSelectBuilder(
        {
          data: [
            { id: "cus-active", full_name: "Alice" },
            { id: "cus-expired", full_name: "Bob" },
          ],
          error: null,
        },
        "in",
      );
      const accountsBuilder = createSelectBuilder(
        {
          data: [
            { id: "acc-active", primary_email: "alice@example.com", service_type_id: VALID_SERVICE_ID },
            { id: "acc-expired", primary_email: "bob@example.com", service_type_id: VALID_SERVICE_ID },
          ],
          error: null,
        },
        "in",
      );
      const packagesBuilder = createSelectBuilder(
        {
          data: [
            { id: "pkg-active", name: "Package A", default_price: 100, renewal_price_factor: 1 },
            { id: "pkg-expired", name: "Package B", default_price: 100, renewal_price_factor: 1 },
          ],
          error: null,
        },
        "in",
      );
      const ordersBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "ord-active",
              order_code: "ORDER-A",
              contact_snapshot: null,
              product_name_snapshot: "Netflix",
              sales_note: null,
              status: "active",
              sales_channel_id: null,
            },
            {
              id: "ord-expired",
              order_code: "ORDER-B",
              contact_snapshot: null,
              product_name_snapshot: "Netflix",
              sales_note: null,
              status: "active",
              sales_channel_id: null,
            },
          ],
          error: null,
        },
        "in",
      );
      const serviceBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_SERVICE_ID, name: "Netflix" }],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: builder,
        customers: customersBuilder,
        premium_accounts: accountsBuilder,
        premium_packages: packagesBuilder,
        premium_account_users: createSelectBuilder({ data: [], error: null }, "in"),
        orders: ordersBuilder,
        sales_channels: createSelectBuilder({ data: [], error: null }, "in"),
        premium_service_types: serviceBuilder,
        subscription_renewals: createSelectBuilder({ data: [], error: null }, "order"),
      });
      const { GET } = await loadRoute("@/app/api/premium/subscriptions/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/subscriptions"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.meta.summary.total).toBe(2);
      expect(body.meta.summary.eligibleCount).toBe(2);
      expect(body.meta.summary.blockedCount).toBe(0);
    });

    it("filters subscriptions by package, sales channel, expiry month and search", async () => {
      const builder = createSelectBuilder({
        data: [
          {
            id: "sub-1",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cus-1",
            order_id: "ord-1",
            premium_account_id: "acc-1",
            premium_account_user_id: "user-1",
            service_type_id: VALID_SERVICE_ID,
            package_id: "pkg-a",
            purchase_date: "2026-04-01T00:00:00.000Z",
            billing_cycle: "1year",
            cycle_months: 12,
            start_date: "2026-04-01T00:00:00.000Z",
            expiry_date: "2026-07-15T00:00:00.000Z",
            days_remaining: 5,
            status: "active",
            renewal_status: "none",
            original_price: 100,
            final_price: 100,
            discount: 0,
            notes: "ưu tiên team A",
            refund_amount: null,
            renewal_asked_at: null,
            renewal_confirmed_at: null,
            renewal_denied_at: null,
            renewal_denied_reason: null,
            deleted_at: null,
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
          {
            id: "sub-2",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cus-2",
            order_id: "ord-2",
            premium_account_id: "acc-2",
            premium_account_user_id: null,
            service_type_id: VALID_SERVICE_ID,
            package_id: "pkg-b",
            purchase_date: "2026-03-01T00:00:00.000Z",
            billing_cycle: "1month",
            cycle_months: 1,
            start_date: "2026-03-01T00:00:00.000Z",
            expiry_date: "2026-08-15T00:00:00.000Z",
            days_remaining: 35,
            status: "active",
            renewal_status: "pending",
            original_price: 80,
            final_price: 80,
            discount: 0,
            notes: null,
            refund_amount: null,
            renewal_asked_at: null,
            renewal_confirmed_at: null,
            renewal_denied_at: null,
            renewal_denied_reason: null,
            deleted_at: null,
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      });
      const customersBuilder = createSelectBuilder(
        {
          data: [
            { id: "cus-1", full_name: "Alice A" },
            { id: "cus-2", full_name: "Bob B" },
          ],
          error: null,
        },
        "in",
      );
      const accountsBuilder = createSelectBuilder(
        {
          data: [
            { id: "acc-1", primary_email: "alice@example.com", service_type_id: VALID_SERVICE_ID },
            { id: "acc-2", primary_email: "bob@example.com", service_type_id: VALID_SERVICE_ID },
          ],
          error: null,
        },
        "in",
      );
      const usersBuilder = createSelectBuilder(
        {
          data: [{ id: "user-1", user_email: "member-a@example.com", status: "active" }],
          error: null,
        },
        "in",
      );
      const packagesBuilder = createSelectBuilder(
        {
          data: [
            { id: "pkg-a", name: "Family A", default_price: 80, renewal_price_factor: 1 },
            { id: "pkg-b", name: "Family B", default_price: 70, renewal_price_factor: 1 },
          ],
          error: null,
        },
        "in",
      );
      const ordersBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "ord-1",
              order_code: "ORDER-A",
              contact_snapshot: "Zalo A",
              product_name_snapshot: "Netflix Family",
              sales_note: "CTV: Team A",
              status: "active",
              sales_channel_id: "channel-a",
            },
            {
              id: "ord-2",
              order_code: "ORDER-B",
              contact_snapshot: "Zalo B",
              product_name_snapshot: "Spotify",
              sales_note: "CTV: Team B",
              status: "active",
              sales_channel_id: "channel-b",
            },
          ],
          error: null,
        },
        "in",
      );
      const salesChannelsBuilder = createSelectBuilder(
        {
          data: [
            { id: "channel-a", name: "CTV Team A" },
            { id: "channel-b", name: "CTV Team B" },
          ],
          error: null,
        },
        "in",
      );
      const serviceBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_SERVICE_ID, name: "Netflix" }],
          error: null,
        },
        "in",
      );
      const renewalsBuilder = createSelectBuilder(
        {
          data: [],
          error: null,
        },
        "order",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: builder,
        customers: customersBuilder,
        premium_accounts: accountsBuilder,
        premium_packages: packagesBuilder,
        premium_account_users: usersBuilder,
        orders: ordersBuilder,
        sales_channels: salesChannelsBuilder,
        premium_service_types: serviceBuilder,
        subscription_renewals: renewalsBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/subscriptions/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest(
          "http://localhost/api/premium/subscriptions?package_id=pkg-a&sales_channel_id=channel-a&expiry_month=2026-07&due_state=expiring&renewal_state=eligible&subscription_status=active&search=order-a",
        ),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("sub-1");
      expect(body.meta.summary.total).toBe(1);
      expect(body.meta.overallSummary.total).toBe(2);
      expect(body.meta.filters.packages).toHaveLength(2);
      expect(body.meta.filters.salesChannels).toHaveLength(2);
      expect(body.meta.applied.packageId).toBe("pkg-a");
      expect(body.meta.applied.salesChannelId).toBe("channel-a");
      expect(body.meta.applied.expiryMonth).toBe("2026-07");
    });

    it("honors explicit page_size below the old hard minimum", async () => {
      const subscriptions = Array.from({ length: 8 }, (_, index) => ({
        id: `sub-${index + 1}`,
        account_id: TEST_ACCOUNT_ID,
        customer_id: `cus-${index + 1}`,
        order_id: `ord-${index + 1}`,
        premium_account_id: `acc-${index + 1}`,
        premium_account_user_id: null,
        service_type_id: VALID_SERVICE_ID,
        package_id: `pkg-${index + 1}`,
        purchase_date: "2026-04-01T00:00:00.000Z",
        billing_cycle: "1month",
        cycle_months: 1,
        start_date: "2026-04-01T00:00:00.000Z",
        expiry_date: `2026-07-${String(index + 11).padStart(2, "0")}T00:00:00.000Z`,
        days_remaining: 10 - index,
        status: "active",
        renewal_status: "none",
        original_price: 100,
        final_price: 100,
        discount: 0,
        notes: null,
        refund_amount: null,
        renewal_asked_at: null,
        renewal_confirmed_at: null,
        renewal_denied_at: null,
        renewal_denied_reason: null,
        deleted_at: null,
        created_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-10T00:00:00.000Z",
      }));
      const customers = subscriptions.map((item, index) => ({
        id: `cus-${index + 1}`,
        full_name: `Customer ${index + 1}`,
      }));
      const accounts = subscriptions.map((item, index) => ({
        id: `acc-${index + 1}`,
        primary_email: `owner${index + 1}@example.com`,
        service_type_id: VALID_SERVICE_ID,
      }));
      const packages = subscriptions.map((item, index) => ({
        id: `pkg-${index + 1}`,
        name: `Package ${index + 1}`,
        default_price: 100,
        renewal_price_factor: 1,
      }));
      const orders = subscriptions.map((item, index) => ({
        id: `ord-${index + 1}`,
        order_code: `ORDER-${index + 1}`,
        contact_snapshot: `Zalo ${index + 1}`,
        product_name_snapshot: "Netflix Family",
        sales_note: null,
        status: "active",
        sales_channel_id: null,
      }));

      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: createSelectBuilder({ data: subscriptions, error: null }),
        customers: createSelectBuilder({ data: customers, error: null }, "in"),
        premium_accounts: createSelectBuilder({ data: accounts, error: null }, "in"),
        premium_packages: createSelectBuilder({ data: packages, error: null }, "in"),
        premium_account_users: createSelectBuilder({ data: [], error: null }, "in"),
        orders: createSelectBuilder({ data: orders, error: null }, "in"),
        sales_channels: createSelectBuilder({ data: [], error: null }, "in"),
        premium_service_types: createSelectBuilder({ data: [{ id: VALID_SERVICE_ID, name: "Netflix" }], error: null }, "in"),
        subscription_renewals: createSelectBuilder({ data: [], error: null }, "order"),
      });
      const { GET } = await loadRoute("@/app/api/premium/subscriptions/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/subscriptions?page_size=5&page=1"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(5);
      expect(body.meta.pagination.pageSize).toBe(5);
      expect(body.meta.pagination.totalItems).toBe(8);
      expect(body.meta.pagination.totalPages).toBe(2);
    });

    it("filters subscriptions by exact non-active status values", async () => {
      const builder = createSelectBuilder({
        data: [
          {
            id: "sub-active",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cus-1",
            order_id: "ord-1",
            premium_account_id: "acc-1",
            premium_account_user_id: null,
            service_type_id: VALID_SERVICE_ID,
            package_id: "pkg-1",
            purchase_date: "2026-04-01T00:00:00.000Z",
            billing_cycle: "1month",
            cycle_months: 1,
            start_date: "2026-04-01T00:00:00.000Z",
            expiry_date: "2026-07-20T00:00:00.000Z",
            days_remaining: 10,
            status: "active",
            renewal_status: "none",
            original_price: 100,
            final_price: 100,
            discount: 0,
            notes: null,
            refund_amount: null,
            renewal_asked_at: null,
            renewal_confirmed_at: null,
            renewal_denied_at: null,
            renewal_denied_reason: null,
            deleted_at: null,
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
          {
            id: "sub-expired",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cus-2",
            order_id: "ord-2",
            premium_account_id: "acc-2",
            premium_account_user_id: null,
            service_type_id: VALID_SERVICE_ID,
            package_id: "pkg-2",
            purchase_date: "2026-04-01T00:00:00.000Z",
            billing_cycle: "1month",
            cycle_months: 1,
            start_date: "2026-04-01T00:00:00.000Z",
            expiry_date: "2026-07-01T00:00:00.000Z",
            days_remaining: -9,
            status: "expired",
            renewal_status: "none",
            original_price: 100,
            final_price: 100,
            discount: 0,
            notes: null,
            refund_amount: null,
            renewal_asked_at: null,
            renewal_confirmed_at: null,
            renewal_denied_at: null,
            renewal_denied_reason: null,
            deleted_at: null,
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      });
      const customersBuilder = createSelectBuilder(
        {
          data: [
            { id: "cus-1", full_name: "Alice" },
            { id: "cus-2", full_name: "Bob" },
          ],
          error: null,
        },
        "in",
      );
      const accountsBuilder = createSelectBuilder(
        {
          data: [
            { id: "acc-1", primary_email: "alice@example.com", service_type_id: VALID_SERVICE_ID },
            { id: "acc-2", primary_email: "bob@example.com", service_type_id: VALID_SERVICE_ID },
          ],
          error: null,
        },
        "in",
      );
      const packagesBuilder = createSelectBuilder(
        {
          data: [
            { id: "pkg-1", name: "Package A", default_price: 100, renewal_price_factor: 1 },
            { id: "pkg-2", name: "Package B", default_price: 100, renewal_price_factor: 1 },
          ],
          error: null,
        },
        "in",
      );
      const ordersBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "ord-1",
              order_code: "ORDER-1",
              contact_snapshot: null,
              product_name_snapshot: "Netflix",
              sales_note: null,
              status: "active",
              sales_channel_id: null,
            },
            {
              id: "ord-2",
              order_code: "ORDER-2",
              contact_snapshot: null,
              product_name_snapshot: "Netflix",
              sales_note: null,
              status: "active",
              sales_channel_id: null,
            },
          ],
          error: null,
        },
        "in",
      );
      const serviceBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_SERVICE_ID, name: "Netflix" }],
          error: null,
        },
        "in",
      );
      const renewalsBuilder = createSelectBuilder({ data: [], error: null }, "order");
      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: builder,
        customers: customersBuilder,
        premium_accounts: accountsBuilder,
        premium_packages: packagesBuilder,
        premium_account_users: createSelectBuilder({ data: [], error: null }, "in"),
        orders: ordersBuilder,
        sales_channels: createSelectBuilder({ data: [], error: null }, "in"),
        premium_service_types: serviceBuilder,
        subscription_renewals: renewalsBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/subscriptions/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/subscriptions?subscription_status=expired"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("sub-expired");
      expect(body.meta.summary.total).toBe(1);
    });

    it("returns unauthorized for blocked subscription requests", async () => {
      const supabaseAdmin = createSupabaseAdminMock({});
      const { GET } = await loadRoute("@/app/api/premium/subscriptions/route", {
        supabaseAdmin,
        unauthorized: true,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/subscriptions"),
        { params: {} } as any,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/premium/subscriptions/[id]/refund", () => {
    it("hydrates refund responses from base rows and lookup tables", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const expiryDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const originalPrice = 150000;
      const expectedRefund = calculateProratedRefund(
        originalPrice,
        startDate,
        expiryDate,
      );
      const expectedDaysRemaining = getDaysRemaining(expiryDate);

      const subscriptionBuilder = createSelectBuilder({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000089",
            account_id: TEST_ACCOUNT_ID,
            original_price: originalPrice,
            start_date: startDate,
            expiry_date: expiryDate,
            renewal_status: "denied",
            renewal_denied_reason: "Customer requested refund",
            premium_account_id: "00000000-0000-4000-8000-00000000008a",
            package_id: "00000000-0000-4000-8000-00000000008b",
            service_type_id: VALID_SERVICE_ID,
          },
        ],
        error: null,
      });
      const updateBuilder = createUpdateBuilder({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000089",
            account_id: TEST_ACCOUNT_ID,
            original_price: originalPrice,
            start_date: startDate,
            expiry_date: expiryDate,
            renewal_status: "denied",
            renewal_denied_reason: "Customer requested refund",
            refund_amount: expectedRefund,
            premium_account_id: "00000000-0000-4000-8000-00000000008a",
            package_id: "00000000-0000-4000-8000-00000000008b",
            service_type_id: VALID_SERVICE_ID,
          },
        ],
        error: null,
      });
      const accountBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000008a",
              primary_email: "refund@example.com",
              service_type_id: VALID_SERVICE_ID,
            },
          ],
          error: null,
        },
        "in",
      );
      const packageBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000008b",
              name: "Premium",
              slug: "premium",
            },
          ],
          error: null,
        },
        "in",
      );
      const serviceBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_SERVICE_ID, name: "Netflix" }],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: {
          select: subscriptionBuilder.select,
          eq: subscriptionBuilder.eq,
          is: subscriptionBuilder.is,
          update: updateBuilder.update,
        },
        premium_accounts: accountBuilder,
        premium_packages: packageBuilder,
        premium_service_types: serviceBuilder,
      });
      const { POST } = await loadRoute(
        "@/app/api/premium/subscriptions/[id]/refund/route",
        {
          supabaseAdmin,
        },
      );

      const response = await POST(
        createTestRequest(
          "http://localhost/api/premium/subscriptions/00000000-0000-4000-8000-000000000089/refund",
          {
            method: "POST",
            body: {
              method: "prorated",
              custom_amount: 1,
            },
          },
        ),
        { params: { id: "00000000-0000-4000-8000-000000000089" } } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.subscription.refund_amount).toBe(expectedRefund);
      expect(body.data.subscription.premium_accounts.primary_email).toBe(
        "refund@example.com",
      );
      expect(body.data.subscription.premium_accounts.service.name).toBe("Netflix");
      expect(body.data.subscription.premium_packages.name).toBe("Premium");
      expect(body.data.subscription.premium_service_types.name).toBe("Netflix");
      expect(body.data.refund_calculation.method).toBe("prorated");
      expect(body.data.refund_calculation.refund_amount).toBe(expectedRefund);
      expect(body.data.refund_calculation.days_remaining).toBe(expectedDaysRemaining);
      expect(subscriptionBuilder.select).toHaveBeenCalledWith(
        "id, original_price, start_date, expiry_date, renewal_status, renewal_denied_reason, premium_account_id, package_id, service_type_id",
      );
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          refund_amount: expectedRefund,
        }),
      );
      expect(accountBuilder.select).toHaveBeenCalledWith(
        "id, primary_email, service_type_id",
      );
      expect(packageBuilder.select).toHaveBeenCalledWith("id, name");
      expect(serviceBuilder.select).toHaveBeenCalledWith("id, name");
    });
  });

  describe("GET /api/premium/renewals", () => {
    it("hydrates renewals from base rows and lookup tables", async () => {
      const renewalsBuilder = createSelectBuilder({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000075",
            account_id: TEST_ACCOUNT_ID,
            original_subscription_id: "00000000-0000-4000-8000-000000000017",
            status: "pending",
            renewal_requested_date: "2026-04-10T10:00:00.000Z",
          },
        ],
        error: null,
      });
      const subscriptionBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000017",
              customer_id: "00000000-0000-4000-8000-000000000005",
              premium_account_id: "00000000-0000-4000-8000-000000000016",
              package_id: VALID_PACKAGE_ID,
              billing_cycle: "3months",
              cycle_months: 3,
              expiry_date: "2026-07-10T00:00:00.000Z",
              final_price: 150000,
              original_price: 150000,
            },
          ],
          error: null,
        },
        "in",
      );
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000005", full_name: "Bob" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000016",
              primary_email: "renew@example.com",
              service_type_id: "00000000-0000-4000-8000-000000000085",
            },
          ],
          error: null,
        },
        "in",
      );
      const serviceTypesBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000085", name: "Disney+" }],
          error: null,
        },
        "in",
      );
      const packagesBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_PACKAGE_ID, default_price: 90000, renewal_price_factor: 1.1 }],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        subscription_renewals: renewalsBuilder,
        customer_premium_subscriptions: subscriptionBuilder,
        customers: customersBuilder,
        premium_accounts: premiumAccountsBuilder,
        premium_packages: packagesBuilder,
        premium_service_types: serviceTypesBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/renewals/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/renewals?status=pending"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].customer_name).toBe("Bob");
      expect(body.data[0].account_email).toBe("renew@example.com");
      expect(body.data[0].service_name).toBe("Disney+");
      expect(body.data[0].current_billing_cycle).toBe("3months");
      expect(body.data[0].current_cycle_months).toBe(3);
      expect(body.data[0].package_default_price).toBe(90000);
      expect(body.meta.status).toBe("pending");
      expect(body.data[0].original_subscription.customer.full_name).toBe("Bob");
      expect(body.data[0].original_subscription.premium_account.primary_email).toBe(
        "renew@example.com",
      );
      expect(body.data[0].original_subscription.premium_account.service.name).toBe(
        "Disney+",
      );
      expect(renewalsBuilder.select).toHaveBeenCalledWith("*");
      expect(subscriptionBuilder.select).toHaveBeenCalledWith(
        "id, customer_id, premium_account_id, package_id, billing_cycle, cycle_months, expiry_date, final_price, original_price",
      );
      expect(customersBuilder.select).toHaveBeenCalledWith("id, full_name");
      expect(premiumAccountsBuilder.select).toHaveBeenCalledWith(
        "id, primary_email, service_type_id",
      );
      expect(packagesBuilder.select).toHaveBeenCalledWith(
        "id, default_price, renewal_price_factor",
      );
      expect(serviceTypesBuilder.select).toHaveBeenCalledWith("id, name");
    }, PREMIUM_ROUTE_TIMEOUT_MS);

    it("hydrates denied renewals from base rows and lookup tables", async () => {
      const renewalsBuilder = createSelectBuilder({
        data: [
          {
            id: "00000000-0000-4000-8000-00000000008c",
            account_id: TEST_ACCOUNT_ID,
            original_subscription_id: "00000000-0000-4000-8000-00000000008d",
            status: "denied",
            renewal_requested_date: "2026-04-09T10:00:00.000Z",
          },
        ],
        error: null,
      });
      const subscriptionBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000008d",
              customer_id: "00000000-0000-4000-8000-000000000006",
              premium_account_id: "00000000-0000-4000-8000-000000000084",
              package_id: VALID_PACKAGE_ID,
              billing_cycle: "1year",
              cycle_months: 12,
              expiry_date: "2027-04-09T00:00:00.000Z",
              final_price: 399000,
              original_price: 399000,
            },
          ],
          error: null,
        },
        "in",
      );
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000006", full_name: "Deny User" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000084",
              primary_email: "deny@example.com",
              service_type_id: "00000000-0000-4000-8000-00000000008e",
            },
          ],
          error: null,
        },
        "in",
      );
      const serviceTypesBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-00000000008e", name: "Spotify" }],
          error: null,
        },
        "in",
      );
      const packagesBuilder = createSelectBuilder(
        {
          data: [{ id: VALID_PACKAGE_ID, default_price: 250000, renewal_price_factor: 1 }],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        subscription_renewals: renewalsBuilder,
        customer_premium_subscriptions: subscriptionBuilder,
        customers: customersBuilder,
        premium_accounts: premiumAccountsBuilder,
        premium_packages: packagesBuilder,
        premium_service_types: serviceTypesBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/renewals/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/renewals?status=denied"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].customer_name).toBe("Deny User");
      expect(body.data[0].account_email).toBe("deny@example.com");
      expect(body.data[0].service_name).toBe("Spotify");
      expect(body.meta.status).toBe("denied");
      expect(renewalsBuilder.select).toHaveBeenCalledWith("*");
    }, PREMIUM_ROUTE_TIMEOUT_MS);

    it("flattens renewal relation/query failures", async () => {
      const builder = createSelectBuilder({
        data: null,
        error: new Error("renewal query failed"),
      });
      const supabaseAdmin = createSupabaseAdminMock({
        subscription_renewals: builder,
      });
      const { GET } = await loadRoute("@/app/api/premium/renewals/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/renewals?status=completed"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("renewal query failed");
    });

    it("returns unauthorized for blocked renewal requests", async () => {
      const supabaseAdmin = createSupabaseAdminMock({});
      const { GET } = await loadRoute("@/app/api/premium/renewals/route", {
        supabaseAdmin,
        unauthorized: true,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/renewals?status=pending"),
        { params: {} } as any,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/premium/migrations", () => {
    it("hydrates migrations from base rows and account lookups", async () => {
      const migrationsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000008f",
              account_id: TEST_ACCOUNT_ID,
              subscription_id: "00000000-0000-4000-8000-000000000017",
              customer_id: "00000000-0000-4000-8000-000000000005",
              source_account_id: "00000000-0000-4000-8000-00000000003a",
              target_account_id: "00000000-0000-4000-8000-000000000090",
              source_account_email: null,
              target_account_email: null,
              reason: "Move to backup account",
              status: "pending",
              started_at: "2026-04-10T09:00:00.000Z",
              completed_at: null,
              details: null,
              error_log: null,
              notes: null,
              created_at: "2026-04-10T09:00:00.000Z",
              updated_at: "2026-04-10T09:00:00.000Z",
            },
          ],
          error: null,
        },
        "range",
      );
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000005", full_name: "Carol" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000003a",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "00000000-0000-4000-8000-000000000090",
              primary_email: "target@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 10,
              used_slots: 4,
              status: "active",
            },
          ],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        account_migrations: migrationsBuilder,
        customers: customersBuilder,
        premium_accounts: premiumAccountsBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/migrations/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/migrations?status=completed"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].customer_name).toBe("Carol");
      expect(body.data[0].source_account_email).toBe("source@example.com");
      expect(body.data[0].target_account_email).toBe("target@example.com");
      expect(body.data[0].source_account.primary_email).toBe("source@example.com");
      expect(body.data[0].target_account.primary_email).toBe("target@example.com");
      expect(body.meta.status).toBe("completed");
      expect(migrationsBuilder.select).toHaveBeenCalledWith("*", {
        count: "exact",
      });
      expect(customersBuilder.select).toHaveBeenCalledWith("id, full_name");
      expect(customersBuilder.eq).toHaveBeenCalledWith("account_id", TEST_ACCOUNT_ID);
      expect(premiumAccountsBuilder.select).toHaveBeenCalledWith(
        "id, primary_email, service_type_id, total_slots, used_slots, status",
      );
      expect(premiumAccountsBuilder.select).toHaveBeenCalledTimes(2);
    });

    it("still reads migrations from supabase in development unless local fallback is forced", async () => {
      vi.stubEnv("NODE_ENV", "development");

      const migrationsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-0000000000f1",
              account_id: TEST_ACCOUNT_ID,
              subscription_id: "sub-dev-1",
              customer_id: "customer-dev-1",
              source_account_id: "source-dev-1",
              target_account_id: "target-dev-1",
              source_account_email: null,
              target_account_email: null,
              reason: "DB migration row",
              status: "pending",
              initiated_by: null,
              started_at: "2026-04-10T09:00:00.000Z",
              completed_at: null,
              details: null,
              error_log: null,
              notes: null,
              created_at: "2026-04-10T09:00:00.000Z",
              updated_at: "2026-04-10T09:00:00.000Z",
            },
          ],
          error: null,
          count: 1,
        },
        "range",
      );
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "customer-dev-1", full_name: "DB Customer" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "source-dev-1",
              primary_email: "source-dev@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 2,
              status: "active",
            },
            {
              id: "target-dev-1",
              primary_email: "target-dev@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 1,
              status: "active",
            },
          ],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        account_migrations: migrationsBuilder,
        customers: customersBuilder,
        premium_accounts: premiumAccountsBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/migrations/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/migrations?status=pending"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].customer_name).toBe("DB Customer");
      expect(migrationsBuilder.select).toHaveBeenCalled();
    });

    it("returns hydrated rows for other migration statuses", async () => {
      const migrationsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000091",
              account_id: TEST_ACCOUNT_ID,
              subscription_id: "00000000-0000-4000-8000-00000000008d",
              customer_id: "00000000-0000-4000-8000-000000000005",
              source_account_id: "00000000-0000-4000-8000-00000000003a",
              target_account_id: "00000000-0000-4000-8000-000000000090",
              source_account_email: null,
              target_account_email: null,
              reason: "Need to move",
              status: "completed",
              started_at: "2026-04-10T09:00:00.000Z",
              completed_at: "2026-04-10T10:00:00.000Z",
              details: null,
              error_log: null,
              notes: null,
              created_at: "2026-04-10T09:00:00.000Z",
              updated_at: "2026-04-10T10:00:00.000Z",
            },
          ],
          error: null,
        },
        "range",
      );
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000005", full_name: "Fallback Customer" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000003a",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "00000000-0000-4000-8000-000000000090",
              primary_email: "target@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 10,
              used_slots: 4,
              status: "active",
            },
          ],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        account_migrations: migrationsBuilder,
        customers: customersBuilder,
        premium_accounts: premiumAccountsBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/migrations/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/migrations?status=completed"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.meta.status).toBe("completed");
      expect(body.data).toHaveLength(1);
      expect(body.data[0].customer_name).toBe("Fallback Customer");
      expect(body.data[0].source_account_email).toBe("source@example.com");
      expect(body.data[0].target_account_email).toBe("target@example.com");
      expect(migrationsBuilder.select).toHaveBeenCalledWith("*", {
        count: "exact",
      });
      expect(premiumAccountsBuilder.select).toHaveBeenCalledTimes(2);
    });

    it("flattens migration relation/query failures", async () => {
      const builder = createSelectBuilder(
        {
          data: null,
          error: new Error("migration query failed"),
        },
        "range",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        account_migrations: builder,
      });
      const { GET } = await loadRoute("@/app/api/premium/migrations/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/migrations?status=completed"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe("migration query failed");
    });

    it("returns unauthorized for blocked migration requests", async () => {
      const supabaseAdmin = createSupabaseAdminMock({});
      const { GET } = await loadRoute("@/app/api/premium/migrations/route", {
        supabaseAdmin,
        unauthorized: true,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/migrations?status=pending"),
        { params: {} } as any,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/premium/health-checks", () => {
    it("hydrates health checks from base rows and account lookups", async () => {
      const healthLogsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000000e",
              account_id: TEST_ACCOUNT_ID,
              premium_account_id: "00000000-0000-4000-8000-000000000016",
              service_type_id: VALID_SERVICE_ID,
              check_timestamp: "2026-04-10T08:00:00.000Z",
              check_type: "manual",
              current_status: "working",
              previous_status: "manual_check_needed",
              notes: null,
              created_at: "2026-04-10T08:00:00.000Z",
              updated_at: "2026-04-10T08:00:00.000Z",
            },
          ],
          error: null,
          count: 1,
        },
        "range",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000016",
              primary_email: "health@example.com",
              status: "active",
              connection_status: "working",
            },
          ],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        premium_account_health_logs: healthLogsBuilder,
        premium_accounts: premiumAccountsBuilder,
      });
      const { GET } = await loadRoute("@/app/api/premium/health-checks/route", {
        supabaseAdmin,
      });

      const response = await GET(
        createTestRequest("http://localhost/api/premium/health-checks?limit=12"),
        { params: {} } as any,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].premium_accounts.primary_email).toBe("health@example.com");
      expect(body.data[0].premium_accounts.connection_status).toBe("working");
      expect(body.pagination.total).toBe(1);
      expect(healthLogsBuilder.select).toHaveBeenCalledWith("*", {
        count: "exact",
      });
      expect(premiumAccountsBuilder.select).toHaveBeenCalledWith(
        "id, primary_email, status, connection_status",
      );
    });
  });

  describe("POST /api/premium/migrations", () => {
    it("creates migration requests with audit history and activity logs", async () => {
      const subscriptionBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000017",
              account_id: TEST_ACCOUNT_ID,
              customer_id: "00000000-0000-4000-8000-000000000005",
              premium_account_id: "00000000-0000-4000-8000-00000000003a",
              service_type_id: VALID_SERVICE_ID,
              package_id: VALID_PACKAGE_ID,
              billing_cycle: "1year",
              cycle_months: 12,
              start_date: "2026-04-01T00:00:00.000Z",
              expiry_date: "2027-04-01T00:00:00.000Z",
              status: "active",
              renewal_status: "none",
              notes: null,
            },
          ],
          error: null,
        },
        "single",
      );
      const accountBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000003a",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "00000000-0000-4000-8000-000000000090",
              primary_email: "target@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 10,
              used_slots: 4,
              status: "active",
            },
          ],
          error: null,
        },
        "in",
      );
      const customerBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000005", full_name: "Carol" }],
          error: null,
        },
        "in",
      );
      const migrationBuilder = createMigrationTableBuilder(
        {
          data: null,
          error: null,
        },
        {
          data: {
            id: "00000000-0000-4000-8000-00000000008f",
            account_id: TEST_ACCOUNT_ID,
            subscription_id: "00000000-0000-4000-8000-000000000017",
            customer_id: "00000000-0000-4000-8000-000000000005",
            source_account_id: "00000000-0000-4000-8000-00000000003a",
            target_account_id: "00000000-0000-4000-8000-000000000090",
            source_account_email: "source@example.com",
            target_account_email: "target@example.com",
            source_user_id: null,
            target_user_id: null,
            reason: "Move to backup account",
            initiated_by: null,
            status: "pending",
            started_at: "2026-04-10T10:00:00.000Z",
            completed_at: null,
            details: {
              subscription_id: "00000000-0000-4000-8000-000000000017",
              customer_name: "Carol",
              source_account_email: "source@example.com",
              target_account_email: "target@example.com",
            },
            error_log: null,
            notes: "Keep billing cycle intact",
            created_at: "2026-04-10T10:00:00.000Z",
            updated_at: "2026-04-10T10:00:00.000Z",
          },
          error: null,
        },
      );
      const historyInsertBuilder = createInsertBuilder({
        data: {
          id: "00000000-0000-4000-8000-000000000062",
        },
        error: null,
      });
      const activityLogBuilder = createInsertBuilder({
        data: {
          id: "00000000-0000-4000-8000-00000000000e",
        },
        error: null,
      });
      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: subscriptionBuilder,
        account_migrations: migrationBuilder,
        premium_accounts: accountBuilder,
        customers: customerBuilder,
        account_migration_history: historyInsertBuilder,
        activity_logs: activityLogBuilder,
      });
      const { POST } = await loadRoute("@/app/api/premium/migrations/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/migrations", {
          method: "POST",
          body: {
            subscription_id: "00000000-0000-4000-8000-000000000017",
            target_account_id: "00000000-0000-4000-8000-000000000090",
            reason: "Move to backup account",
            notes: "Keep billing cycle intact",
          },
        }),
        { params: {} } as any,
      );
      const body = await response.json();
      expect(response.status).toBe(201);
      expect(body.meta.status).toBe("pending");
      expect(body.data.customer_name).toBe("Carol");
      expect(body.data.source_account.primary_email).toBe("source@example.com");
      expect(body.data.target_account.primary_email).toBe("target@example.com");

      const migrationInsertRows = migrationBuilder.insert.mock.calls[0]?.[0] as
        | Array<Record<string, unknown>>
        | undefined;
      const historyInsertRows = historyInsertBuilder.insert.mock.calls[0]?.[0] as
        | Array<Record<string, unknown>>
        | undefined;
      const activityInsertRows = activityLogBuilder.insert.mock.calls[0]?.[0] as
        | Array<Record<string, unknown>>
        | undefined;

      if (!migrationInsertRows?.[0] || !historyInsertRows?.[0] || !activityInsertRows?.[0]) {
        throw new Error("Expected migration audit inserts");
      }

      expect(migrationInsertRows[0]).toMatchObject({
        account_id: TEST_ACCOUNT_ID,
        subscription_id: "00000000-0000-4000-8000-000000000017",
        customer_id: "00000000-0000-4000-8000-000000000005",
        source_account_id: "00000000-0000-4000-8000-00000000003a",
        target_account_id: "00000000-0000-4000-8000-000000000090",
        reason: "Move to backup account",
        status: "pending",
      });
      expect(historyInsertRows[0]).toMatchObject({
        migration_id: "00000000-0000-4000-8000-00000000008f",
        account_id: TEST_ACCOUNT_ID,
        step_number: 1,
        step_name: "request_created",
        step_status: "completed",
      });
      expect(activityInsertRows[0]).toMatchObject({
        account_id: TEST_ACCOUNT_ID,
        action_type: "PREMIUM_MIGRATION_REQUEST_CREATED",
        customer_id: "00000000-0000-4000-8000-000000000005",
      });
      expect((activityInsertRows[0] as { details?: Record<string, unknown> }).details).toMatchObject({
        migration_id: "00000000-0000-4000-8000-00000000008f",
        source_account_email: "source@example.com",
        target_account_email: "target@example.com",
        reason: "Move to backup account",
      });
    });

    it("rejects migration requests when the target account has no available slots", async () => {
      const subscriptionBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000017",
              account_id: TEST_ACCOUNT_ID,
              customer_id: "00000000-0000-4000-8000-000000000005",
              premium_account_id: "00000000-0000-4000-8000-00000000003a",
              service_type_id: VALID_SERVICE_ID,
              package_id: VALID_PACKAGE_ID,
              billing_cycle: "1year",
              cycle_months: 12,
              start_date: "2026-04-01T00:00:00.000Z",
              expiry_date: "2027-04-01T00:00:00.000Z",
              status: "active",
              renewal_status: "none",
              notes: null,
            },
          ],
          error: null,
        },
        "single",
      );
      const accountBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000003a",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "00000000-0000-4000-8000-000000000090",
              primary_email: "target@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 10,
              used_slots: 10,
              status: "active",
            },
          ],
          error: null,
        },
        "in",
      );
      const customerBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000005", full_name: "Carol" }],
          error: null,
        },
        "in",
      );
      const migrationBuilder = createMigrationTableBuilder(
        {
          data: null,
          error: null,
        },
        {
          data: null,
          error: null,
        },
      );
      const historyInsertBuilder = createInsertBuilder({ data: null, error: null });
      const activityLogBuilder = createInsertBuilder({ data: null, error: null });
      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: subscriptionBuilder,
        account_migrations: migrationBuilder,
        premium_accounts: accountBuilder,
        customers: customerBuilder,
        account_migration_history: historyInsertBuilder,
        activity_logs: activityLogBuilder,
      });
      const { POST } = await loadRoute("@/app/api/premium/migrations/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/migrations", {
          method: "POST",
          body: {
            subscription_id: "00000000-0000-4000-8000-000000000017",
            target_account_id: "00000000-0000-4000-8000-000000000090",
            reason: "Move to backup account",
          },
        }),
        { params: {} } as any,
      );
      const body = await response.json();
      const activityInsertRows = activityLogBuilder.insert.mock.calls[0]?.[0] as
        | Array<Record<string, unknown>>
        | undefined;

      expect(response.status).toBe(409);
      expect(body.error).toContain("no available slots");
      expect(migrationBuilder.insert).not.toHaveBeenCalled();
      expect(historyInsertBuilder.insert).not.toHaveBeenCalled();
      expect(activityLogBuilder.insert).toHaveBeenCalledTimes(1);
      if (!activityInsertRows?.[0]) {
        throw new Error("Expected failure audit insert");
      }
      expect(activityInsertRows[0]).toMatchObject({
        account_id: TEST_ACCOUNT_ID,
        action_type: "PREMIUM_MIGRATION_REQUEST_FAILED",
      });
      expect((activityInsertRows[0] as { details?: Record<string, unknown> }).details).toMatchObject({
        target_account_id: "00000000-0000-4000-8000-000000000090",
        error_code: "CONFLICT",
      });
    });

    it("rejects duplicate pending migration requests", async () => {
      const subscriptionBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000017",
              account_id: TEST_ACCOUNT_ID,
              customer_id: "00000000-0000-4000-8000-000000000005",
              premium_account_id: "00000000-0000-4000-8000-00000000003a",
              service_type_id: VALID_SERVICE_ID,
              package_id: VALID_PACKAGE_ID,
              billing_cycle: "1year",
              cycle_months: 12,
              start_date: "2026-04-01T00:00:00.000Z",
              expiry_date: "2027-04-01T00:00:00.000Z",
              status: "active",
              renewal_status: "none",
              notes: null,
            },
          ],
          error: null,
        },
        "single",
      );
      const accountBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000003a",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "00000000-0000-4000-8000-000000000090",
              primary_email: "target@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 10,
              used_slots: 4,
              status: "active",
            },
          ],
          error: null,
        },
        "in",
      );
      const customerBuilder = createSelectBuilder(
        {
          data: [{ id: "00000000-0000-4000-8000-000000000005", full_name: "Carol" }],
          error: null,
        },
        "in",
      );
      const migrationBuilder = createMigrationTableBuilder(
        {
          data: {
            id: "mig-existing",
            status: "pending",
          },
          error: null,
        },
        {
          data: null,
          error: null,
        },
      );
      const historyInsertBuilder = createInsertBuilder({ data: null, error: null });
      const activityLogBuilder = createInsertBuilder({ data: null, error: null });
      const supabaseAdmin = createSupabaseAdminMock({
        customer_premium_subscriptions: subscriptionBuilder,
        account_migrations: migrationBuilder,
        premium_accounts: accountBuilder,
        customers: customerBuilder,
        account_migration_history: historyInsertBuilder,
        activity_logs: activityLogBuilder,
      });
      const { POST } = await loadRoute("@/app/api/premium/migrations/route", {
        supabaseAdmin,
      });

      const response = await POST(
        createTestRequest("http://localhost/api/premium/migrations", {
          method: "POST",
          body: {
            subscription_id: "00000000-0000-4000-8000-000000000017",
            target_account_id: "00000000-0000-4000-8000-000000000090",
            reason: "Move to backup account",
          },
        }),
        { params: {} } as any,
      );
      const body = await response.json();
      const activityInsertRows = activityLogBuilder.insert.mock.calls[0]?.[0] as
        | Array<Record<string, unknown>>
        | undefined;

      expect(response.status).toBe(409);
      expect(body.error).toContain("already pending");
      expect(migrationBuilder.insert).not.toHaveBeenCalled();
      expect(historyInsertBuilder.insert).not.toHaveBeenCalled();
      expect(activityLogBuilder.insert).toHaveBeenCalledTimes(1);
      if (!activityInsertRows?.[0]) {
        throw new Error("Expected duplicate audit insert");
      }
      expect(activityInsertRows[0]).toMatchObject({
        account_id: TEST_ACCOUNT_ID,
        action_type: "PREMIUM_MIGRATION_REQUEST_FAILED",
      });
      expect((activityInsertRows[0] as { details?: Record<string, unknown> }).details).toMatchObject({
        target_account_id: "00000000-0000-4000-8000-000000000090",
        error_code: "CONFLICT",
      });
    });
  });

  describe("GET /api/notifications/feed", () => {
    it("falls back to health logs when premium account lookup fails", async () => {
      const renewalsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000075",
              renewal_requested_date: "2026-04-10T10:00:00.000Z",
              renewal_price: 120000,
              original_price: 150000,
              status: "pending",
            },
          ],
          error: null,
        },
        "limit",
      );
      const migrationsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000008f",
              created_at: "2026-04-10T09:00:00.000Z",
              status: "pending",
              source_account_email: "source@example.com",
              target_account_email: "target@example.com",
            },
          ],
          error: null,
        },
        "limit",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: null,
          error: new Error("premium_accounts query failed"),
        },
        "limit",
      );
      const premiumHealthLogsBuilder = createSelectBuilder(
        {
          data: [
            {
              premium_account_id: "00000000-0000-4000-8000-000000000016",
              error_message: "Login failed",
              check_timestamp: "2026-04-10T08:00:00.000Z",
              created_at: "2026-04-10T08:00:00.000Z",
              current_status: "error",
            },
          ],
          error: null,
        },
        "limit",
      );
      const upcomingExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const sourceAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000003a",
              email: "store@example.com",
              max_slots: 1,
              used_slots: 1,
              expires_at: upcomingExpiry,
              updated_at: "2026-04-10T07:00:00.000Z",
              created_at: "2026-04-09T07:00:00.000Z",
            },
          ],
          error: null,
        },
        "limit",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        subscription_renewals: renewalsBuilder,
        account_migrations: migrationsBuilder,
        premium_accounts: premiumAccountsBuilder,
        premium_account_health_logs: premiumHealthLogsBuilder,
        source_accounts: sourceAccountsBuilder,
      });
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

      const premiumHealthNotification = body.data.find(
        (item: { kind: string }) => item.kind === "premium_health",
      ) as { description: string } | undefined;

      expect(premiumHealthNotification?.description).toBe("Login failed");
    });
  });
});
