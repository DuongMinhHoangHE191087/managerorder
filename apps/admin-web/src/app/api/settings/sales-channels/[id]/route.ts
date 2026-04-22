import { NextRequest, NextResponse } from "next/server";
import {
  updateSalesChannelInputSchema,
} from "@/lib/domain/schemas";
import {
  deleteSalesChannelForAccount,
  updateSalesChannelForAccount,
} from "@/domains/sales-channels";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["settings:write"])(async (request: NextRequest, { accountId, params, user }) => {
    const { id } = await params;
    const body = await request.json() as unknown;
    const parsed = updateSalesChannelInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await updateSalesChannelForAccount(id, accountId, parsed.data);
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
    await deleteSalesChannelForAccount(id, accountId);
    createActivityLog({
      account_id: accountId,
      action_type: "SETTINGS_UPDATED",
      created_by: user.email,
      details: { action: "sales_channel_deleted", sales_channel_id: id },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  }))
);
