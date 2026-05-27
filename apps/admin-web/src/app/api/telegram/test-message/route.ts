import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { escapeHtml, resolveTelegramAdminChatId, sendTelegramMessage } from "@/lib/utils/telegram";

export const dynamic = "force-dynamic";

const TEST_MESSAGE_TITLE = "TELEGRAM TEST MESSAGE";

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (_request: NextRequest) => {
      const adminChatId = resolveTelegramAdminChatId();

      if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
        return NextResponse.json(
          { error: "TELEGRAM_BOT_TOKEN not configured" },
          { status: 500 },
        );
      }

      if (!adminChatId) {
        return NextResponse.json(
          { error: "TELEGRAM_ADMIN_CHAT_ID or TELEGRAM_CHAT_ID not configured" },
          { status: 500 },
        );
      }

      const now = new Date();
      const message = [
        `<b>${TEST_MESSAGE_TITLE}</b>`,
        `- Time: ${escapeHtml(now.toISOString())}`,
        `- Admin chat: <code>${escapeHtml(adminChatId)}</code>`,
        `- Source: <code>/api/telegram/test-message</code>`,
      ].join("\n");

      const result = await sendTelegramMessage(message, {
        chatId: adminChatId,
        disableNotification: false,
      });

      if (result === false) {
        return NextResponse.json(
          { error: "Telegram send failed" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        messageId: result,
        chatId: adminChatId,
        message: "Test message sent to Telegram admin chat",
        sentAt: now.toISOString(),
      });
    }),
  ),
);
