/**
 * RateLimitService - Giới hạn số lần tra cứu đơn hàng theo Zalo User ID/ngày
 * Sử dụng Supabase để lưu trữ và đếm lịch sử tra cứu.
 * Cơ chế: mỗi Zalo ID chỉ được tra cứu MAX N keyword khác nhau PER DAY.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitConfig {
  supabase: SupabaseClient;
  accountId: string;
  maxQueriesPerDay?: number; // Default: 3
}

export interface RateLimitCheckResult {
  allowed: boolean;
  usedToday: number;
  remaining: number;
  limit: number;
}

export class RateLimitService {
  private readonly db: SupabaseClient;
  private readonly accountId: string;
  private readonly maxQueriesPerDay: number;

  // In-memory cache để giảm DB hits (key: zaloId|date → count)
  private readonly cache = new Map<string, { count: number; expiresAt: number }>();

  constructor(config: RateLimitConfig) {
    this.db = config.supabase;
    this.accountId = config.accountId;
    this.maxQueriesPerDay = config.maxQueriesPerDay ?? 3;
  }

  /**
   * Kiểm tra và ghi nhận 1 lượt tra cứu
   * @returns RateLimitCheckResult
   */
  async checkAndRecord(zaloUserId: string, keyword: string): Promise<RateLimitCheckResult> {
    const today = this.getToday();
    const cacheKey = `${zaloUserId}|${today}`;

    // Lấy số lần đã dùng từ cache hoặc DB
    let usedToday = await this.getUsedCount(zaloUserId, today, cacheKey);

    const allowed = usedToday < this.maxQueriesPerDay;

    if (allowed) {
      // Ghi log vào DB
      await this.insertLog(zaloUserId, keyword, today);
      usedToday += 1;

      // Cập nhật cache
      this.setCache(cacheKey, usedToday);
    }

    return {
      allowed,
      usedToday,
      remaining: Math.max(0, this.maxQueriesPerDay - usedToday),
      limit: this.maxQueriesPerDay,
    };
  }

  /**
   * Chỉ kiểm tra, không ghi log (dùng để preview)
   */
  async checkOnly(zaloUserId: string): Promise<RateLimitCheckResult> {
    const today = this.getToday();
    const cacheKey = `${zaloUserId}|${today}`;
    const usedToday = await this.getUsedCount(zaloUserId, today, cacheKey);

    return {
      allowed: usedToday < this.maxQueriesPerDay,
      usedToday,
      remaining: Math.max(0, this.maxQueriesPerDay - usedToday),
      limit: this.maxQueriesPerDay,
    };
  }

  /**
   * Format tin nhắn chặn khi hết lượt
   */
  formatBlockMessage(result: RateLimitCheckResult): string {
    return [
      `🚫 Bạn đã dùng hết ${result.limit}/${result.limit} lượt tra cứu hôm nay.`,
      `⏰ Lượt tra cứu sẽ được làm mới vào 00:00 ngày mai.`,
      ``,
      `💡 Nếu cần hỗ trợ gấp, nhắn "gặp nhân viên" để được tư vấn trực tiếp.`,
    ].join("\n");
  }

  /**
   * Format tin nhắn cảnh báo còn ít lượt
   */
  formatWarningMessage(result: RateLimitCheckResult): string | null {
    if (result.remaining > 1) return null;
    return `⚠️ Lưu ý: Bạn còn ${result.remaining} lượt tra cứu hôm nay.`;
  }

  private getToday(): string {
    return new Date().toISOString().split("T")[0]!;
  }

  private setCache(key: string, count: number): void {
    // Cache hết hạn cuối ngày (đơn giản: 24h)
    this.cache.set(key, {
      count,
      expiresAt: Date.now() + 86_400_000,
    });
  }

  private async getUsedCount(
    zaloUserId: string,
    today: string,
    cacheKey: string,
  ): Promise<number> {
    // Kiểm tra cache trước
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.count;
    }

    // Fallback: đếm từ DB
    try {
      const { count } = await this.db
        .from("lookup_rate_logs")
        .select("id", { count: "exact", head: true })
        .eq("account_id", this.accountId)
        .eq("zalo_user_id", zaloUserId)
        .eq("query_date", today);

      const used = count ?? 0;
      this.setCache(cacheKey, used);
      return used;
    } catch (error) {
      console.error("[RateLimit] getUsedCount error:", error);
      return 0; // Fail open (allow query on error)
    }
  }

  private async insertLog(zaloUserId: string, keyword: string, today: string): Promise<void> {
    try {
      await this.db.from("lookup_rate_logs").insert({
        account_id: this.accountId,
        zalo_user_id: zaloUserId,
        keyword_masked: this.maskKeyword(keyword),
        query_date: today,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[RateLimit] insertLog error:", error);
    }
  }

  /**
   * Mask keyword để bảo vệ quyền riêng tư trong log
   * VD: "0987654321" → "0987...321"
   */
  private maskKeyword(keyword: string): string {
    if (keyword.length <= 6) return "***";
    return `${keyword.slice(0, 4)}...${keyword.slice(-3)}`;
  }
}
