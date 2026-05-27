import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { createMigrationRequest } from "@/lib/supabase/repositories/migrations.repo";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";
import { ValidationError } from "@/lib/utils/errors";
import {
  buildLocalPremiumMigrations,
  shouldPreferLocalPremiumFixtures,
  shouldUseLocalPremiumFallback,
} from "@/app/api/premium/local-fixtures";

type MigrationRow = {
  id: string;
  account_id: string;
  subscription_id: string;
  customer_id: string;
  source_account_id: string;
  target_account_id: string;
  source_account_email: string | null;
  target_account_email: string | null;
  source_user_id: string | null;
  target_user_id: string | null;
  reason: string | null;
  initiated_by: string | null;
  status: "pending" | "in_progress" | "completed" | "failed" | "rollback";
  started_at: string;
  completed_at: string | null;
  details: Record<string, unknown> | null;
  error_log: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MigrationStatus = "pending" | "in_progress" | "completed" | "failed";
type MigrationStatusCounts = Record<MigrationStatus, number>;
type MigrationRangeResult = {
  data: unknown;
  count?: number | null;
  error: unknown;
};
type MigrationFilterChain = {
  eq: (column: string, value: unknown) => unknown;
  gte: (column: string, value: string) => unknown;
  lt: (column: string, value: string) => unknown;
};

const createMigrationSchema = z.object({
  subscription_id: z.string().trim().min(1, "Mã thuê bao không hợp lệ"),
  target_account_id: z.string().trim().min(1, "Kho đích không hợp lệ"),
  reason: z.string().trim().min(3, "Lý do di chuyển là bắt buộc"),
  notes: z
    .string()
    .trim()
    .max(1000, "Ghi chú không được vượt quá 1000 ký tự")
    .optional(),
});

async function logValidationFailure(
  accountId: string,
  payload: Record<string, unknown>,
  errorMessage: string,
) {
  await createActivityLog({
    account_id: accountId,
    action_type: "PREMIUM_MIGRATION_REQUEST_FAILED",
    details: {
      flow: "premium_migrations",
      request_type: "migration_request",
      ...payload,
      error_message: errorMessage,
      error_code: "VALIDATION_ERROR",
      validation_stage: "request_validation",
    },
  });
}

function applyMigrationFilters(
  query: unknown,
  filters: {
    accountId: string;
    status?: string | null;
    subscriptionId?: string | null;
    sourceAccountId?: string | null;
    targetAccountId?: string | null;
    customerId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
  },
) {
  let nextQuery = query as MigrationFilterChain;
  nextQuery = nextQuery.eq("account_id", filters.accountId) as MigrationFilterChain;

  if (filters.status) {
    nextQuery = nextQuery.eq("status", filters.status) as MigrationFilterChain;
  }
  if (filters.subscriptionId) {
    nextQuery = nextQuery.eq("subscription_id", filters.subscriptionId) as MigrationFilterChain;
  }
  if (filters.sourceAccountId) {
    nextQuery = nextQuery.eq("source_account_id", filters.sourceAccountId) as MigrationFilterChain;
  }
  if (filters.targetAccountId) {
    nextQuery = nextQuery.eq("target_account_id", filters.targetAccountId) as MigrationFilterChain;
  }
  if (filters.customerId) {
    nextQuery = nextQuery.eq("customer_id", filters.customerId) as MigrationFilterChain;
  }
  if (filters.fromDate) {
    nextQuery = nextQuery.gte("created_at", filters.fromDate) as MigrationFilterChain;
  }
  if (filters.toDate) {
    const inclusiveEnd = new Date(filters.toDate);
    inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
    nextQuery = nextQuery.lt("created_at", inclusiveEnd.toISOString()) as MigrationFilterChain;
  }

  return nextQuery;
}

async function loadMigrationStatusCounts(filters: {
  accountId: string;
  subscriptionId?: string | null;
  sourceAccountId?: string | null;
  targetAccountId?: string | null;
  customerId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}) {
  const statuses: MigrationStatus[] = ["pending", "in_progress", "completed", "failed"];
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const query = applyMigrationFilters(
        supabaseAdmin
          .from("account_migrations")
          .select("id", { count: "exact" }),
        {
          ...filters,
          status,
        },
      ) as unknown as {
        range: (from: number, to: number) => Promise<MigrationRangeResult>;
      };

      const { count, data, error } = await query.range(0, 0);

      if (error) {
        throw error;
      }

      return [status, Number(count ?? (Array.isArray(data) ? data.length : 0))] as const;
    }),
  );

  return Object.fromEntries(counts) as MigrationStatusCounts;
}

function buildFallbackStatusCounts(
  rows: Array<{ status: string }>,
): MigrationStatusCounts {
  return {
    pending: rows.filter((item) => item.status === "pending").length,
    in_progress: rows.filter((item) => item.status === "in_progress").length,
    completed: rows.filter((item) => item.status === "completed").length,
    failed: rows.filter((item) => item.status === "failed").length,
  };
}

export const GET = withFlatAccountHandler(async (request, { accountId }) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const subscriptionId = searchParams.get("subscription_id");
  const sourceAccountId = searchParams.get("source_account_id");
  const targetAccountId = searchParams.get("target_account_id");
  const customerId = searchParams.get("customer_id");
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");
  const includeStatusCounts = searchParams.get("include_status_counts") === "1";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit")) || 20), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const preferLocalPremiumFixtures = shouldPreferLocalPremiumFixtures();

  if (preferLocalPremiumFixtures) {
    const fallbackMigrations = buildLocalPremiumMigrations(accountId, status)
      .filter((item) => (subscriptionId ? item.subscription_id === subscriptionId : true))
      .filter((item) => (sourceAccountId ? item.source_account_id === sourceAccountId : true))
      .filter((item) => (targetAccountId ? item.target_account_id === targetAccountId : true))
      .filter((item) => (customerId ? item.customer_id === customerId : true))
      .filter((item) => (fromDate ? new Date(item.created_at) >= new Date(fromDate) : true))
      .filter((item) => {
        if (!toDate) {
          return true;
        }
        const end = new Date(toDate);
        end.setDate(end.getDate() + 1);
        return new Date(item.created_at) < end;
      });
    const statusCounts = includeStatusCounts
      ? buildFallbackStatusCounts(
          ["pending", "in_progress", "completed", "failed"].flatMap((itemStatus) =>
            buildLocalPremiumMigrations(accountId, itemStatus)
              .filter((item) => (subscriptionId ? item.subscription_id === subscriptionId : true))
              .filter((item) => (sourceAccountId ? item.source_account_id === sourceAccountId : true))
              .filter((item) => (targetAccountId ? item.target_account_id === targetAccountId : true))
              .filter((item) => (customerId ? item.customer_id === customerId : true))
              .filter((item) => (fromDate ? new Date(item.created_at) >= new Date(fromDate) : true))
              .filter((item) => {
                if (!toDate) {
                  return true;
                }
                const end = new Date(toDate);
                end.setDate(end.getDate() + 1);
                return new Date(item.created_at) < end;
              }),
          ),
        )
      : undefined;
    const pagedFallback = fallbackMigrations.slice(from, to + 1);

    return createFlatSuccessResponse(pagedFallback, {
      meta: {
        total: fallbackMigrations.length,
        status,
        ...(statusCounts ? { statusCounts } : {}),
        page,
        limit,
        totalPages: Math.ceil(fallbackMigrations.length / limit) || 1,
      },
    });
  }

  try {
    const filterParams = {
      accountId,
      status,
      subscriptionId,
      sourceAccountId,
      targetAccountId,
      customerId,
      fromDate,
      toDate,
    };
    const [migrationResult, statusCounts] = await Promise.all([
      (applyMigrationFilters(
        supabaseAdmin
          .from("account_migrations")
          .select("*", { count: "exact" }),
        filterParams,
      ) as unknown as {
        order: (
          column: string,
          options?: { ascending?: boolean },
        ) => {
          range: (from: number, to: number) => Promise<MigrationRangeResult>;
        };
      })
        .order("created_at", { ascending: false })
        .range(from, to),
      includeStatusCounts
        ? loadMigrationStatusCounts({
            accountId,
            subscriptionId,
            sourceAccountId,
            targetAccountId,
            customerId,
            fromDate,
            toDate,
          })
        : Promise.resolve(undefined),
    ]);
    const { data: baseMigrations, error, count } = migrationResult;

    if (error) {
      throw error;
    }

    const migrations = (baseMigrations ?? []) as MigrationRow[];

    const customerIds = [...new Set(migrations.map((item) => item.customer_id).filter(Boolean))];
    const sourceAccountIds = [...new Set(migrations.map((item) => item.source_account_id).filter(Boolean))];
    const targetAccountIds = [...new Set(migrations.map((item) => item.target_account_id).filter(Boolean))];

    const [customerNameById, sourceAccountMap, targetAccountMap] = await Promise.all([
      (async () => {
        const map = new Map<string, string>();
        if (customerIds.length === 0) {
          return map;
        }

        const { data: customers, error: customersError } = await supabaseAdmin
          .from("customers")
          .select("id, full_name")
          .eq("account_id", accountId)
          .in("id", customerIds);

        if (customersError) {
          throw customersError;
        }

        for (const customer of customers ?? []) {
          map.set(customer.id, customer.full_name);
        }

        return map;
      })(),
      loadRowsByIds<{
        id: string;
        primary_email: string;
        service_type_id: string;
        total_slots: number;
        used_slots: number;
        status: string | null;
      }>(
        supabaseAdmin,
        "premium_accounts",
        accountId,
        sourceAccountIds,
        "id, primary_email, service_type_id, total_slots, used_slots, status",
      ),
      loadRowsByIds<{
        id: string;
        primary_email: string;
        service_type_id: string;
        total_slots: number;
        used_slots: number;
        status: string | null;
      }>(
        supabaseAdmin,
        "premium_accounts",
        accountId,
        targetAccountIds,
        "id, primary_email, service_type_id, total_slots, used_slots, status",
      ),
    ]);

    const formattedData = migrations.map((item) => {
      const sourceAccount = sourceAccountMap.get(item.source_account_id) ?? null;
      const targetAccount = targetAccountMap.get(item.target_account_id) ?? null;

      return {
        ...item,
        customer_name: customerNameById.get(item.customer_id) ?? "N/A",
        source_account_email: sourceAccount?.primary_email ?? item.source_account_email ?? null,
        target_account_email: targetAccount?.primary_email ?? item.target_account_email ?? null,
        source_account: sourceAccount,
        target_account: targetAccount,
      };
    });

    return createFlatSuccessResponse(formattedData, {
      meta: {
        total: count ?? formattedData.length,
        status,
        ...(statusCounts ? { statusCounts } : {}),
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
    });
  } catch (error) {
    if (shouldUseLocalPremiumFallback(error)) {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") || "pending";
      const fallbackMigrations = buildLocalPremiumMigrations(accountId, status)
        .filter((item) => (subscriptionId ? item.subscription_id === subscriptionId : true))
        .filter((item) => (sourceAccountId ? item.source_account_id === sourceAccountId : true))
        .filter((item) => (targetAccountId ? item.target_account_id === targetAccountId : true))
        .filter((item) => (customerId ? item.customer_id === customerId : true));
      const statusCounts = includeStatusCounts
        ? buildFallbackStatusCounts(
            ["pending", "in_progress", "completed", "failed"].flatMap((itemStatus) =>
              buildLocalPremiumMigrations(accountId, itemStatus)
                .filter((item) => (subscriptionId ? item.subscription_id === subscriptionId : true))
                .filter((item) => (sourceAccountId ? item.source_account_id === sourceAccountId : true))
                .filter((item) => (targetAccountId ? item.target_account_id === targetAccountId : true))
                .filter((item) => (customerId ? item.customer_id === customerId : true)),
            ),
          )
        : undefined;
      const pagedFallback = fallbackMigrations.slice(from, to + 1);

      return createFlatSuccessResponse(pagedFallback, {
        meta: {
          total: fallbackMigrations.length,
          status,
          ...(statusCounts ? { statusCounts } : {}),
          page,
          limit,
          totalPages: Math.ceil(fallbackMigrations.length / limit) || 1,
        },
      });
    }

    if (process.env.CODEX_DEBUG_API_ERRORS === "1") {
      console.error("[API /premium/migrations]", error);
    }
    throw error;
  }
});

export const POST = withFlatAccountHandler(async (request, { accountId }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    await logValidationFailure(
      accountId,
      { stage: "request_parse" },
      "Dữ liệu yêu cầu di chuyển không hợp lệ",
    );
    throw new ValidationError("Dữ liệu yêu cầu di chuyển không hợp lệ");
  }

  const parsed = createMigrationSchema.safeParse(body);
  if (!parsed.success) {
    const validationPayload = {
      stage: "schema_validation",
      subscription_id:
        typeof (body as Record<string, unknown>).subscription_id === "string"
          ? (body as Record<string, unknown>).subscription_id
          : null,
      target_account_id:
        typeof (body as Record<string, unknown>).target_account_id === "string"
          ? (body as Record<string, unknown>).target_account_id
          : null,
    };

    await logValidationFailure(
      accountId,
      validationPayload,
      parsed.error.issues[0]?.message ?? "Dữ liệu yêu cầu di chuyển không hợp lệ",
    );

    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "Dữ liệu yêu cầu di chuyển không hợp lệ",
    );
  }

  const createdMigration = await createMigrationRequest(supabaseAdmin, accountId, {
    subscriptionId: parsed.data.subscription_id,
    targetAccountId: parsed.data.target_account_id,
    reason: parsed.data.reason,
    notes: parsed.data.notes ?? null,
  });

  return createFlatSuccessResponse(createdMigration, {
    status: 201,
    meta: {
      status: createdMigration.status,
      migration_id: createdMigration.id,
    },
  });
});
