import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";
import { calculateAvailableSlots } from "@/lib/utils/premium-accounts-helpers";
import {
  ApplicationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import { checkNoPendingMigration } from "@/lib/utils/migrations-helpers";

type SubscriptionForMigration = {
  id: string;
  account_id: string;
  customer_id: string;
  premium_account_id: string;
  service_type_id: string;
  package_id: string;
  billing_cycle: string;
  cycle_months: number;
  start_date: string;
  expiry_date: string;
  status: string;
  renewal_status: string;
  notes: string | null;
  original_price: number;
  final_price: number;
};

type PremiumAccountRow = {
  id: string;
  primary_email: string;
  service_type_id: string;
  total_slots: number;
  used_slots: number;
  status: string | null;
};

type CustomerRow = {
  id: string;
  full_name: string;
};

export interface MigrationRequestInput {
  subscriptionId: string;
  targetAccountId: string;
  reason?: string | null;
  notes?: string | null;
  initiatedBy?: string | null;
}

export interface MigrationRequestResult {
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
  customer_name: string;
  source_account: PremiumAccountSnapshot;
  target_account: PremiumAccountSnapshot;
}

type PremiumAccountSnapshot = PremiumAccountRow & {
  available_slots: number;
};

async function logMigrationActivity(
  accountId: string,
  action_type: string,
  input: MigrationRequestInput,
  details: Record<string, unknown>,
) {
  await createActivityLog({
    account_id: accountId,
    action_type,
    customer_id: typeof details.customer_id === "string" ? details.customer_id : null,
    source_account_id: typeof details.source_account_id === "string" ? details.source_account_id : null,
    created_by: input.initiatedBy ?? null,
    details: {
      flow: "premium_migrations",
      request_type: "migration_request",
      ...details,
    },
  });
}

function toAccountSnapshot(account: PremiumAccountRow): PremiumAccountSnapshot {
  return {
    ...account,
    available_slots: calculateAvailableSlots(account.total_slots, account.used_slots),
  };
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "MIGRATION_CREATE_FAILED";
  }

  return "MIGRATION_CREATE_FAILED";
}

export async function createMigrationRequest(
  supabase: SupabaseClient<Database>,
  accountId: string,
  input: MigrationRequestInput,
): Promise<MigrationRequestResult> {
  const startedAt = new Date().toISOString();

  try {
    const normalizedReason = input.reason?.trim() ?? "";
    if (!normalizedReason) {
      throw new ValidationError("Lý do di chuyển là bắt buộc");
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("customer_premium_subscriptions")
      .select(
        "id, account_id, customer_id, premium_account_id, service_type_id, package_id, billing_cycle, cycle_months, start_date, expiry_date, status, renewal_status, notes, original_price, final_price",
      )
      .eq("id", input.subscriptionId)
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .single();

    if (subscriptionError || !subscription) {
      throw new NotFoundError("Subscription not found");
    }

    const typedSubscription = subscription as SubscriptionForMigration;

    if (typedSubscription.status !== "active") {
      throw new ApplicationError(
        "Only active subscriptions can be migrated",
        400,
        "MIGRATION_INVALID_STATUS",
      );
    }

    if (typedSubscription.premium_account_id === input.targetAccountId) {
      throw new ConflictError("Source and target accounts must be different");
    }

    const pendingMigration = await checkNoPendingMigration(supabase, input.subscriptionId);
    if (!pendingMigration.isValid) {
      throw new ConflictError(
        pendingMigration.error ?? "Migration already pending for this subscription",
      );
    }

    const [accountMap, customerMap] = await Promise.all([
      loadRowsByIds<PremiumAccountRow>(
        supabase,
        "premium_accounts",
        accountId,
        [typedSubscription.premium_account_id, input.targetAccountId],
        "id, primary_email, service_type_id, total_slots, used_slots, status",
      ),
      loadRowsByIds<CustomerRow>(
        supabase,
        "customers",
        accountId,
        [typedSubscription.customer_id],
        "id, full_name",
      ),
    ]);

    const sourceAccount = accountMap.get(typedSubscription.premium_account_id);
    if (!sourceAccount) {
      throw new NotFoundError("Source premium account not found");
    }

    const targetAccount = accountMap.get(input.targetAccountId);
    if (!targetAccount) {
      throw new NotFoundError("Target premium account not found");
    }

    const customer = customerMap.get(typedSubscription.customer_id);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    if (sourceAccount.id === targetAccount.id) {
      throw new ConflictError("Source and target accounts must be different");
    }

    if (sourceAccount.service_type_id !== targetAccount.service_type_id) {
      throw new ApplicationError(
        "Source and target accounts must share the same service type",
        400,
        "TARGET_SERVICE_MISMATCH",
      );
    }

    if (targetAccount.status !== "active") {
      throw new ApplicationError(
        "Target premium account is not active",
        400,
        "TARGET_ACCOUNT_INACTIVE",
      );
    }

    const targetAvailableSlots = calculateAvailableSlots(
      targetAccount.total_slots,
      targetAccount.used_slots,
    );

    if (targetAvailableSlots <= 0) {
      throw new ConflictError("Target premium account has no available slots");
    }

    const sourceAccountSnapshot = toAccountSnapshot(sourceAccount);
    const targetAccountSnapshot = {
      ...targetAccount,
      available_slots: targetAvailableSlots,
    };

    const auditDetails = {
      migration_id: null,
      subscription_id: typedSubscription.id,
      customer_id: typedSubscription.customer_id,
      customer_name: customer.full_name,
      source_account_id: sourceAccount.id,
      source_account_email: sourceAccount.primary_email,
      source_service_type_id: sourceAccount.service_type_id,
      target_account_id: targetAccount.id,
      target_account_email: targetAccount.primary_email,
      target_service_type_id: targetAccount.service_type_id,
      target_available_slots: targetAvailableSlots,
      reason: normalizedReason,
      notes: input.notes?.trim() || null,
      subscription: {
        billing_cycle: typedSubscription.billing_cycle,
        expiry_date: typedSubscription.expiry_date,
        start_date: typedSubscription.start_date,
        original_price: typedSubscription.original_price,
        final_price: typedSubscription.final_price,
        cycle_months: typedSubscription.cycle_months,
        package_id: typedSubscription.package_id,
        service_type_id: typedSubscription.service_type_id,
      },
    };

    const { data: migration, error: migrationError } = await supabase
      .from("account_migrations")
      .insert([
        {
          account_id: accountId,
          subscription_id: typedSubscription.id,
          customer_id: typedSubscription.customer_id,
          source_account_id: sourceAccount.id,
          target_account_id: targetAccount.id,
          source_account_email: sourceAccount.primary_email,
          target_account_email: targetAccount.primary_email,
          source_user_id: null,
          target_user_id: null,
          reason: normalizedReason,
          initiated_by: input.initiatedBy ?? null,
          status: "pending",
          started_at: startedAt,
          completed_at: null,
          details: auditDetails,
          error_log: null,
          notes: input.notes?.trim() || null,
        },
      ])
      .select("*")
      .single();

    if (migrationError) {
      if (migrationError.code === "23505") {
        throw new ConflictError("A migration request already exists for this subscription");
      }

      throw new ApplicationError("Không thể tạo yêu cầu di chuyển", 500, "MIGRATION_CREATE_FAILED");
    }

    if (!migration) {
      throw new ApplicationError("Không thể tạo yêu cầu di chuyển", 500, "MIGRATION_CREATE_FAILED");
    }

    const historyDetails = {
      ...auditDetails,
      migration_id: migration.id,
    };

    const { error: historyError } = await supabase
      .from("account_migration_history")
      .insert([
        {
          migration_id: migration.id,
          account_id: accountId,
          step_number: 1,
          step_name: "request_created",
          step_status: "completed",
          details: historyDetails,
          error_message: null,
          started_at: startedAt,
          completed_at: startedAt,
        },
      ])
      .select("id")
      .single();

    if (historyError) {
      throw new ApplicationError(
        "Không thể ghi lịch sử di chuyển",
        500,
        "MIGRATION_HISTORY_CREATE_FAILED",
      );
    }

    await Promise.allSettled([
      logMigrationActivity(accountId, "PREMIUM_MIGRATION_REQUEST_CREATED", input, historyDetails),
    ]);

    return {
      ...migration,
      customer_name: customer.full_name,
      source_account: sourceAccountSnapshot,
      target_account: targetAccountSnapshot,
    } as MigrationRequestResult;
  } catch (error) {
    await logMigrationActivity(accountId, "PREMIUM_MIGRATION_REQUEST_FAILED", input, {
      migration_id: null,
      subscription_id: input.subscriptionId,
      target_account_id: input.targetAccountId,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      error_message: error instanceof Error ? error.message : "Unknown migration request error",
      error_code: getErrorCode(error),
    });

    throw error;
  }
}
