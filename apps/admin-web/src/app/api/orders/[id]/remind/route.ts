import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { hasPermission, resolveUser } from "@/lib/api/rbac";
import { formatMoney } from "@/lib/utils";

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const user = await resolveUser(request, accountId);
    if (!user) {
      return NextResponse.json({ error: "Không thể xác thực người dùng" }, { status: 401 });
    }
    if (!hasPermission(user.role, "order:update")) {
      return NextResponse.json({ error: "Bạn không có quyền gửi nhắc hạn đơn hàng" }, { status: 403 });
    }

    const { channel, emailAddress } = (await request.json()) as {
      channel: string;
      emailAddress: string;
    };

    if (channel !== "email") {
      return NextResponse.json({ error: "Kênh nhắc hạn không hỗ trợ" }, { status: 400 });
    }

    if (!emailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
    }

    // 1. Fetch order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, customer_id, product_name_snapshot, total_amount_vnd, total_paid, expires_at, status")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    // 2. Fetch customer details
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("full_name")
      .eq("id", order.customer_id)
      .eq("account_id", accountId)
      .single();

    const customerName = customer?.full_name || "Khách hàng";
    const productName = order.product_name_snapshot || "Dịch vụ";
    const orderCode = order.order_code || `ORD-${order.id.slice(0, 8).toUpperCase()}`;
    const debtAmount = Math.max(order.total_amount_vnd - (order.total_paid ?? 0), 0);
    const formattedExpiry = order.expires_at
      ? new Date(order.expires_at).toLocaleDateString("vi-VN")
      : "chưa xác định";

    // 3. Fetch reminder configuration templates
    const { data: config } = await supabaseAdmin
      .from("reminder_config")
      .select("template_renewal, template_debt")
      .eq("account_id", accountId)
      .single();

    const templateRenewal =
      config?.template_renewal ||
      "Xin chào {customer_name}, dịch vụ {product_name} sẽ hết hạn vào {expiry_date}. Vui lòng gia hạn sớm!";
    const templateDebt =
      config?.template_debt ||
      "Xin chào {customer_name}, bạn đang có công nợ {debt_amount} cần thanh toán trước {due_date}.";

    // 4. Render template
    const template = debtAmount > 0 ? templateDebt : templateRenewal;
    const renderedMsg = template
      .replace(/{customer_name}/g, customerName)
      .replace(/{product_name}/g, productName)
      .replace(/{expiry_date}/g, formattedExpiry)
      .replace(/{debt_amount}/g, formatMoney(debtAmount))
      .replace(/{balance_due}/g, formatMoney(debtAmount))
      .replace(/{order_code}/g, orderCode)
      .replace(/{order_status}/g, order.status)
      .replace(/{due_date}/g, formattedExpiry);

    // 5. Check SMTP Settings
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn("[SMTP NOT CONFIGURED] Logging failure but returning clean status for local dev.");
      
      // Save logs as failed
      await supabaseAdmin.from("reminder_logs").insert({
        account_id: accountId,
        order_id: order.id,
        customer_id: order.customer_id,
        reminder_type: debtAmount > 0 ? "manual_debt" : "manual_renewal",
        channel: "email",
        status: "failed",
        message_content: renderedMsg,
        error_message: "SMTP credentials not found in environment settings",
        sent_at: new Date().toISOString(),
      });

      return NextResponse.json({ error: "SMTP_NOT_CONFIGURED" }, { status: 400 });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: emailAddress,
        subject: `Nhắc hạn dịch vụ: ${productName} (${orderCode})`,
        text: renderedMsg,
        html: renderedMsg.replace(/\n/g, "<br/>"),
      });

      // Save logs as success
      await supabaseAdmin.from("reminder_logs").insert({
        account_id: accountId,
        order_id: order.id,
        customer_id: order.customer_id,
        reminder_type: debtAmount > 0 ? "manual_debt" : "manual_renewal",
        channel: "email",
        status: "sent",
        message_content: renderedMsg,
        sent_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true });
    } catch (mailError: unknown) {
      const errMsg = mailError instanceof Error ? mailError.message : String(mailError);
      console.error("[SMTP ERROR]", mailError);

      await supabaseAdmin.from("reminder_logs").insert({
        account_id: accountId,
        order_id: order.id,
        customer_id: order.customer_id,
        reminder_type: debtAmount > 0 ? "manual_debt" : "manual_renewal",
        channel: "email",
        status: "failed",
        message_content: renderedMsg,
        error_message: errMsg,
        sent_at: new Date().toISOString(),
      });

      return NextResponse.json({ error: "SMTP_SEND_FAILED", details: errMsg }, { status: 500 });
    }
  })
);
