import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { reconnectSourceAccount } from "@/lib/supabase/repositories/source-accounts.repo";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import type { NextRequest } from "next/server";

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = await request.json();

    // m2: Proper validation — check type, not truthy value
    const orderItemId = typeof body?.orderItemId === "string" ? body.orderItemId.trim() : "";
    if (!orderItemId) {
      throw new Error("orderItemId is required");
    }

    // Reuse reconnect logic which handles slot checks
    await reconnectSourceAccount(id, orderItemId, accountId);

    // Activity log (non-blocking) — m6: include account_id
    createActivityLog({
      account_id: accountId,
      action_type: "INVENTORY_ASSIGNED",
      source_account_id: id,
      details: { order_item_id: orderItemId, method: "manual" },
    }).catch(() => {});

    return createSuccessResponse({ message: "Kết nối thành công" });
  })
);
