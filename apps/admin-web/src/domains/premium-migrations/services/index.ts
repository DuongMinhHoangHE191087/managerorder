import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";
import { createMigrationRequest } from "@/lib/supabase/repositories/migrations.repo";
import { calculateAvailableSlots } from "@/lib/utils/premium-accounts-helpers";
import {
  ApplicationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/utils/errors";
import { checkNoPendingMigration } from "@/lib/utils/migrations-helpers";

import type {
  PremiumMigrationAccountSnapshot,
  PremiumMigrationDetailRow,
  PremiumMigrationListRow,
  PremiumMigrationStatus,
} from "../types";

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

type MigrationRow = Omit<PremiumMigrationListRow, "customer_name" | "source_account" | "target_account">;

export interface CreatePremiumMigrationInput {
  subscriptionId: string;
  targetAccountId: string;
  reason?: string | null;
  notes?: string | null;
  initiatedBy?: string | null;
}

function toAccountSnapshot(account: PremiumAccountRow): Exclude<PremiumMigrationAccountSnapshot, null> {
  return {
    ...account,
    available_slots: calculateAvailableSlots(account.total_slots, account.used_slots),
  };
}

async function loadCustomersByIds(
  supabase: SupabaseClient<Database>,
  accountId: string,
  customerIds: string[],
) {
  const map = new Map<string, string>();
  if (customerIds.length === 0) return map;

  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("account_id", accountId)
    .in("id", customerIds);

  if (error) throw error;

  for (const customer of (data ?? []) as CustomerRow[]) {
    map.set(customer.id, customer.full_name);
  }

  return map;
}

async function loadPremiumAccountsByIds(
  supabase: SupabaseClient<Database>,
  accountId: string,
  ids: string[],
) {
  return loadRowsByIds<PremiumAccountRow>(
    supabase,
    "premium_accounts",
    accountId,
    ids,
    "id, primary_email, service_type_id, total_slots, used_slots, status",
  );
}

export async function listPremiumMigrationsForAccount(
  supabase: SupabaseClient<Database>,
  accountId: string,
  status: PremiumMigrationStatus,
): Promise<PremiumMigrationListRow[]> {
  const { data: baseMigrations, error } = await supabase
    .from("account_migrations")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const migrations = (baseMigrations ?? []) as MigrationRow[];
  const customerIds = [...new Set(migrations.map((item) => item.customer_id).filter(Boolean))];
  const sourceAccountIds = [...new Set(migrations.map((item) => item.source_account_id).filter(Boolean))];
  const targetAccountIds = [...new Set(migrations.map((item) => item.target_account_id).filter(Boolean))];

  const [customerNameById, sourceAccountMap, targetAccountMap] = await Promise.all([
    loadCustomersByIds(supabase, accountId, customerIds),
    loadPremiumAccountsByIds(supabase, accountId, sourceAccountIds),
    loadPremiumAccountsByIds(supabase, accountId, targetAccountIds),
  ]);

  return migrations.map((item) => {
    const sourceAccount = sourceAccountMap.get(item.source_account_id) ?? null;
    const targetAccount = targetAccountMap.get(item.target_account_id) ?? null;

    return {
      ...item,
      customer_name: customerNameById.get(item.customer_id) ?? "N/A",
      source_account_email: sourceAccount?.primary_email ?? item.source_account_email ?? null,
      target_account_email: targetAccount?.primary_email ?? item.target_account_email ?? null,
      source_account: sourceAccount ? toAccountSnapshot(sourceAccount) : null,
      target_account: targetAccount ? toAccountSnapshot(targetAccount) : null,
    };
  });
}

export async function getPremiumMigrationDetailForAccount(
  supabase: SupabaseClient<Database>,
  accountId: string,
  migrationId: string,
): Promise<PremiumMigrationDetailRow | null> {
  const { data: baseMigration, error: dbError } = await supabase
    .from("account_migrations")
    .select("*")
    .eq("id", migrationId)
    .eq("account_id", accountId)
    .single();

  if (dbError || !baseMigration) {
    return null;
  }

  const [sourceAccountMap, targetAccountMap, customerMap] = await Promise.all([
    loadPremiumAccountsByIds(supabase, accountId, [baseMigration.source_account_id]),
    loadPremiumAccountsByIds(supabase, accountId, [baseMigration.target_account_id]),
    loadCustomersByIds(supabase, accountId, [baseMigration.customer_id]),
  ]);

  const { data: steps } = await supabase
    .from("account_migration_history")
    .select("*")
    .eq("migration_id", migrationId)
    .order("step_number", { ascending: true });

  const sourceAccount = sourceAccountMap.get(baseMigration.source_account_id) ?? null;
  const targetAccount = targetAccountMap.get(baseMigration.target_account_id) ?? null;

  return {
    ...baseMigration,
    customer_name: customerMap.get(baseMigration.customer_id) ?? "N/A",
    source_account_email: sourceAccount?.primary_email ?? baseMigration.source_account_email ?? null,
    target_account_email: targetAccount?.primary_email ?? baseMigration.target_account_email ?? null,
    source_account: sourceAccount ? toAccountSnapshot(sourceAccount) : null,
    target_account: targetAccount ? toAccountSnapshot(targetAccount) : null,
    steps: (steps ?? []) as PremiumMigrationDetailRow["steps"],
  };
}

async function logMigrationActivity(
  accountId: string,
  action_type: string,
  input: CreatePremiumMigrationInput,
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

export async function createPremiumMigrationRequest(
  supabase: SupabaseClient<Database>,
  accountId: string,
  input: CreatePremiumMigrationInput,
) {
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
      loadPremiumAccountsByIds(
        supabase,
        accountId,
        [typedSubscription.premium_account_id, input.targetAccountId],
      ),
      loadCustomersByIds(supabase, accountId, [typedSubscription.customer_id]),
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
      customer_name: customer,
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

    const result = await createMigrationRequest(supabase, accountId, {
      subscriptionId: typedSubscription.id,
      targetAccountId: targetAccount.id,
      reason: normalizedReason,
      notes: input.notes?.trim() || null,
      initiatedBy: input.initiatedBy ?? null,
    });

    await logMigrationActivity(accountId, "PREMIUM_MIGRATION_REQUEST_CREATED", input, {
      ...auditDetails,
      migration_id: result.id,
    });

    return {
      ...result,
      source_account: sourceAccountSnapshot,
      target_account: targetAccountSnapshot,
      customer_name: customer,
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError || error instanceof ApplicationError) {
      throw error;
    }

    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: unknown }).code;
      if (code === "23505") {
        throw new ConflictError("A migration request already exists for this subscription");
      }
    }

    throw new ApplicationError("Không thể tạo yêu cầu di chuyển", 500, "MIGRATION_CREATE_FAILED");
  }
}
