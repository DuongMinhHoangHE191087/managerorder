// ============================================
// POST /api/premium/health-checks/run
// Trigger a manual health check for one or all eligible accounts
// Separate from GET/POST on /health-checks for explicit "run" semantics
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { successResponse } from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import {
  buildLocalPremiumHealthCheckRun,
  shouldPreferLocalPremiumFixtures,
  shouldUseLocalPremiumFallback,
} from "@/app/api/premium/local-fixtures";
import { runPremiumHealthChecksForAccount } from "@/lib/services/premium-health-checks.service";

interface RunBody {
  /** If set, only check this specific premium account */
  premium_account_id?: string;
  /** Optional notes logged with each health check entry */
  notes?: string;
}

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = (await request.json().catch(() => ({}))) as RunBody;
    if (shouldPreferLocalPremiumFixtures()) {
      const fallback = buildLocalPremiumHealthCheckRun(accountId, {
        premiumAccountId: body.premium_account_id,
        checkType: "manual",
        notes: body.notes ?? null,
      });

      return successResponse(
        {
          checked: fallback.checked,
          failed: fallback.failed,
          results: fallback.results,
          ...(fallback.errors.length > 0 && { errors: fallback.errors }),
        },
        fallback.checked > 0
          ? `Health check completed: ${fallback.checked} account(s) checked`
          : "Health check completed with errors",
      );
    }

    try {
      const result = await runPremiumHealthChecksForAccount(supabase, accountId, {
        premium_account_id: body.premium_account_id,
        check_type: "manual",
        notes: body.notes ?? null,
        noServiceTypesMessage: "No service types have supports_connection_check = true",
        noEligibleAccountsMessage: "No eligible active accounts found for health check",
        updateOnLogFailure: false,
      });

      return successResponse(
        {
          checked: result.checked,
          failed: result.failed,
          results: result.results,
          ...(result.errors.length > 0 && { errors: result.errors }),
        },
        result.checked > 0
          ? `Health check completed: ${result.checked} account(s) checked${result.failed > 0 ? `, ${result.failed} failed` : ''}`
          : "Health check completed with errors"
      );
    } catch (error) {
      if (shouldUseLocalPremiumFallback(error)) {
        const fallback = buildLocalPremiumHealthCheckRun(accountId, {
          premiumAccountId: body.premium_account_id,
          checkType: "manual",
          notes: body.notes ?? null,
        });

        return successResponse(
          {
            checked: fallback.checked,
            failed: fallback.failed,
            results: fallback.results,
            ...(fallback.errors.length > 0 && { errors: fallback.errors }),
          },
          fallback.checked > 0
            ? `Health check completed: ${fallback.checked} account(s) checked`
            : "Health check completed with errors",
        );
      }

      throw error;
    }
  })
);
