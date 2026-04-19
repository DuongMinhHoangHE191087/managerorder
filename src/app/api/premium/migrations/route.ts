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

export const GET = withFlatAccountHandler(async (request, { accountId }) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  const { data: baseMigrations, error } = await supabaseAdmin
    .from("account_migrations")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", status)
    .order("created_at", { ascending: false });

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
    meta: { total: formattedData.length, status },
  });
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
