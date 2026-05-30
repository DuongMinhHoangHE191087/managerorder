import { withAccount } from "@/lib/api/with-account";
import { createErrorResponse, createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/utils/telegram";
import { sendZaloTextMessage } from "@/lib/zalo/outbound";
import { listCustomerZaloReminderTargets } from "@/lib/bot-manager/bot-contacts";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withAccount(async (request, { accountId }) => {
    const body = await request.json();
    const { orderId, channel, message, tier } = body as {
      orderId: string;
      channel: "telegram" | "zalo";
      message: string;
      tier: "T-7" | "T-3" | "T-1" | "EXPIRED";
    };

    if (!orderId || !channel || !message || !tier) {
      return createErrorResponse("Thiếu thông tin yêu cầu", "VALIDATION_ERROR", 400);
    }

    // 1. Lấy thông tin đơn hàng để kiểm tra quyền và lấy customer_id
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, customer_id, product_name_snapshot, total_amount_vnd, total_paid, expires_at, status")
      .eq("id", orderId)
      .eq("account_id", accountId)
      .single();

    if (orderErr || !order) {
      return createErrorResponse("Không tìm thấy đơn hàng", "NOT_FOUND", 404);
    }

    let sent = false;
    let errorDetail = "";

    try {
      if (channel === "telegram") {
        // Gửi thông báo Telegram (nội bộ hoặc bot admin)
        sent = !!(await sendTelegramMessage(message));
        if (!sent) errorDetail = "Telegram API returned false";
      } else if (channel === "zalo") {
        // Gửi Zalo OA trực tiếp cho khách hàng
        const targets = await listCustomerZaloReminderTargets(accountId, order.customer_id);
        const target = targets[0];

        if (target?.chatId) {
          sent = !!(await sendZaloTextMessage(target.chatId, message));
          if (!sent) errorDetail = "Zalo API returned false";
        } else {
          return createErrorResponse(
            "Khách hàng chưa liên kết tài khoản Zalo hoặc không có Zalo Chat ID",
            "TARGET_NOT_FOUND",
            400
          );
        }
      } else {
        return createErrorResponse("Kênh nhắc nhở không hỗ trợ", "VALIDATION_ERROR", 400);
      }

      // 2. Ghi nhận nhật ký nhắc nhở vào database
      await supabaseAdmin.from("reminder_logs").insert({
        account_id: accountId,
        order_id: order.id,
        customer_id: order.customer_id,
        reminder_type: tier,
        channel,
        status: sent ? "sent" : "failed",
        message_content: message,
        error_message: sent ? null : errorDetail || "Gửi thất bại",
        sent_at: new Date().toISOString(),
      });

      if (!sent) {
        return createErrorResponse(`Gửi thất bại qua ${channel}: ${errorDetail}`, "SEND_FAILED", 500);
      }

      return createSuccessResponse({ success: true, message: `Đã gửi nhắc nhở thành công qua ${channel}` });

    } catch (err: any) {
      console.error("[Send Reminder API] Error:", err);
      
      // Log failure
      await supabaseAdmin.from("reminder_logs").insert({
        account_id: accountId,
        order_id: order.id,
        customer_id: order.customer_id,
        reminder_type: tier,
        channel,
        status: "failed",
        message_content: message,
        error_message: err.message || "Crash error",
        sent_at: new Date().toISOString(),
      });

      return createErrorResponse(err.message || "Lỗi máy chủ nội bộ", "INTERNAL_ERROR", 500);
    }
  }),
);
