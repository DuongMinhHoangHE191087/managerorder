import { NextRequest, NextResponse } from "next/server";
import { createSalesChannelInputSchema } from "@/lib/domain/schemas";
import {
  createSalesChannelForAccount,
  listSalesChannelsForAccount,
} from "@/domains/sales-channels";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(withAccount(async (request: NextRequest, { accountId }) => {
  const data = await listSalesChannelsForAccount(accountId);
  return NextResponse.json({ data });
}));

export const POST = withErrorHandler(withAccount(requirePermissions(["settings:write"])(async (request: NextRequest, { accountId, user }) => {
  const body = await request.json() as unknown;
  const parsed = createSalesChannelInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const sc = await createSalesChannelForAccount(accountId, parsed.data);
  createActivityLog({
    account_id: accountId,
    action_type: "SETTINGS_UPDATED",
    created_by: user.email,
    details: { action: "sales_channel_created", sales_channel_id: sc.id, name: sc.name },
  }).catch(() => {});
  return NextResponse.json({ data: sc }, { status: 201 });
})));
