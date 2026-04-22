import type { SupabaseClient } from "@supabase/supabase-js";
import { ApplicationError } from "@/lib/utils/errors";
import type { RunHealthCheck, PremiumAccount } from "@/lib/types/premium";

type SupabaseLike = Pick<SupabaseClient, "from">;

export type PremiumHealthCheckStatus = "working" | "error" | "unknown";

export interface PremiumHealthCheckRunItem {
  premium_account_id: string;
  email: string;
  status: PremiumHealthCheckStatus;
  log_id: string;
  previous_status: string | null;
}

export interface PremiumHealthCheckRunResult {
  checked: number;
  failed: number;
  results: PremiumHealthCheckRunItem[];
  errors: Array<{ premium_account_id: string; error: string }>;
}

export interface RunPremiumHealthChecksOptions extends Omit<RunHealthCheck, "notes"> {
  notes?: string | null;
  noServiceTypesMessage?: string;
  noEligibleAccountsMessage?: string;
  updateOnLogFailure?: boolean;
}

type PremiumHealthCheckAccount = Pick<
  PremiumAccount,
  "id" | "service_type_id" | "primary_email" | "status" | "connection_status"
>;

function normalizeCheckType(checkType: RunHealthCheck["check_type"] | undefined): NonNullable<RunHealthCheck["check_type"]> {
  return checkType ?? "manual";
}

export async function runPremiumHealthChecksForAccount(
  supabase: SupabaseLike,
  accountId: string,
  input: RunPremiumHealthChecksOptions = {},
): Promise<PremiumHealthCheckRunResult> {
  const checkType = normalizeCheckType(input.check_type);

  const { data: serviceTypes, error: serviceTypeError } = await supabase
    .from("premium_service_types")
    .select("id")
    .eq("account_id", accountId)
    .eq("supports_connection_check", true)
    .is("deleted_at", null);

  if (serviceTypeError) {
    throw serviceTypeError;
  }

  if (!serviceTypes || serviceTypes.length === 0) {
    throw new ApplicationError(
      input.noServiceTypesMessage ?? "No service types have supports_connection_check = true",
      400,
      "PREMIUM_HEALTH_CHECK_NO_SUPPORTED_SERVICES",
    );
  }

  const serviceTypeIds = (serviceTypes as Array<{ id: string }>).map((serviceType) => serviceType.id);
  let accountQuery = supabase
    .from("premium_accounts")
    .select("id, account_id, service_type_id, primary_email, status, connection_status")
    .eq("account_id", accountId)
    .eq("status", "active")
    .in("service_type_id", serviceTypeIds)
    .is("deleted_at", null);

  if (input.premium_account_id) {
    accountQuery = accountQuery.eq("id", input.premium_account_id);
  }

  const { data: accounts, error: accountError } = await accountQuery;

  if (accountError) {
    throw accountError;
  }

  if (!accounts || accounts.length === 0) {
    throw new ApplicationError(
      input.noEligibleAccountsMessage ?? "No eligible premium accounts found for health check",
      404,
      "PREMIUM_HEALTH_CHECK_NO_ACCOUNTS",
    );
  }

  const checkTimestamp = new Date().toISOString();
  const results: PremiumHealthCheckRunItem[] = [];
  const errors: Array<{ premium_account_id: string; error: string }> = [];

  for (const account of accounts as PremiumHealthCheckAccount[]) {
    const checkStatus: PremiumHealthCheckStatus = account.status === "active" ? "working" : "unknown";

    const { data: logEntry, error: logError } = await supabase
      .from("premium_account_health_logs")
      .insert({
        premium_account_id: account.id,
        account_id: accountId,
        service_type_id: account.service_type_id,
        check_timestamp: checkTimestamp,
        check_type: checkType,
        current_status: checkStatus,
        previous_status: account.connection_status ?? null,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();

    if (logError || !logEntry) {
      errors.push({
        premium_account_id: account.id,
        error: logError?.message ?? "Failed to write log",
      });

      if (!input.updateOnLogFailure) {
        continue;
      }
    }

    await supabase
      .from("premium_accounts")
      .update({
        connection_status: checkStatus === "working" ? "working" : null,
        last_connection_check_at: checkTimestamp,
      })
      .eq("id", account.id);

    if (logEntry) {
      results.push({
        premium_account_id: account.id,
        email: account.primary_email,
        status: checkStatus,
        log_id: logEntry.id,
        previous_status: account.connection_status ?? null,
      });
    }
  }

  return {
    checked: results.length,
    failed: errors.length,
    results,
    errors,
  };
}
