// ============================================================
// INBOUND WEBHOOK → Sepay Auto Payment Integration
// Method: POST /api/webhooks/sepay
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { confirmAllocation } from "@/lib/services/allocation.service";
import { sendTelegramMessage } from "@/lib/utils/telegram";

// Khóa bảo mật webhook Sepay tự cấu hình trong biến môi trường
const SEPAY_WEBHOOK_SECRET = (
  process.env.SEPAY_WEBHOOK_SECRET ||
  process.env.WEBHOOK_LANDING_PAGE_SECRET || // Fallback nếu dùng chung key
  ""
).trim();

// Tránh xử lý đồng thời cùng một giao dịch
const processingLocks = new Set<string>();

interface SepayWebhookPayload {
  id: number;                  // ID giao dịch của Sepay
  gateway: string;             // Tên ngân hàng (ví dụ: MBBank)
  transactionDate: string;     // Ngày giao dịch
  accountNumber: string;       // Tài khoản nhận
  subAccount: string | null;
  transferType: "in" | "out";  // Loại giao dịch
  transferAmount: number;      // Số tiền giao dịch
  accumulated: number;         // Số dư sau giao dịch
  code: string | null;         // Mã giao dịch tự động phân tích bởi Sepay
  content: string;             // Nội dung chuyển khoản thực tế
  referenceCode: string;       // Mã tham chiếu ngân hàng
  body: string | null;
}

export async function POST(request: NextRequest) {
  // 1. Xác thực Webhook Secret
  const authHeader = request.headers.get("Authorization");
  let requestToken = "";
  if (authHeader && authHeader.startsWith("Apikey ")) {
    requestToken = authHeader.substring(7).trim();
  }

  // Nếu cấu hình token bảo mật, kiểm tra độ khớp
  if (SEPAY_WEBHOOK_SECRET && requestToken !== SEPAY_WEBHOOK_SECRET) {
    console.warn(`[Sepay Webhook] Unauthorized request. Token mismatch.`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let bodyText = "";
  let payload: SepayWebhookPayload;

  try {
    bodyText = await request.text();
    payload = JSON.parse(bodyText) as SepayWebhookPayload;
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // 2. Chỉ xử lý giao dịch TIỀN VÀO (transferType = "in")
  if (payload.transferType !== "in") {
    return NextResponse.json({ message: "Ignored out transaction" }, { status: 200 });
  }

  const transactionId = String(payload.id);

  // Khóa tránh xử lý trùng concurrent
  if (processingLocks.has(transactionId)) {
    return NextResponse.json({ error: "Concurrent request processing" }, { status: 409 });
  }
  processingLocks.add(transactionId);

  let logId = "";
  try {
    // 3. Kiểm tra Idempotency chống xử lý trùng (tránh cộng tiền 2 lần)
    const { data: existingLog } = await supabaseAdmin
      .from("webhook_logs")
      .select("id, status, order_id")
      .eq("provider", "sepay")
      .eq("external_transaction_id", transactionId)
      .maybeSingle();

    if (existingLog) {
      if (existingLog.status === "success") {
        return NextResponse.json({
          success: true,
          message: "Transaction already processed successfully",
          orderId: existingLog.order_id,
        }, { status: 200 });
      }
      // Nếu log cũ thất bại hoặc pending, ta ghi đè xử lý lại
      logId = existingLog.id;
    }

    // Lấy default account_id của hệ thống
    const defaultAccountId = process.env.ACCOUNT_ID ?? "550e8400-e29b-41d4-a716-446655440000";

    // Ghi nhận log webhook ở dạng pending nếu chưa có
    if (!logId) {
      const { data: newLog, error: logErr } = await supabaseAdmin
        .from("webhook_logs")
        .insert({
          account_id: defaultAccountId,
          provider: "sepay",
          external_transaction_id: transactionId,
          payload: payload as any,
          status: "pending",
          amount: payload.transferAmount,
        })
        .select("id")
        .single();
      
      if (logErr) throw logErr;
      logId = newLog.id;
    }

    // 4. Phân tích tìm mã đơn hàng trong content hoặc code
    const lookupText = `${payload.code || ""} ${payload.content || ""}`;
    const orderCodeMatch = lookupText.match(/DMH_[A-Z0-9]+_\d+/i);
    const matchedOrderCode = orderCodeMatch ? orderCodeMatch[0].toUpperCase() : null;

    if (!matchedOrderCode) {
      // Không tìm thấy mã đơn hàng -> Đánh dấu ignored và gửi Telegram cảnh báo nạp tiền thủ công
      await supabaseAdmin
        .from("webhook_logs")
        .update({
          status: "ignored",
          error_message: "Không tìm thấy mã đơn hàng hợp lệ trong nội dung chuyển khoản",
        })
        .eq("id", logId);

      // Gửi Telegram alert
      let tgMsg = `<b>⚠️ GIAO DỊCH CHƯA PHÂN LOẠI (SEPAY)</b>\n`;
      tgMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      tgMsg += `💰 <b>Số tiền:</b> <code>${payload.transferAmount.toLocaleString("vi-VN")} VND</code>\n`;
      tgMsg += `🏦 <b>Ngân hàng:</b> ${payload.gateway} (${payload.accountNumber})\n`;
      tgMsg += `📝 <b>Nội dung:</b> <i>${payload.content}</i>\n`;
      tgMsg += `⚠️ <b>Trạng thái:</b> Không tìm thấy mã đơn hàng phù hợp trong nội dung chuyển khoản. Vui lòng đối soát thủ công.\n`;
      tgMsg += `━━━━━━━━━━━━━━━━━━━━`;
      await sendTelegramMessage(tgMsg);

      return NextResponse.json({ message: "Order code not found in memo, logged as ignored" }, { status: 200 });
    }

    // 5. Tìm đơn hàng tương ứng trong DB
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, account_id, total_amount_vnd, total_paid, status, product_name_snapshot, customer_id")
      .eq("order_code", matchedOrderCode)
      .is("deleted_at", null)
      .maybeSingle();

    if (orderErr) throw orderErr;

    if (!order) {
      await supabaseAdmin
        .from("webhook_logs")
        .update({
          status: "failed",
          error_message: `Tìm thấy mã đơn ${matchedOrderCode} nhưng không tồn tại trong hệ thống`,
        })
        .eq("id", logId);

      let tgMsg = `<b>❌ LỖI ĐỐI SOÁT ĐƠN HÀNG (SEPAY)</b>\n`;
      tgMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      tgMsg += `📦 <b>Mã đơn tìm thấy:</b> <code>${matchedOrderCode}</code>\n`;
      tgMsg += `💰 <b>Số tiền:</b> <code>${payload.transferAmount.toLocaleString("vi-VN")} VND</code>\n`;
      tgMsg += `📝 <b>Nội dung:</b> <i>${payload.content}</i>\n`;
      tgMsg += `❌ <b>Lỗi:</b> Mã đơn hàng không tồn tại trên hệ thống.`;
      await sendTelegramMessage(tgMsg);

      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 6. Ghi nhận thanh toán vào bảng public.payments
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: order.id,
        amount: payload.transferAmount,
        payment_method: "sepay",
        note: `Tự động từ Sepay. GD: ${transactionId}. ND: ${payload.content}`,
        paid_by: "Sepay Autopay",
        paid_at: new Date(payload.transactionDate.replace(" ", "T")).toISOString(),
      })
      .select("id")
      .single();

    if (payErr) throw payErr;

    // 7. Cập nhật đơn hàng (cộng total_paid và chuyển status thành paid)
    const newTotalPaid = Number(order.total_paid || 0) + payload.transferAmount;
    const isFullyPaid = newTotalPaid >= Number(order.total_amount_vnd);
    const newStatus = isFullyPaid ? "paid" : order.status;

    const { error: updateOrderErr } = await supabaseAdmin
      .from("orders")
      .update({
        total_paid: newTotalPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateOrderErr) throw updateOrderErr;

    // 8. Tự động kích hoạt cấp phát tài khoản (nếu đơn hàng được trả đủ tiền và chuyển sang paid)
    let allocationSuccess = false;
    let allocationMsg = "";
    let inviteLink: string | null = null;
    let licenseKey: string | null = null;

    if (isFullyPaid) {
      try {
        const allocationResult = await confirmAllocation(order.id, order.account_id);
        allocationSuccess = allocationResult.suggestion.isValid;
        allocationMsg = allocationResult.message;

        if (allocationSuccess) {
          // Lấy invite link hoặc license key vừa cấp phát
          const { data: items } = await supabaseAdmin
            .from("order_items")
            .select("assigned_source_account_id")
            .eq("order_id", order.id)
            .limit(1);

          if (items && items.length > 0 && items[0].assigned_source_account_id) {
            const { data: secrets } = await supabaseAdmin
              .from("source_accounts")
              .select("credentials")
              .eq("id", items[0].assigned_source_account_id)
              .single();
            const joinLinkObj = (secrets?.credentials as any[])?.find(c => c.type === "link_join");
            inviteLink = joinLinkObj?.value ?? null;
          }

          const { data: keys } = await supabaseAdmin
            .from("license_keys")
            .select("key_code")
            .eq("order_id", order.id)
            .limit(1);
          if (keys && keys.length > 0) {
            licenseKey = keys[0].key_code;
          }
        }
      } catch (allocError) {
        console.error(`[Sepay Autopay] Allocation failed for order ${order.id}:`, allocError);
        allocationMsg = allocError instanceof Error ? allocError.message : "Allocation engine error";
      }
    }

    // 9. Cập nhật log webhook thành success
    await supabaseAdmin
      .from("webhook_logs")
      .update({
        status: "success",
        order_id: order.id,
      })
      .eq("id", logId);

    // 10. Gửi thông báo Telegram báo kết quả đối soát thành công
    let tgMsg = `<b>✅ THANH TOÁN TỰ ĐỘNG THÀNH CÔNG (SEPAY)</b>\n`;
    tgMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    tgMsg += `📦 <b>Mã đơn hàng:</b> <code>${order.order_code}</code>\n`;
    tgMsg += `💰 <b>Số tiền nạp:</b> <code>${payload.transferAmount.toLocaleString("vi-VN")} VND</code>\n`;
    tgMsg += `🏦 <b>Ngân hàng:</b> ${payload.gateway} (${payload.accountNumber})\n`;
    tgMsg += `📝 <b>Nội dung CK:</b> <i>${payload.content}</i>\n`;
    tgMsg += `💳 <b>Tổng đã thanh toán:</b> <code>${newTotalPaid.toLocaleString("vi-VN")} / ${order.total_amount_vnd.toLocaleString("vi-VN")} VND</code>\n`;
    tgMsg += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (isFullyPaid) {
      if (allocationSuccess) {
        tgMsg += `✅ <b>Kích hoạt tự động:</b> THÀNH CÔNG!\n`;
        if (inviteLink) tgMsg += `🔗 <b>Link nhận slot:</b> <code>${inviteLink}</code>\n`;
        if (licenseKey) tgMsg += `🔑 <b>License Key:</b> <code>${licenseKey}</code>\n`;
      } else {
        tgMsg += `⚠️ <b>Kích hoạt tự động:</b> THẤT BẠI (Cần xử lý thủ công!)\n`;
        tgMsg += `❌ <b>Lý do:</b> <i>${allocationMsg}</i>\n`;
      }
    } else {
      tgMsg += `ℹ️ <b>Trạng thái:</b> Thanh toán một phần đơn hàng. Cần đóng thêm tiền để kích hoạt.\n`;
    }
    
    await sendTelegramMessage(tgMsg);

    return NextResponse.json({
      success: true,
      message: "Webhook processed, payment logged successfully",
      orderId: order.id,
      allocated: allocationSuccess,
    }, { status: 200 });

  } catch (error) {
    console.error("[Sepay Webhook] Crash error:", error);
    
    // Ghi nhận lỗi vào log
    if (logId) {
      await supabaseAdmin
        .from("webhook_logs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown internal error",
        })
        .eq("id", logId);
    }

    // Alert crash Telegram
    await sendTelegramMessage(`<b>💥 LỖI HỆ THỐNG WEBHOOK SEPAY</b>\n\n<code>${error instanceof Error ? error.message : "Unknown error"}</code>`);

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal Server Error",
    }, { status: 500 });
  } finally {
    if (transactionId) {
      processingLocks.delete(transactionId);
    }
  }
}
