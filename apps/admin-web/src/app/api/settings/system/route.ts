import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { createTenantQuery } from "@/lib/supabase/tenant-client";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_SYSTEM_SETTINGS, normalizeSystemSettings } from "@/lib/settings/system-settings";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type SystemSettingsRow = Database["public"]["Tables"]["system_settings"]["Row"];

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, context: { accountId: string }) => {
    const accountId = context.accountId;
    const tenantQuery = createTenantQuery(accountId);

    const { data, error } = await tenantQuery
      .from("system_settings")
      .select("*")
      .limit(1);

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      return createSuccessResponse(DEFAULT_SYSTEM_SETTINGS);
    }

    const firstRow = data[0] as unknown as SystemSettingsRow | undefined;
    return createSuccessResponse(normalizeSystemSettings(firstRow ?? null));
  })
);

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest, context: { accountId: string; user: { email: string } }) => {
      const accountId = context.accountId;
      const body = normalizeSystemSettings(await request.json());
      const tenantQuery = createTenantQuery(accountId);

      const { data: existing, error: readError } = await tenantQuery
        .from("system_settings")
        .select("id")
        .limit(1);

      if (readError) throw new Error(readError.message);

      let savedRow: SystemSettingsRow | null = null;

      if (existing && existing.length > 0) {
        const existingRow = existing[0];
        const existingId =
          existingRow && typeof existingRow === "object" && "id" in existingRow
            ? (existingRow as { id: string }).id
            : null;

        if (!existingId) {
          throw new Error("system_settings row is missing id");
        }

        const { data, error } = await tenantQuery
          .from("system_settings")
          .update({ ...body })
          .eq("id", existingId)
          .select();

        if (error) throw new Error(error.message);
        savedRow = (data?.[0] as unknown as SystemSettingsRow | undefined) ?? null;
      } else {
        const { data, error } = await tenantQuery
          .from("system_settings")
          .insert({ ...body })
          .select();

        if (error) throw new Error(error.message);
        savedRow = (data?.[0] as unknown as SystemSettingsRow | undefined) ?? null;
      }

      createActivityLog({
        account_id: accountId,
        action_type: "SETTINGS_UPDATED",
        created_by: context.user.email,
        details: {
          module: "system_settings",
          locale: body.locale,
          timezone: body.timezone,
          currency: body.default_currency,
        },
      }).catch(() => {});

      return createSuccessResponse(normalizeSystemSettings(savedRow), {
        status: existing && existing.length > 0 ? 200 : 201,
      });
    })
  )
);
