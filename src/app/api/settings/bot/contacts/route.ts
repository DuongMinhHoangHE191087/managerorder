import { withAccount } from "@/lib/api/with-account";
import { createErrorResponse, createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { listBotUserContacts, updateBotUserContact } from "@/lib/bot-manager/bot-contacts";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BotUserContactChannel } from "@/lib/domain/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function parseMatched(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get("channel") as BotUserContactChannel | null;
    const search = searchParams.get("search") ?? undefined;
    const matched = parseMatched(searchParams.get("matched"));
    const limit = Number(searchParams.get("limit") ?? 100);

    const data = await listBotUserContacts(accountId, {
      channel: channel === "telegram" || channel === "zalo" ? channel : undefined,
      search,
      matched,
      limit,
    });

    return createSuccessResponse(data);
  }),
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const contactId = typeof body.contactId === "string" ? body.contactId : "";

    if (!contactId) {
      return createErrorResponse("Thiếu contactId", "VALIDATION_ERROR", 400);
    }

    const updates: { customerId?: string | null; autoReminderEnabled?: boolean } = {};

    if ("customerId" in body) {
      const customerId = typeof body.customerId === "string" && body.customerId.trim() ? body.customerId.trim() : null;
      if (customerId) {
        const { data: customer, error } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("id", customerId)
          .eq("account_id", accountId)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!customer) {
          return createErrorResponse("Khách hàng không thuộc tenant hiện tại", "NOT_FOUND", 404);
        }
      }
      updates.customerId = customerId;
    }

    if (typeof body.autoReminderEnabled === "boolean") {
      updates.autoReminderEnabled = body.autoReminderEnabled;
    }

    if (Object.keys(updates).length === 0) {
      return createErrorResponse("Không có thay đổi hợp lệ", "VALIDATION_ERROR", 400);
    }

    const data = await updateBotUserContact(accountId, contactId, updates);

    createActivityLog({
      account_id: accountId,
      action_type: "BOT_CONTACT_UPDATED",
      customer_id: data.customerId ?? null,
      details: {
        channel: data.channel,
        external_user_id: data.externalUserId,
        auto_reminder_enabled: data.autoReminderEnabled,
        matched_customer_id: data.customerId ?? null,
      },
    }).catch(() => {});

    return createSuccessResponse(data);
  }),
);
