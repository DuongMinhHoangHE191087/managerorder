import { NextRequest, NextResponse } from "next/server";
import { ApplicationError, isApplicationError } from "@/lib/utils/errors";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildLocalPremiumHealthCheckRun,
  shouldPreferLocalPremiumFixtures,
  shouldUseLocalPremiumFallback,
} from "@/app/api/premium/local-fixtures";
import { runPremiumHealthChecksForAccount } from "@/lib/services/premium-health-checks.service";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const CRON_NOTES = "Scheduled premium health check via Vercel Cron";

function isSkipableHealthCheckError(error: unknown): boolean {
  return (
    isApplicationError(error)
    && (
      error.code === "PREMIUM_HEALTH_CHECK_NO_SUPPORTED_SERVICES"
      || error.code === "PREMIUM_HEALTH_CHECK_NO_ACCOUNTS"
    )
  );
}

function buildLocalResponse() {
  const fallback = buildLocalPremiumHealthCheckRun("sandbox-account", {
    checkType: "scheduled",
    notes: CRON_NOTES,
  });

  return NextResponse.json({
    success: true,
    mode: "local_fallback",
    processed_accounts: 1,
    checked: fallback.checked,
    failed: fallback.failed,
    skipped_accounts: 0,
    results: fallback.results,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (shouldPreferLocalPremiumFixtures()) {
    return buildLocalResponse();
  }

  try {
    const { data: accounts, error } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const accountIds = (accounts ?? []).map((row) => row.id).filter(Boolean);
    if (accountIds.length === 0) {
      return NextResponse.json({
        success: true,
        mode: "database",
        processed_accounts: 0,
        checked: 0,
        failed: 0,
        skipped_accounts: 0,
        results: [],
        timestamp: new Date().toISOString(),
      });
    }

    const results: Array<{
      account_id: string;
      checked: number;
      failed: number;
      results: Array<{
        premium_account_id: string;
        email: string;
        status: "working" | "error" | "unknown";
        log_id: string;
        previous_status: string | null;
      }>;
    }> = [];
    const errors: Array<{ account_id: string; error: string }> = [];
    let checked = 0;
    let failed = 0;
    let skippedAccounts = 0;

    for (const accountId of accountIds) {
      try {
        const result = await runPremiumHealthChecksForAccount(supabaseAdmin, accountId, {
          check_type: "scheduled",
          notes: CRON_NOTES,
          noServiceTypesMessage: "No service types have supports_connection_check = true",
          noEligibleAccountsMessage: "No eligible active accounts found for health check",
          updateOnLogFailure: true,
        });

        checked += result.checked;
        failed += result.failed;
        results.push({
          account_id: accountId,
          checked: result.checked,
          failed: result.failed,
          results: result.results,
        });
      } catch (error) {
        if (isSkipableHealthCheckError(error)) {
          skippedAccounts += 1;
          continue;
        }

        if (shouldUseLocalPremiumFallback(error)) {
          throw error;
        }

        if (error instanceof Error) {
          errors.push({ account_id: accountId, error: error.message });
        } else {
          errors.push({ account_id: accountId, error: "Unknown health check error" });
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode: "database",
      processed_accounts: accountIds.length,
      checked,
      failed,
      skipped_accounts: skippedAccounts,
      results,
      ...(errors.length > 0 && { errors }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (shouldPreferLocalPremiumFixtures() || shouldUseLocalPremiumFallback(error)) {
      return buildLocalResponse();
    }

    if (error instanceof ApplicationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
