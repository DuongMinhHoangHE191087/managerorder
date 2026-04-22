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
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
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
            id: "acc-1",
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
            id: "acc-2",
          },
          error: null,
        },
        {
          data: {
            id: "acc-2",
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
      expect(body.data.id).toBe("acc-2");
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
        data: [{ id: "svc-1", name: "Netflix", packages: [{ count: 2 }] }],
        error: null,
      });
      const packageBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "pkg-1",
              service_type_id: "svc-1",
            },
            {
              id: "pkg-2",
              service_type_id: "svc-1",
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
    it("hydrates subscriptions from base rows and lookup tables", async () => {
      const builder = createSelectBuilder({
        data: [
          {
            id: "sub-1",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cust-1",
            premium_account_id: "acc-1",
            premium_account_user_id: "user-1",
            service_type_id: VALID_SERVICE_ID,
            package_id: VALID_PACKAGE_ID,
            billing_cycle: "1year",
            cycle_months: 12,
            start_date: "2026-04-01T00:00:00.000Z",
            expiry_date: "2027-04-01T00:00:00.000Z",
            status: "active",
            renewal_status: "none",
            original_price: 100,
            final_price: 100,
            notes: null,
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      });
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "cust-1", full_name: "Alice" }],
          error: null,
        },
        "in",
      );
      const accountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "acc-1",
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
          data: [{ id: "user-1", user_email: "owner-user@example.com", status: "active" }],
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
        premium_account_users: usersBuilder,
        premium_service_types: serviceBuilder,
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
      expect(body.meta.total).toBe(1);
      expect(builder.select).toHaveBeenCalledWith("*");
      expect(customersBuilder.select).toHaveBeenCalledWith("id, full_name");
      expect(accountsBuilder.select).toHaveBeenCalledWith(
        "id, primary_email, service_type_id",
      );
      expect(usersBuilder.select).toHaveBeenCalledWith("id, user_email, status");
      expect(serviceBuilder.select).toHaveBeenCalledWith("id, name");
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
            id: "sub-refund-1",
            account_id: TEST_ACCOUNT_ID,
            original_price: originalPrice,
            start_date: startDate,
            expiry_date: expiryDate,
            renewal_status: "denied",
            renewal_denied_reason: "Customer requested refund",
            premium_account_id: "acc-refund-1",
            package_id: "pkg-refund-1",
            service_type_id: VALID_SERVICE_ID,
          },
        ],
        error: null,
      });
      const updateBuilder = createUpdateBuilder({
        data: [
          {
            id: "sub-refund-1",
            account_id: TEST_ACCOUNT_ID,
            original_price: originalPrice,
            start_date: startDate,
            expiry_date: expiryDate,
            renewal_status: "denied",
            renewal_denied_reason: "Customer requested refund",
            refund_amount: expectedRefund,
            premium_account_id: "acc-refund-1",
            package_id: "pkg-refund-1",
            service_type_id: VALID_SERVICE_ID,
          },
        ],
        error: null,
      });
      const accountBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "acc-refund-1",
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
              id: "pkg-refund-1",
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
          "http://localhost/api/premium/subscriptions/sub-refund-1/refund",
          {
            method: "POST",
            body: {
              method: "prorated",
              custom_amount: 1,
            },
          },
        ),
        { params: { id: "sub-refund-1" } } as any,
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
            id: "ren-1",
            account_id: TEST_ACCOUNT_ID,
            original_subscription_id: "sub-1",
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
              id: "sub-1",
              customer_id: "cust-1",
              premium_account_id: "acc-1",
            },
          ],
          error: null,
        },
        "in",
      );
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "cust-1", full_name: "Bob" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "acc-1",
              primary_email: "renew@example.com",
              service_type_id: "svc-1",
            },
          ],
          error: null,
        },
        "in",
      );
      const serviceTypesBuilder = createSelectBuilder(
        {
          data: [{ id: "svc-1", name: "Disney+" }],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        subscription_renewals: renewalsBuilder,
        customer_premium_subscriptions: subscriptionBuilder,
        customers: customersBuilder,
        premium_accounts: premiumAccountsBuilder,
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
        "id, customer_id, premium_account_id",
      );
      expect(customersBuilder.select).toHaveBeenCalledWith("id, full_name");
      expect(premiumAccountsBuilder.select).toHaveBeenCalledWith(
        "id, primary_email, service_type_id",
      );
      expect(serviceTypesBuilder.select).toHaveBeenCalledWith("id, name");
    });

    it("hydrates denied renewals from base rows and lookup tables", async () => {
      const renewalsBuilder = createSelectBuilder({
        data: [
          {
            id: "ren-2",
            account_id: TEST_ACCOUNT_ID,
            original_subscription_id: "sub-2",
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
              id: "sub-2",
              customer_id: "cust-2",
              premium_account_id: "acc-2",
            },
          ],
          error: null,
        },
        "in",
      );
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "cust-2", full_name: "Deny User" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "acc-2",
              primary_email: "deny@example.com",
              service_type_id: "svc-2",
            },
          ],
          error: null,
        },
        "in",
      );
      const serviceTypesBuilder = createSelectBuilder(
        {
          data: [{ id: "svc-2", name: "Spotify" }],
          error: null,
        },
        "in",
      );
      const supabaseAdmin = createSupabaseAdminMock({
        subscription_renewals: renewalsBuilder,
        customer_premium_subscriptions: subscriptionBuilder,
        customers: customersBuilder,
        premium_accounts: premiumAccountsBuilder,
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
    });

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
      const migrationsBuilder = createSelectBuilder({
        data: [
          {
            id: "mig-1",
            account_id: TEST_ACCOUNT_ID,
            subscription_id: "sub-1",
            customer_id: "cust-1",
            source_account_id: "src-1",
            target_account_id: "dst-1",
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
      });
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "cust-1", full_name: "Carol" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "src-1",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "dst-1",
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
      expect(migrationsBuilder.select).toHaveBeenCalledWith("*");
      expect(customersBuilder.select).toHaveBeenCalledWith("id, full_name");
      expect(customersBuilder.eq).toHaveBeenCalledWith("account_id", TEST_ACCOUNT_ID);
      expect(premiumAccountsBuilder.select).toHaveBeenCalledWith(
        "id, primary_email, service_type_id, total_slots, used_slots, status",
      );
      expect(premiumAccountsBuilder.select).toHaveBeenCalledTimes(2);
    });

    it("returns hydrated rows for other migration statuses", async () => {
      const migrationsBuilder = createSelectBuilder({
        data: [
          {
            id: "mig-fallback-1",
            account_id: TEST_ACCOUNT_ID,
            subscription_id: "sub-2",
            customer_id: "cust-1",
            source_account_id: "src-1",
            target_account_id: "dst-1",
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
      });
      const customersBuilder = createSelectBuilder(
        {
          data: [{ id: "cust-1", full_name: "Fallback Customer" }],
          error: null,
        },
        "in",
      );
      const premiumAccountsBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "src-1",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "dst-1",
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
      expect(migrationsBuilder.select).toHaveBeenCalledWith("*");
      expect(premiumAccountsBuilder.select).toHaveBeenCalledTimes(2);
    });

    it("flattens migration relation/query failures", async () => {
      const builder = createSelectBuilder({
        data: null,
        error: new Error("migration query failed"),
      });
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
              id: "log-1",
              account_id: TEST_ACCOUNT_ID,
              premium_account_id: "acc-1",
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
              id: "acc-1",
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
              id: "sub-1",
              account_id: TEST_ACCOUNT_ID,
              customer_id: "cust-1",
              premium_account_id: "src-1",
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
              id: "src-1",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "dst-1",
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
          data: [{ id: "cust-1", full_name: "Carol" }],
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
            id: "mig-1",
            account_id: TEST_ACCOUNT_ID,
            subscription_id: "sub-1",
            customer_id: "cust-1",
            source_account_id: "src-1",
            target_account_id: "dst-1",
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
              subscription_id: "sub-1",
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
          id: "history-1",
        },
        error: null,
      });
      const activityLogBuilder = createInsertBuilder({
        data: {
          id: "log-1",
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
            subscription_id: "sub-1",
            target_account_id: "dst-1",
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
        subscription_id: "sub-1",
        customer_id: "cust-1",
        source_account_id: "src-1",
        target_account_id: "dst-1",
        reason: "Move to backup account",
        status: "pending",
      });
      expect(historyInsertRows[0]).toMatchObject({
        migration_id: "mig-1",
        account_id: TEST_ACCOUNT_ID,
        step_number: 1,
        step_name: "request_created",
        step_status: "completed",
      });
      expect(activityInsertRows[0]).toMatchObject({
        account_id: TEST_ACCOUNT_ID,
        action_type: "PREMIUM_MIGRATION_REQUEST_CREATED",
        customer_id: "cust-1",
      });
      expect((activityInsertRows[0] as { details?: Record<string, unknown> }).details).toMatchObject({
        migration_id: "mig-1",
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
              id: "sub-1",
              account_id: TEST_ACCOUNT_ID,
              customer_id: "cust-1",
              premium_account_id: "src-1",
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
              id: "src-1",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "dst-1",
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
          data: [{ id: "cust-1", full_name: "Carol" }],
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
            subscription_id: "sub-1",
            target_account_id: "dst-1",
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
        target_account_id: "dst-1",
        error_code: "CONFLICT",
      });
    });

    it("rejects duplicate pending migration requests", async () => {
      const subscriptionBuilder = createSelectBuilder(
        {
          data: [
            {
              id: "sub-1",
              account_id: TEST_ACCOUNT_ID,
              customer_id: "cust-1",
              premium_account_id: "src-1",
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
              id: "src-1",
              primary_email: "source@example.com",
              service_type_id: VALID_SERVICE_ID,
              total_slots: 5,
              used_slots: 3,
              status: "active",
            },
            {
              id: "dst-1",
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
          data: [{ id: "cust-1", full_name: "Carol" }],
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
            subscription_id: "sub-1",
            target_account_id: "dst-1",
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
        target_account_id: "dst-1",
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
              id: "ren-1",
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
              id: "mig-1",
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
              premium_account_id: "acc-1",
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
              id: "src-1",
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
