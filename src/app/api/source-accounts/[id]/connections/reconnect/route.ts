import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { reconnectSourceAccount } from "@/lib/supabase/repositories/source-accounts.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import type { NextRequest } from "next/server";

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id: sourceAccountId } = await params;
    const body = await request.json() as { orderItemId: string; quantity: number };
    
    await reconnectSourceAccount(sourceAccountId, body.orderItemId, accountId);
    
    createActivityLog({
      account_id: accountId,
      action_type: 'INVENTORY_STATUS_CHANGED',
      source_account_id: sourceAccountId,
      details: { action: 'Reconnected source account', orderItemId: body.orderItemId }
    }).catch(() => {});

    return createSuccessResponse({ success: true });
  })
);
