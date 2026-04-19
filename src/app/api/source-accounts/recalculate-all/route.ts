// /api/source-accounts/recalculate-all — Batch recalculate slots for all source accounts
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { recalculateAllSlots } from "@/lib/supabase/repositories/source-accounts.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const result = await recalculateAllSlots(accountId);

    if (result.changed > 0) {
      createActivityLog({
        account_id: accountId,
        action_type: 'SLOTS_RECALCULATED',
        details: {
          action: 'Batch recalculate all source accounts',
          total: result.total,
          changed: result.changed,
          results: result.results,
        },
      }).catch(() => {});
    }

    return createSuccessResponse(result);
  })
);
