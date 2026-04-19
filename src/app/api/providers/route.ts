import { NextRequest, NextResponse } from "next/server";
import { createProviderInputSchema } from "@/lib/domain/schemas";
import { listProviders, createProvider } from "@/lib/supabase/repositories/providers.repo";
import { mapProviderRow } from "@/lib/supabase/mappers";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

export const dynamic = "force-dynamic";

function logProvidersRouteError(
  action: "list" | "create",
  accountId: string,
  error: unknown,
) {
  console.error(`[API /api/providers] ${action} failed`, { accountId }, error);
}

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    try {
      const rows = await listProviders(accountId);
      const data = rows.map((row) => mapProviderRow(row));
      return NextResponse.json({ data });
    } catch (error) {
      logProvidersRouteError("list", accountId, error);
      throw error;
    }
  })
);

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["inventory:adjust"])(async (request: NextRequest, { accountId, user }) => {
      try {
        const body = await request.json() as unknown;
        const parsed = createProviderInputSchema.parse(body);

        const contacts = parsed.contacts?.map((contact) => ({
          id: contact.id || crypto.randomUUID(),
          channel: contact.type,
          value: contact.value,
          is_primary: contact.isPrimary ?? false,
          is_verified: false,
          ...(contact.type === "facebook"
            ? {
                facebook_id: contact.facebookId,
                facebook_name: contact.facebookName,
              }
            : {}),
        })) ?? [];

        const result = await createProvider(accountId, {
          name: parsed.name,
          contacts: contacts as Record<string, unknown>[],
          tier: parsed.tier ?? "regular",
          reliability_score: Number((body as Record<string, unknown>).reliabilityScore ?? 100),
        });

        createActivityLog({
          account_id: accountId,
          action_type: "PROCUREMENT_UPDATED",
          created_by: user.email,
          details: {
            action: "provider_created",
            provider_id: result.id,
            provider_name: result.name,
          },
        }).catch(() => {});

        const data = mapProviderRow(result);
        return NextResponse.json({ data }, { status: 201 });
      } catch (error) {
        logProvidersRouteError("create", accountId, error);
        throw error;
      }
    })
  )
);
