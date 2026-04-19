import { NextRequest, NextResponse } from "next/server";
import { createProviderInputSchema } from "@/lib/domain/schemas";
import { getProviderById, updateProvider, deleteProvider } from "@/lib/supabase/repositories/providers.repo";
import { mapProviderRow } from "@/lib/supabase/mappers";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

function logProviderDetailRouteError(
  action: "get" | "update" | "delete",
  accountId: string,
  providerId: string,
  error: unknown,
) {
  console.error(`[API /api/providers/[id]] ${action} failed`, { accountId, providerId }, error);
}

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    try {
      const result = await getProviderById(id, accountId);
      const data = mapProviderRow(result as unknown as Record<string, unknown>);
      return NextResponse.json({ data });
    } catch (error) {
      logProviderDetailRouteError("get", accountId, id, error);
      throw error;
    }
  })
);

export const PUT = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (request: NextRequest, { accountId, params, user }) => {
      const { id } = await params;
      try {
        const body = await request.json() as Record<string, unknown>;
        const parsed = createProviderInputSchema.partial().safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (parsed.data.name) updateData.name = parsed.data.name;
        if (parsed.data.tier) updateData.tier = parsed.data.tier;
        if (body.reliabilityScore !== undefined) updateData.reliability_score = Number(body.reliabilityScore);
        if (body.notes !== undefined) updateData.notes = body.notes || null;
        if (body.createdAt) updateData.created_at = body.createdAt;
        if (parsed.data.contacts) {
          updateData.contacts = parsed.data.contacts.map((contact) => ({
            id: contact.id || crypto.randomUUID(),
            type: contact.type,
            value: contact.value,
            isPrimary: contact.isPrimary ?? false,
            facebookId: contact.facebookId,
            facebookName: contact.facebookName,
          }));
        }

        const result = await updateProvider(id, accountId, updateData);

        createActivityLog({
          account_id: accountId,
          action_type: "PROCUREMENT_UPDATED",
          created_by: user.email,
          details: {
            action: "provider_updated",
            provider_id: id,
            provider_name: result.name,
          },
        }).catch(() => {});

        const data = mapProviderRow(result as unknown as Record<string, unknown>);
        return NextResponse.json({ data });
      } catch (error) {
        logProviderDetailRouteError("update", accountId, id, error);
        throw error;
      }
    })
  )
);

export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request: NextRequest, { accountId, params, user }) => {
      const { id } = await params;
      try {
        const provider = await getProviderById(id, accountId);
        await deleteProvider(id, accountId);

        createActivityLog({
          account_id: accountId,
          action_type: "PROCUREMENT_UPDATED",
          created_by: user.email,
          details: {
            action: "provider_deleted",
            provider_id: id,
            provider_name: provider.name,
          },
        }).catch(() => {});

        return NextResponse.json({ success: true });
      } catch (error) {
        logProviderDetailRouteError("delete", accountId, id, error);
        throw error;
      }
    })
  )
);
