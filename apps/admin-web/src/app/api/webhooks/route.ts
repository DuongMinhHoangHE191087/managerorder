// ============================================================
// WEBHOOK MANAGEMENT API — legacy CRUD wrapper
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateWebhookUrl, generateWebhookSecret, ALL_EVENT_TYPES } from "@/lib/services/event-bus.service";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest, { accountId, user: _user }) => {
      try {
        const body = await request.json();
        const { url, events, description } = body;

        if (!url || typeof url !== "string") {
          return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        const urlValidation = validateWebhookUrl(url);
        if (!urlValidation.valid) {
          return NextResponse.json({ error: urlValidation.error }, { status: 400 });
        }

        const validEvents = Array.isArray(events)
          ? events.filter((e: string) => ALL_EVENT_TYPES.includes(e as typeof ALL_EVENT_TYPES[number]))
          : ALL_EVENT_TYPES;

        if (validEvents.length === 0) {
          return NextResponse.json({ error: "At least one valid event type is required" }, { status: 400 });
        }

        const { count } = await supabaseAdmin
          .from("webhook_endpoints")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId);

        if ((count ?? 0) >= 5) {
          return NextResponse.json({ error: "Maximum 5 webhooks per account" }, { status: 400 });
        }

        const secret = generateWebhookSecret();
        const { data, error } = await supabaseAdmin
          .from("webhook_endpoints")
          .insert({
            account_id: accountId,
            url,
            secret,
            events: validEvents,
            description: description ?? null,
            is_active: true,
            consecutive_failures: 0,
          })
          .select("id, url, events, is_active, description, created_at")
          .single();

        if (error) throw error;

        return NextResponse.json({
          ...data,
          secret,
          message: "Webhook created. Save the secret - it will not be shown again.",
        }, { status: 201 });
      } catch (error) {
        console.error("[Webhook API] Create error:", error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Internal error" },
          { status: 500 }
        );
      }
    })
  )
);

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("webhook_endpoints")
        .select("id, url, events, is_active, description, consecutive_failures, last_success_at, last_failure_at, created_at, updated_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return NextResponse.json({ endpoints: data ?? [] });
    } catch (error) {
      console.error("[Webhook API] List error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal error" },
        { status: 500 }
      );
    }
  })
);

export const PATCH = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest, { accountId, user: _user }) => {
      try {
        const body = await request.json();
        const { id, url, events, is_active, description } = body;

        if (!id) {
          return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (url !== undefined) {
          const urlValidation = validateWebhookUrl(url);
          if (!urlValidation.valid) {
            return NextResponse.json({ error: urlValidation.error }, { status: 400 });
          }
          updates.url = url;
        }

        if (events !== undefined) {
          const validEvents = events.filter((e: string) => ALL_EVENT_TYPES.includes(e as typeof ALL_EVENT_TYPES[number]));
          if (validEvents.length === 0) {
            return NextResponse.json({ error: "At least one valid event type is required" }, { status: 400 });
          }
          updates.events = validEvents;
        }

        if (is_active !== undefined) {
          updates.is_active = Boolean(is_active);
          if (is_active) {
            updates.consecutive_failures = 0;
          }
        }

        if (description !== undefined) {
          updates.description = description;
        }

        const { data, error } = await supabaseAdmin
          .from("webhook_endpoints")
          .update(updates)
          .eq("id", id)
          .eq("account_id", accountId)
          .select("id, url, events, is_active, description, updated_at")
          .single();

        if (error) throw error;
        if (!data) {
          return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
        }

        return NextResponse.json(data);
      } catch (error) {
        console.error("[Webhook API] Update error:", error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Internal error" },
          { status: 500 }
        );
      }
    })
  )
);

export const DELETE = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest, { accountId, user: _user }) => {
      try {
        const { searchParams } = request.nextUrl;
        const id = searchParams.get("id");

        if (!id) {
          return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
          .from("webhook_endpoints")
          .delete()
          .eq("id", id)
          .eq("account_id", accountId);

        if (error) throw error;

        return NextResponse.json({ success: true, deleted: id });
      } catch (error) {
        console.error("[Webhook API] Delete error:", error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Internal error" },
          { status: 500 }
        );
      }
    })
  )
);
