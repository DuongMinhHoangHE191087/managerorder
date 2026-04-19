import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { disconnectSourceAccount } from "@/lib/supabase/repositories/source-accounts.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import type { NextRequest } from "next/server";

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id: sourceAccountId } = await params;
    const body = await request.json();

    // m3: Proper input validation
    const orderItemId = typeof body?.orderItemId === "string" ? body.orderItemId.trim() : "";
    if (!orderItemId) {
      throw new Error("orderItemId is required");
    }

    await disconnectSourceAccount(sourceAccountId, orderItemId, accountId);
    
    // m6: Include account_id in activity log
    createActivityLog({
      account_id: accountId,
      action_type: 'INVENTORY_STATUS_CHANGED',
      source_account_id: sourceAccountId,
      details: { action: 'Disconnected source account', orderItemId }
    }).catch(() => {});

    return createSuccessResponse({ success: true });
  })
);
