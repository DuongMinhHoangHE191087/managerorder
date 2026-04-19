import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import type { Webhook } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const mapToWebhook = (db: Record<string, unknown>): Webhook => {
  const lastSuccessAt = db.last_success_at ? new Date(String(db.last_success_at)) : null;
  const lastFailureAt = db.last_failure_at ? new Date(String(db.last_failure_at)) : null;
  const lastTrigger =
    lastSuccessAt && (!lastFailureAt || lastSuccessAt >= lastFailureAt)
      ? db.last_success_at
      : db.last_failure_at;

  return {
    id: String(db.id),
    url: String(db.url),
    events: (db.events as Webhook["events"]) ?? [],
    status: !db.is_active ? "inactive" : (Number(db.consecutive_failures ?? 0) >= 10 ? "failed" : "active"),
    created_at: String(db.created_at),
    last_triggered_at: lastTrigger ? String(lastTrigger) : undefined,
    failure_count: Number(db.consecutive_failures ?? 0),
  };
};

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const { data, error } = await supabaseAdmin
      .from("webhook_endpoints")
      .select("id, url, events, is_active, consecutive_failures, created_at, last_success_at, last_failure_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return createSuccessResponse((data ?? []).map((row) => mapToWebhook(row as Record<string, unknown>)));
  })
);

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest, { accountId, user }) => {
      const body = await request.json();
      const secret = `whsec_${randomBytes(24).toString("hex")}`;

      const { data, error } = await supabaseAdmin
        .from("webhook_endpoints")
        .insert({
          url: body.url,
          events: body.events ?? [],
          is_active: true,
          secret,
          account_id: accountId,
          consecutive_failures: 0,
        })
        .select("id, url, events, is_active, consecutive_failures, created_at, last_success_at, last_failure_at");

      if (error) throw new Error(error.message);
      if (!data?.[0]) throw new Error("Failed to create webhook");

      createActivityLog({
        account_id: accountId,
        action_type: "SETTINGS_UPDATED",
        created_by: user.email,
        details: {
          action: "webhook_created",
          webhook_id: data?.[0]?.id ?? null,
          url: body.url,
        },
      }).catch(() => {});

      return createSuccessResponse(
        {
          ...mapToWebhook(data?.[0] as Record<string, unknown>),
          secret,
        },
        { status: 201 }
      );
    })
  )
);

export const PUT = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest, { accountId, user }) => {
      const body = await request.json();
      const { id, status, failure_count: _failure, last_triggered_at: _last, ...updateData } = body;

      const dbUpdate: Record<string, unknown> = { ...updateData };
      if (status !== undefined) {
        dbUpdate.is_active = status === "active";
        if (status === "active") dbUpdate.consecutive_failures = 0;
      }

      const { data, error } = await supabaseAdmin
        .from("webhook_endpoints")
        .update(dbUpdate)
        .eq("id", id)
        .eq("account_id", accountId)
        .select("id, url, events, is_active, consecutive_failures, created_at, last_success_at, last_failure_at");

      if (error) throw new Error(error.message);
      if (!data?.[0]) throw new Error("Failed to update webhook");

      createActivityLog({
        account_id: accountId,
        action_type: "SETTINGS_UPDATED",
        created_by: user.email,
        details: {
          action: "webhook_updated",
          webhook_id: id,
          status: status ?? null,
        },
      }).catch(() => {});

      return createSuccessResponse(mapToWebhook(data?.[0] as Record<string, unknown>));
    })
  )
);

export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest, { accountId, user }) => {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");

      if (!id) {
        return createSuccessResponse(null, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from("webhook_endpoints")
        .delete()
        .eq("id", id)
        .eq("account_id", accountId);

      if (error) throw new Error(error.message);

      createActivityLog({
        account_id: accountId,
        action_type: "SETTINGS_UPDATED",
        created_by: user.email,
        details: {
          action: "webhook_deleted",
          webhook_id: id,
        },
      }).catch(() => {});

      return createSuccessResponse({ deleted: true });
    })
  )
);
