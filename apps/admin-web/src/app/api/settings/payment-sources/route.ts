import { NextResponse } from "next/server";
import { createPaymentSourceInputSchema } from "@/lib/domain/schemas";
import {
  listPaymentSources,
  createPaymentSource,
} from "@/lib/supabase/repositories/settings.repo";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(withAccount(async (_request, { accountId }) => {
  const data = await listPaymentSources(accountId);
  return NextResponse.json({ data });
}));

export const POST = withErrorHandler(withAccount(requirePermissions(["settings:write"])(async (request, { accountId, user }) => {
  const body = await request.json() as unknown;
  const parsed = createPaymentSourceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const ps = await createPaymentSource(accountId, parsed.data);
  createActivityLog({
    account_id: accountId,
    action_type: "SETTINGS_UPDATED",
    created_by: user.email,
    details: { action: "payment_source_created", payment_source_id: ps.id, name: ps.name },
  }).catch(() => {});
  return NextResponse.json({ data: ps }, { status: 201 });
})));
