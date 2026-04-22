import type { SupabaseClient } from "@supabase/supabase-js";

export interface CustomerTrackerConfig {
  supabase: SupabaseClient;
  accountId: string;
}

export class SupabaseCustomerTracker {
  private readonly db: SupabaseClient;
  private readonly accountId: string;

  constructor(config: CustomerTrackerConfig) {
    this.db = config.supabase;
    this.accountId = config.accountId;
  }

  /**
   * Auto-capture: Khi khách nhắn tin lần đầu, tạo/cập nhật customer + contact (channel=zalo)
   * Trả về customer_id nếu tìm thấy hoặc tạo mới.
   */
  async captureZaloUser(zaloUserId: string, displayName?: string): Promise<string | null> {
    try {
      // Check if zalo contact already exists
      const { data: existing } = await this.db
        .from("customer_contacts")
        .select("customer_id")
        .eq("channel", "zalo")
        .eq("value", zaloUserId)
        .maybeSingle();

      if (existing?.customer_id) {
        return existing.customer_id;
      }

      // Create new customer
      const { data: customer, error: customerErr } = await this.db
        .from("customers")
        .insert({
          account_id: this.accountId,
          full_name: displayName || `Zalo User ${zaloUserId.substring(0, 8)}`,
          type: "retail",
          notes: `Auto-captured from Zalo OA Bot`,
        })
        .select("id")
        .single();

      if (customerErr || !customer) {
        console.error("[Tracker] Failed to create customer:", customerErr);
        return null;
      }

      // Create zalo contact
      await this.db.from("customer_contacts").insert({
        customer_id: customer.id,
        channel: "zalo",
        value: zaloUserId,
        is_verified: true,
      });

      console.log(`[Tracker] New customer captured: ${customer.id} (Zalo: ${zaloUserId})`);
      return customer.id;
    } catch (err) {
      console.error("[Tracker] captureZaloUser error:", err);
      return null;
    }
  }

  /**
   * Lưu lỗi do khách báo vào bot_error_logs
   */
  async logError(
    zaloUserId: string,
    errorType: "bug" | "service_issue" | "payment" | "other",
    description: string,
    customerId?: string,
  ): Promise<void> {
    try {
      await this.db.from("bot_error_logs").insert({
        account_id: this.accountId,
        customer_id: customerId || null,
        zalo_user_id: zaloUserId,
        error_type: errorType,
        description,
      });
      console.log(`[Tracker] Error logged: ${errorType} from ${zaloUserId}`);
    } catch (err) {
      console.error("[Tracker] logError failed:", err);
    }
  }

  /**
   * Lưu activity log (đơn gói, yêu cầu hỗ trợ, etc.)
   */
  async logActivity(
    actionType: string,
    details: Record<string, unknown>,
    customerId?: string,
  ): Promise<void> {
    try {
      await this.db.from("activity_logs").insert({
        account_id: this.accountId,
        action_type: actionType,
        customer_id: customerId || null,
        details,
      });
    } catch (err) {
      console.error("[Tracker] logActivity failed:", err);
    }
  }

  /**
   * Lấy/Tạo session mode (ai/human) cho một user
   */
  async getSessionMode(zaloUserId: string): Promise<"ai" | "human"> {
    try {
      const { data } = await this.db
        .from("bot_sessions")
        .select("mode")
        .eq("zalo_user_id", zaloUserId)
        .maybeSingle();

      return (data?.mode as "ai" | "human") || "ai";
    } catch {
      return "ai";
    }
  }

  /**
   * Đặt chế độ cho một user (ai/human)
   */
  async setSessionMode(
    zaloUserId: string,
    mode: "ai" | "human",
    pausedBy?: string,
  ): Promise<void> {
    try {
      await this.db.from("bot_sessions").upsert(
        {
          zalo_user_id: zaloUserId,
          mode,
          paused_by: mode === "human" ? pausedBy : null,
          paused_at: mode === "human" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "zalo_user_id" },
      );
    } catch (err) {
      console.error("[Tracker] setSessionMode failed:", err);
    }
  }

  /**
   * Pause/Resume tất cả sessions cùng lúc
   */
  async setAllSessionsMode(mode: "ai" | "human", pausedBy?: string): Promise<number> {
    try {
      const { data } = await this.db
        .from("bot_sessions")
        .update({
          mode,
          paused_by: mode === "human" ? pausedBy : null,
          paused_at: mode === "human" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .neq("mode", mode)
        .select("id");

      return data?.length ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Tìm customer_id từ Zalo User ID
   */
  async findCustomerByZaloId(zaloUserId: string): Promise<string | null> {
    try {
      const { data } = await this.db
        .from("customer_contacts")
        .select("customer_id")
        .eq("channel", "zalo")
        .eq("value", zaloUserId)
        .maybeSingle();

      return data?.customer_id || null;
    } catch {
      return null;
    }
  }

  /**
   * Lấy SĐT từ customer_id (để gửi ZNS)
   */
  async getCustomerPhone(customerId: string): Promise<string | null> {
    try {
      const { data } = await this.db
        .from("customer_contacts")
        .select("value")
        .eq("customer_id", customerId)
        .eq("channel", "phone")
        .maybeSingle();

      return data?.value || null;
    } catch {
      return null;
    }
  }

  /**
   * Lấy danh sách đơn hàng sắp hết hạn (trong N ngày tới)
   */
  async getExpiringOrders(withinDays: number = 3): Promise<any[]> {
    try {
      const now = new Date();
      const future = new Date(now.getTime() + withinDays * 86400000);

      const { data } = await this.db
        .from("orders")
        .select("id, customer_id, product_name_snapshot, expires_at, status, contact_snapshot")
        .eq("account_id", this.accountId)
        .eq("status", "active")
        .gte("expires_at", now.toISOString())
        .lte("expires_at", future.toISOString());

      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Lấy danh sách reminders chưa xử lý
   */
  async getPendingReminders(): Promise<any[]> {
    try {
      const now = new Date().toISOString();
      const { data } = await this.db
        .from("reminder_events")
        .select("*")
        .eq("account_id", this.accountId)
        .eq("is_done", false)
        .lte("due_at", now);

      return data || [];
    } catch {
      return [];
    }
  }
}
