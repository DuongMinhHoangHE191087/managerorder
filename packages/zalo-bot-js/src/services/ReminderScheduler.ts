import type { Bot } from "../core/Bot";
import type { SupabaseCustomerTracker } from "./SupabaseCustomerTracker";

export interface ReminderSchedulerConfig {
  bot: Bot;
  tracker: SupabaseCustomerTracker;
  intervalMs?: number;
  adminZaloIds: string[];
  sendZNS?: (phone: string, templateId: string, data: Record<string, string>) => Promise<boolean>;
  znsTemplates?: {
    expiryReminder?: string;
    expired?: string;
  };
}

export class ReminderScheduler {
  private timer?: ReturnType<typeof setInterval>;
  private readonly bot: Bot;
  private readonly tracker: SupabaseCustomerTracker;
  private readonly intervalMs: number;
  private readonly adminZaloIds: string[];
  private readonly sendZNS?: ReminderSchedulerConfig["sendZNS"];
  private readonly templates: NonNullable<ReminderSchedulerConfig["znsTemplates"]>;
  private running = false;

  constructor(config: ReminderSchedulerConfig) {
    this.bot = config.bot;
    this.tracker = config.tracker;
    this.intervalMs = config.intervalMs ?? 5 * 60 * 1000; // 5 phút
    this.adminZaloIds = config.adminZaloIds;
    this.sendZNS = config.sendZNS;
    this.templates = config.znsTemplates ?? {};
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    console.log(`[Scheduler] Started. Interval: ${this.intervalMs / 1000}s`);

    // Chạy lần đầu sau 10s (chờ bot init)
    setTimeout(() => void this.tick(), 10_000);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.running = false;
    console.log("[Scheduler] Stopped.");
  }

  private async tick(): Promise<void> {
    try {
      await this.processReminders();
      await this.processExpiringOrders();
    } catch (err) {
      console.error("[Scheduler] Tick error:", err);
    }
  }

  /**
   * Xử lý reminder_events đã đến hạn
   */
  private async processReminders(): Promise<void> {
    const reminders = await this.tracker.getPendingReminders();
    if (reminders.length === 0) return;

    console.log(`[Scheduler] Processing ${reminders.length} reminder(s)...`);

    for (const reminder of reminders) {
      const message = `🔔 **NHẮC NHỞ**: ${reminder.title}\n📝 ${reminder.notes || "Không có ghi chú"}\n⏰ Hạn: ${new Date(reminder.due_at).toLocaleString("vi-VN")}`;

      // Gửi cho tất cả admin
      for (const adminId of this.adminZaloIds) {
        try {
          await this.bot.sendMessage(adminId, message);
        } catch (err) {
          console.error(`[Scheduler] Failed to notify admin ${adminId}:`, err);
        }
      }
    }
  }

  /**
   * Quét đơn hàng sắp hết hạn (3 ngày tới) → thông báo admin + ZNS cho khách
   */
  private async processExpiringOrders(): Promise<void> {
    const orders = await this.tracker.getExpiringOrders(3);
    if (orders.length === 0) return;

    console.log(`[Scheduler] ${orders.length} order(s) expiring within 3 days.`);

    // Tổng hợp thông báo cho admin
    let adminSummary = `⏰ **CẢNH BÁO GIA HẠN** — ${orders.length} đơn sắp hết hạn:\n`;
    for (const order of orders) {
      const expiresAt = new Date(order.expires_at).toLocaleDateString("vi-VN");
      adminSummary += `\n• ${order.product_name_snapshot || "N/A"} — HSD: ${expiresAt} — KH: ${order.contact_snapshot || order.customer_id?.substring(0, 8)}`;

      // Thử gửi ZNS cho khách nếu có SĐT
      if (this.sendZNS && this.templates.expiryReminder && order.customer_id) {
        const phone = await this.tracker.getCustomerPhone(order.customer_id);
        if (phone) {
          try {
            await this.sendZNS(phone, this.templates.expiryReminder, {
              product: order.product_name_snapshot || "Dịch vụ",
              expiry_date: expiresAt,
            });
            console.log(`[Scheduler] ZNS expiry reminder sent to ${phone}`);
          } catch (err) {
            console.error(`[Scheduler] ZNS send failed for ${phone}:`, err);
          }
        }
      }
    }

    // Gửi summary cho admin
    for (const adminId of this.adminZaloIds) {
      try {
        await this.bot.sendMessage(adminId, adminSummary);
      } catch (err) {
        console.error(`[Scheduler] Failed to notify admin:`, err);
      }
    }
  }
}
