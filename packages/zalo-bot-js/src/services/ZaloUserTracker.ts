import type { SupabaseClient } from "@supabase/supabase-js";

export interface ZaloUserData {
  zaloUserId: string;
  displayName?: string;
  duolingoUsername?: string;
  lastOrderQuery?: string;
}

/**
 * Theo dõi và lưu thông tin cá nhân khách hàng Zalo vào Supabase.
 * CHỈ lưu dữ liệu cá nhân (tên, ID, username), KHÔNG lưu lịch sử chat.
 */
export class ZaloUserTracker {
  private readonly supabase: SupabaseClient;
  private readonly accountId: string;

  constructor({ supabase, accountId }: { supabase: SupabaseClient; accountId: string }) {
    this.supabase = supabase;
    this.accountId = accountId;
  }

  /**
   * Lưu hoặc cập nhật thông tin khách khi họ gửi bất kỳ tin nhắn nào.
   * Không-blocking: lỗi chỉ được log, không throw.
   */
  async upsertUser(zaloUserId: string, displayName?: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("zalo_bot_users")
        .upsert(
          {
            account_id: this.accountId,
            zalo_user_id: zaloUserId,
            ...(displayName ? { zalo_display_name: displayName } : {}),
            last_seen_at: new Date().toISOString(),
            query_count: 0, // Will be incremented by DB if using RPC, else handled separately
          },
          {
            onConflict: "account_id,zalo_user_id",
            ignoreDuplicates: false,
          }
        );

      if (error) {
        console.warn("[ZaloUserTracker] upsertUser error:", error.message);
      }
    } catch (err) {
      console.warn("[ZaloUserTracker] upsertUser exception:", err);
    }
  }

  /**
   * Lưu Duolingo username khách vừa tra cứu.
   */
  async recordDuolingoQuery(zaloUserId: string, username: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("zalo_bot_users")
        .upsert(
          {
            account_id: this.accountId,
            zalo_user_id: zaloUserId,
            duolingo_username: username,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "account_id,zalo_user_id" }
        );

      // Increment query_count separately
      await this.supabase.rpc("increment_zbu_query_count" as any, {
        p_account_id: this.accountId,
        p_zalo_user_id: zaloUserId,
      });

      if (error) console.warn("[ZaloUserTracker] recordDuolingoQuery:", error.message);
    } catch (err) {
      console.warn("[ZaloUserTracker] recordDuolingoQuery exception:", err);
    }
  }

  /**
   * Lưu keyword tra cứu đơn hàng.
   */
  async recordOrderQuery(zaloUserId: string, keyword: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("zalo_bot_users")
        .upsert(
          {
            account_id: this.accountId,
            zalo_user_id: zaloUserId,
            last_order_query: keyword,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "account_id,zalo_user_id" }
        );

      if (error) console.warn("[ZaloUserTracker] recordOrderQuery:", error.message);
    } catch (err) {
      console.warn("[ZaloUserTracker] recordOrderQuery exception:", err);
    }
  }
}
