import { withAccount } from "@/lib/api/with-account";
import { createSuccessResponse, withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatDateKey, addDaysToDateKey } from "@/lib/utils";
import { getReminderConfig, buildReminderTemplateContext, renderReminderTemplate } from "@/lib/bot-manager/reminder-config";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request, { accountId }) => {
    const todayKey = formatDateKey(new Date());
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    // Nhìn trước 10 ngày để chuẩn bị nhắc nhở
    const maxTargetKey = addDaysToDateKey(todayKey, 10);

    // 1. Lấy danh sách các đơn hàng sắp hết hạn
    const { data: rawOrders, error: ordersErr } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_code,
        customer_id,
        product_name_snapshot,
        total_amount_vnd,
        total_paid,
        expires_at,
        status
      `)
      .eq("account_id", accountId)
      .in("status", ["active", "expired"])
      .is("deleted_at", null)
      .gte("expires_at", `${yesterdayKey}T00:00:00+07:00`)
      .lte("expires_at", `${maxTargetKey}T23:59:59+07:00`);

    if (ordersErr) throw ordersErr;

    const orders = rawOrders || [];

    if (orders.length === 0) {
      return createSuccessResponse([]);
    }

    // 2. Lấy thông tin khách hàng liên quan
    const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))];
    let customers: any[] = [];
    if (customerIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("customers")
        .select("id, full_name, phone")
        .in("id", customerIds);
      if (!error && data) customers = data;
    }
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // 3. Lấy thông tin liên kết Zalo/Telegram Bot của các khách hàng này
    let botContacts: any[] = [];
    if (customerIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("bot_user_contacts")
        .select("id, customer_id, channel, display_name, external_user_id, auto_reminder_enabled")
        .in("customer_id", customerIds)
        .eq("account_id", accountId);
      if (!error && data) botContacts = data;
    }

    // Group bot contacts by customerId
    const botContactsMap = new Map<string, any[]>();
    for (const contact of botContacts) {
      if (!contact.customer_id) continue;
      const list = botContactsMap.get(contact.customer_id) || [];
      list.push(contact);
      botContactsMap.set(contact.customer_id, list);
    }

    // 4. Lấy cấu hình nhắc hẹn chung của tài khoản
    const config = await getReminderConfig(accountId);

    // 5. Kiểm tra lịch sử nhắc hẹn trong ngày hôm nay (tránh gửi trùng)
    const todayStart = `${todayKey}T00:00:00`;
    const { data: rawSentLogs } = await supabaseAdmin
      .from("reminder_logs")
      .select("order_id, reminder_type, channel")
      .eq("account_id", accountId)
      .gte("sent_at", todayStart);

    const sentLogs = rawSentLogs || [];

    const sentSet = new Set<string>();
    for (const log of sentLogs) {
      // Key format: orderId_tier_channel
      sentSet.add(`${log.order_id}_${log.reminder_type}_${log.channel}`);
    }

    // 6. Build danh sách nhắc nhở chi tiết
    const upcomingReminders = [];
    const now = new Date();

    for (const order of orders) {
      if (!order.expires_at) continue;

      const expiryDate = new Date(order.expires_at);
      const diffTime = expiryDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Xác định tier nhắc nhở dựa theo số ngày còn lại
      let tier: "T-7" | "T-3" | "T-1" | "EXPIRED" | null = null;
      if (order.status === "expired" || daysLeft <= 0) {
        tier = "EXPIRED";
      } else if (daysLeft === 1) {
        tier = "T-1";
      } else if (daysLeft === 3) {
        tier = "T-3";
      } else if (daysLeft === 7) {
        tier = "T-7";
      }

      // Nếu không khớp các mốc ngày nhắc mặc định thì có thể bỏ qua hoặc đưa vào hàng chờ
      // Ở đây ta hiển thị tất cả các mốc để admin tiện chủ động nhắc nhở thủ công, 
      // Nhưng mặc định tier sẽ là mốc gần nhất.
      const resolvedTier = tier || (daysLeft <= 0 ? "EXPIRED" : daysLeft <= 2 ? "T-1" : daysLeft <= 5 ? "T-3" : "T-7");

      const customer = customerMap.get(order.customer_id);
      const contacts = botContactsMap.get(order.customer_id) || [];

      const hasTelegram = contacts.some((c) => c.channel === "telegram");
      const hasZalo = contacts.some((c) => c.channel === "zalo");

      // Render template tin nhắn dự kiến
      const context = buildReminderTemplateContext({
        customerName: customer?.full_name || "Khách hàng",
        productName: order.product_name_snapshot,
        expiryDate: order.expires_at,
        debtAmountVnd: Math.max(0, (order.total_amount_vnd || 0) - (order.total_paid || 0)),
        balanceDueVnd: Math.max(0, (order.total_amount_vnd || 0) - (order.total_paid || 0)),
        daysLeft,
        orderCode: order.order_code,
        status: order.status,
      });

      // Template Telegram
      const tgTemplate = config.template_renewal_internal || config.template_renewal;
      const renderedTelegram = renderReminderTemplate(tgTemplate, context);

      // Template Zalo
      const zaloTemplate = resolvedTier === "EXPIRED" 
        ? config.template_expired_zalo || config.template_renewal_zalo
        : config.template_renewal_zalo || config.template_renewal;
      const renderedZalo = renderReminderTemplate(zaloTemplate, context);

      // Kiểm tra xem hôm nay hệ thống đã gửi nhắc hẹn cho đơn này chưa
      const isTelegramSent = sentSet.has(`${order.id}_${resolvedTier}_telegram`);
      const isZaloSent = sentSet.has(`${order.id}_${resolvedTier}_zalo`);

      upcomingReminders.push({
        id: order.id,
        orderCode: order.order_code,
        productName: order.product_name_snapshot,
        expiryDate: order.expires_at,
        daysLeft,
        status: order.status,
        tier: resolvedTier,
        customer: {
          id: order.customer_id,
          name: customer?.full_name || "Khách hàng không tên",
          phone: customer?.phone || "",
        },
        channels: {
          telegram: {
            available: hasTelegram,
            sentToday: isTelegramSent,
            contacts: contacts.filter((c) => c.channel === "telegram"),
          },
          zalo: {
            available: hasZalo,
            sentToday: isZaloSent,
            contacts: contacts.filter((c) => c.channel === "zalo"),
          },
        },
        messageTelegram: renderedTelegram,
        messageZalo: renderedZalo,
        isConfiguredAuto: (
          (resolvedTier === "T-7" && config.t7_enabled) ||
          (resolvedTier === "T-3" && config.t3_enabled) ||
          (resolvedTier === "T-1" && config.t1_enabled) ||
          resolvedTier === "EXPIRED"
        ),
      });
    }

    // Sắp xếp các đơn sắp hết hạn trước tiên (số ngày còn lại ít nhất)
    upcomingReminders.sort((a, b) => a.daysLeft - b.daysLeft);

    return createSuccessResponse(upcomingReminders);
  }),
);
