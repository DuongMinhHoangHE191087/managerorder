import { NextRequest, NextResponse } from "next/server";
import {
  updateSalesChannel,
  deleteSalesChannel,
} from "@/lib/supabase/repositories/settings.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["settings:write"])(async (request: NextRequest, { accountId, params, user }) => {
    const { id } = await params;
    const body = await request.json() as { name?: string };
    const updated = await updateSalesChannel(id, accountId, body);
    createActivityLog({
      account_id: accountId,
      action_type: "SETTINGS_UPDATED",
      created_by: user.email,
      details: { action: "sales_channel_updated", sales_channel_id: id, name: updated.name },
    }).catch(() => {});
    return NextResponse.json({ data: updated });
  }))
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["settings:write"])(async (_request: NextRequest, { accountId, params, user }) => {
    const { id } = await params;
    await deleteSalesChannel(id, accountId);
    createActivityLog({
      account_id: accountId,
      action_type: "SETTINGS_UPDATED",
      created_by: user.email,
      details: { action: "sales_channel_deleted", sales_channel_id: id },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  }))
);
