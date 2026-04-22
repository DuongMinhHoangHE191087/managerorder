import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { validateWebhookUrl } from "@/lib/services/event-bus.service";
import type { Webhook, WebhookEvent, WebhookStatus } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const VALID_WEBHOOK_EVENTS: WebhookEvent[] = [
  "order.created",
  "order.updated",
  "order.paid",
  "order.expired",
  "customer.created",
  "inventory.allocated",
  "payment.received",
];

const VALID_WEBHOOK_STATUSES: WebhookStatus[] = ["active", "inactive", "failed"];

function normalizeWebhookEvents(events: unknown): WebhookEvent[] | null {
  if (!Array.isArray(events)) return null;
  const normalized = events.filter((event): event is WebhookEvent =>
    typeof event === "string" && VALID_WEBHOOK_EVENTS.includes(event as WebhookEvent)
  );
  return normalized.length > 0 ? normalized : [];
}

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
      const url = typeof body.url === "string" ? body.url.trim() : "";
      const urlValidation = validateWebhookUrl(url);
      const events = normalizeWebhookEvents(body.events);
      const description = typeof body.description === "string" ? body.description.trim() : null;

      if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
      }
      if (!urlValidation.valid) {
        return NextResponse.json({ error: urlValidation.error ?? "Invalid webhook URL" }, { status: 400 });
      }
      if (!events || events.length === 0) {
        return NextResponse.json({ error: "At least one valid event type is required" }, { status: 400 });
      }

      const { count: endpointCount } = await supabaseAdmin
        .from("webhook_endpoints")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      if ((endpointCount ?? 0) >= 5) {
        return NextResponse.json({ error: "Maximum 5 webhooks per account" }, { status: 400 });
      }

      const secret = `whsec_${randomBytes(24).toString("hex")}`;

      const { data, error } = await supabaseAdmin
        .from("webhook_endpoints")
        .insert({
          url,
          events,
          is_active: true,
          secret,
          account_id: accountId,
          consecutive_failures: 0,
          description,
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

      if (typeof dbUpdate.url === "string") {
        const url = dbUpdate.url.trim();
        const urlValidation = validateWebhookUrl(url);
        if (!urlValidation.valid) {
          return NextResponse.json({ error: urlValidation.error ?? "Invalid webhook URL" }, { status: 400 });
        }
        dbUpdate.url = url;
      }

      if ("events" in dbUpdate) {
        const normalized = normalizeWebhookEvents(dbUpdate.events);
        if (!normalized || normalized.length === 0) {
          return NextResponse.json({ error: "At least one valid event type is required" }, { status: 400 });
        }
        dbUpdate.events = normalized;
      }

      if (status !== undefined) {
        if (!VALID_WEBHOOK_STATUSES.includes(status)) {
          return NextResponse.json({ error: "Invalid webhook status" }, { status: 400 });
        }
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
        return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
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
