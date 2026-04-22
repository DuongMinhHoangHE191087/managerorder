import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 4000;

export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["settings:write"])(async (request: NextRequest, { accountId: _accountId, user: _user }) => {
      const { message } = await request.json();
      if (!message || typeof message !== "string" || message.trim() === "") {
        return NextResponse.json({ error: "Message is required" }, { status: 400 });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

      if (!botToken || !adminChatId) {
        return NextResponse.json(
          { error: "Bot token or Admin Chat ID not configured" },
          { status: 500 }
        );
      }

      const trimmedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: trimmedMessage,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Telegram API Error: ${errorText}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Đã gửi Broadcast thành công!" });
    })
  )
);
