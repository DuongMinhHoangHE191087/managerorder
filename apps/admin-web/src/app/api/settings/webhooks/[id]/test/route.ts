import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { withAccount } from "@/lib/api/with-account";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signPayload, validateWebhookUrl } from "@/lib/services/event-bus.service";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const TEST_EVENT_TYPE = "webhook.test";
const TEST_TIMEOUT_MS = 10_000;

type WebhookEndpointRow = {
  id: string;
  url: string;
  secret: string;
  is_active: boolean;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
};

function buildTestPayload(accountId: string, webhookId: string, url: string) {
  const timestamp = new Date().toISOString();
  return {
    event_type: TEST_EVENT_TYPE,
    timestamp,
    account_id: accountId,
    data: {
      webhook_id: webhookId,
      url,
      source: "settings.webhooks",
      test: true,
    },
  };
}

async function updateEventStatus(
  eventId: string,
  accountId: string,
  endpointId: string,
  payload: Record<string, unknown>,
  actorEmail: string,
  status: "delivered" | "failed",
  response: {
    code?: number | null;
    body?: string | null;
    error?: string | null;
  },
  nextFailureCount: number,
) {
  await supabaseAdmin
    .from("webhook_events")
    .update({
      status,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
      response_status: response.code ?? null,
      response_body: response.body ?? null,
      error_message: response.error ?? null,
    })
    .eq("id", eventId)
    .eq("account_id", accountId)
    .eq("endpoint_id", endpointId);

  await supabaseAdmin
    .from("webhook_endpoints")
    .update(
      status === "delivered"
        ? {
            consecutive_failures: 0,
            last_success_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : {
            consecutive_failures: nextFailureCount,
            last_failure_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
    )
    .eq("id", endpointId)
    .eq("account_id", accountId);

  await createActivityLog({
    account_id: accountId,
    action_type: "SETTINGS_UPDATED",
    created_by: actorEmail,
    details: {
      action: status === "delivered" ? "webhook_test_delivered" : "webhook_test_failed",
      webhook_id: endpointId,
      webhook_event_id: eventId,
      response_status: response.code ?? null,
      error: response.error ?? null,
      payload,
    },
  }).catch(() => {});
}

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (_request: NextRequest, { accountId, params, user }) => {
      const resolvedParams = await params;
      const webhookId = String((resolvedParams as { id?: string } | null | undefined)?.id ?? "").trim();

      if (!webhookId) {
        return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
      }

      const { data: endpoint, error } = await supabaseAdmin
        .from("webhook_endpoints")
        .select("id, url, secret, is_active, consecutive_failures, last_success_at, last_failure_at")
        .eq("id", webhookId)
        .eq("account_id", accountId)
        .single<WebhookEndpointRow>();

      if (error || !endpoint) {
        return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
      }

      const urlValidation = validateWebhookUrl(endpoint.url);
      if (!urlValidation.valid) {
        return NextResponse.json({ error: urlValidation.error ?? "Invalid webhook URL" }, { status: 400 });
      }

      const payload = buildTestPayload(accountId, endpoint.id, endpoint.url);
      const payloadString = JSON.stringify(payload);
      const signature = signPayload(payloadString, endpoint.secret);
      const eventTimestamp = new Date().toISOString();

      const { data: eventRow, error: eventError } = await supabaseAdmin
        .from("webhook_events")
        .insert({
          account_id: accountId,
          endpoint_id: endpoint.id,
          event_type: TEST_EVENT_TYPE,
          payload,
          status: "pending",
          attempts: 0,
          max_attempts: 1,
        })
        .select("id")
        .single<{ id: string }>();

      if (eventError || !eventRow?.id) {
        throw new Error(eventError?.message ?? "Failed to create webhook test event");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
      const startedAt = Date.now();

      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": `sha256=${signature}`,
            "X-Webhook-Event": TEST_EVENT_TYPE,
            "X-Webhook-Timestamp": eventTimestamp,
            "X-Webhook-Id": eventRow.id,
            "X-Webhook-Test": "true",
            "User-Agent": "ManagerOrder-Webhook-Test/1.0",
          },
          body: payloadString,
          signal: controller.signal,
        });

        const responseBody = await response.text().catch(() => "");
        const responseTimeMs = Date.now() - startedAt;

        if (response.ok) {
          await updateEventStatus(eventRow.id, accountId, endpoint.id, payload, user.email, "delivered", {
            code: response.status,
            body: responseBody.slice(0, 500),
          }, 0);

          return createSuccessResponse({
            ok: true,
            webhookId: endpoint.id,
            eventId: eventRow.id,
            responseStatus: response.status,
            responseTimeMs,
            responsePreview: responseBody.slice(0, 200),
          });
        }

        await updateEventStatus(eventRow.id, accountId, endpoint.id, payload, user.email, "failed", {
          code: response.status,
          body: responseBody.slice(0, 500),
          error: `HTTP ${response.status}`,
        }, endpoint.consecutive_failures + 1);

        return createSuccessResponse(
          {
            ok: false,
            webhookId: endpoint.id,
            eventId: eventRow.id,
            responseStatus: response.status,
            responseTimeMs,
            responsePreview: responseBody.slice(0, 200),
          },
          { status: 502 }
        );
      } catch (error) {
        const responseTimeMs = Date.now() - startedAt;
        const message =
          error instanceof Error && error.name === "AbortError"
            ? "Timeout (10s)"
            : error instanceof Error
              ? error.message
              : "Unknown webhook delivery error";

        await updateEventStatus(eventRow.id, accountId, endpoint.id, payload, user.email, "failed", {
          error: message,
        }, endpoint.consecutive_failures + 1);

        return createSuccessResponse(
          {
            ok: false,
            webhookId: endpoint.id,
            eventId: eventRow.id,
            responseStatus: null,
            responseTimeMs,
            error: message,
          },
          { status: 502 }
        );
      } finally {
        clearTimeout(timeout);
      }
    })
  )
);
