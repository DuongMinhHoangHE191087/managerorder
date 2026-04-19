import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import { DEFAULT_REMINDER_CONFIG, normalizeReminderConfig } from "@/lib/bot-manager/reminder-config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const { data, error } = await supabaseAdmin
      .from("reminder_config")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return createSuccessResponse(data ? normalizeReminderConfig(data) : DEFAULT_REMINDER_CONFIG);
  }),
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const normalizedBody = normalizeReminderConfig(body);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("reminder_config")
      .select("id")
      .eq("account_id", accountId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("reminder_config")
        .update({ ...normalizedBody, account_id: accountId })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      createActivityLog({
        account_id: accountId,
        action_type: "REMINDER_CONFIG_UPDATED",
        details: {
          channel: normalizedBody.channel,
          auto_send: normalizedBody.auto_send,
        },
      }).catch(() => {});

      return createSuccessResponse(normalizeReminderConfig(data));
    }

    const { data, error } = await supabaseAdmin
      .from("reminder_config")
      .insert({ ...normalizedBody, account_id: accountId })
      .select()
      .single();

    if (error) throw new Error(error.message);

    createActivityLog({
      account_id: accountId,
      action_type: "REMINDER_CONFIG_CREATED",
      details: {
        channel: normalizedBody.channel,
        auto_send: normalizedBody.auto_send,
      },
    }).catch(() => {});

    return createSuccessResponse(normalizeReminderConfig(data), { status: 201 });
  }),
);
