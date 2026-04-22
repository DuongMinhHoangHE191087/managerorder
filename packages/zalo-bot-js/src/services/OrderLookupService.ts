/**
 * OrderLookupService - Tra cứu đơn hàng từ Supabase
 * Hỗ trợ: tìm theo SĐT, Mã đơn, hoặc Duolingo username
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrderInfo {
  id: string;
  orderCode: string;
  productName: string;
  status: string;
  expiresAt?: string;
  createdAt?: string;
  duolingoUsername?: string;
  phone?: string;
  notes?: string;
}

export interface OrderLookupConfig {
  supabase: SupabaseClient;
  accountId: string;
}

export class OrderLookupService {
  private readonly db: SupabaseClient;
  private readonly accountId: string;

  constructor(config: OrderLookupConfig) {
    this.db = config.supabase;
    this.accountId = config.accountId;
  }

  /**
   * Tự động nhận dạng loại keyword và tìm kiếm đơn hàng
   * @param keyword - SĐT, mã đơn, hoặc username Duolingo
   */
  async lookup(keyword: string): Promise<OrderInfo[]> {
    const normalized = keyword.trim();

    if (this.isPhoneNumber(normalized)) {
      return this.findByPhone(normalized);
    }

    if (this.isOrderCode(normalized)) {
      return this.findByOrderCode(normalized);
    }

    // Coi là Duolingo username
    return this.findByDuolingoUsername(normalized.startsWith("@") ? normalized.slice(1) : normalized);
  }

  async findByPhone(phone: string): Promise<OrderInfo[]> {
    try {
      const normalized = this.normalizePhone(phone);

      // Tìm customer có SĐT này
      const { data: contacts } = await this.db
        .from("customer_contacts")
        .select("customer_id")
        .eq("channel", "phone")
        .ilike("value", `%${normalized}%`);

      if (!contacts?.length) return [];

      const customerIds = contacts.map((c) => c.customer_id as string);
      return this.findByCustomerIds(customerIds);
    } catch (error) {
      console.error("[OrderLookup] findByPhone error:", error);
      return [];
    }
  }

  async findByOrderCode(orderCode: string): Promise<OrderInfo[]> {
    try {
      const { data } = await this.db
        .from("orders")
        .select("id, order_code, product_name_snapshot, status, expires_at, created_at, contact_snapshot, notes")
        .eq("account_id", this.accountId)
        .ilike("order_code", `%${orderCode}%`)
        .limit(5);

      return (data ?? []).map((row) => this.mapOrderRow(row));
    } catch (error) {
      console.error("[OrderLookup] findByOrderCode error:", error);
      return [];
    }
  }

  async findByDuolingoUsername(username: string): Promise<OrderInfo[]> {
    try {
      const { data } = await this.db
        .from("orders")
        .select("id, order_code, product_name_snapshot, status, expires_at, created_at, contact_snapshot, notes")
        .eq("account_id", this.accountId)
        .ilike("contact_snapshot->duolingo_username", `%${username}%`)
        .limit(5);

      return (data ?? []).map((row) => this.mapOrderRow(row));
    } catch (error) {
      console.error("[OrderLookup] findByDuolingoUsername error:", error);
      // Fallback: search toàn bộ contact_snapshot bằng ILIKE text
      return this.findByDuolingoUsernameFull(username);
    }
  }

  private async findByDuolingoUsernameFull(username: string): Promise<OrderInfo[]> {
    try {
      const { data } = await this.db
        .from("orders")
        .select("id, order_code, product_name_snapshot, status, expires_at, created_at, contact_snapshot, notes")
        .eq("account_id", this.accountId)
        .ilike("contact_snapshot::text", `%${username}%`)
        .limit(5);

      return (data ?? []).map((row) => this.mapOrderRow(row));
    } catch (error) {
      console.error("[OrderLookup] findByDuolingoUsernameFull fallback error:", error);
      return [];
    }
  }

  private async findByCustomerIds(customerIds: string[]): Promise<OrderInfo[]> {
    const { data } = await this.db
      .from("orders")
      .select("id, order_code, product_name_snapshot, status, expires_at, created_at, contact_snapshot, notes")
      .eq("account_id", this.accountId)
      .in("customer_id", customerIds)
      .order("created_at", { ascending: false })
      .limit(10);

    return (data ?? []).map((row) => this.mapOrderRow(row));
  }

  private mapOrderRow(row: Record<string, unknown>): OrderInfo {
    const contact = row.contact_snapshot as Record<string, unknown> | undefined;
    return {
      id: row.id as string,
      orderCode: (row.order_code as string) ?? "—",
      productName: (row.product_name_snapshot as string) ?? "Gói dịch vụ",
      status: this.translateStatus((row.status as string) ?? "unknown"),
      expiresAt: row.expires_at ? this.formatDate(row.expires_at as string) : undefined,
      createdAt: row.created_at ? this.formatDate(row.created_at as string) : undefined,
      duolingoUsername: (contact?.duolingo_username as string) ?? undefined,
      phone: (contact?.phone as string) ?? undefined,
      notes: (row.notes as string) ?? undefined,
    };
  }

  /**
   * Format danh sách đơn hàng cho Zalo message
   */
  formatOrdersMessage(orders: OrderInfo[], keyword: string): string {
    if (orders.length === 0) {
      return [
        `❌ Không tìm thấy đơn hàng với từ khóa: "${keyword}"`,
        ``,
        `💡 Thử lại với:`,
        `  • Số điện thoại: 0987654321`,
        `  • Mã đơn hàng: ORD-xxxxx`,
        `  • Username Duolingo: @username`,
      ].join("\n");
    }

    const lines: string[] = [`📦 Tìm thấy ${orders.length} đơn hàng:\n`];

    orders.forEach((order, i) => {
      lines.push(`─── Đơn ${i + 1} ───`);
      lines.push(`📋 Mã đơn: ${order.orderCode}`);
      lines.push(`🎯 Sản phẩm: ${order.productName}`);
      lines.push(`📊 Trạng thái: ${order.status}`);
      if (order.expiresAt) {
        lines.push(`⏰ Hết hạn: ${order.expiresAt}`);
      }
      if (order.duolingoUsername) {
        lines.push(`👤 Duolingo: @${order.duolingoUsername}`);
      }
      lines.push("");
    });

    return lines.join("\n").trim();
  }

  private isPhoneNumber(text: string): boolean {
    return /^(\+84|0)[0-9]{8,10}$/.test(text.replace(/[\s-]/g, ""));
  }

  private isOrderCode(text: string): boolean {
    // Mã đơn thường có chữ + số, VD: ORD-12345, DL20240101, ...
    return /^[A-Z]{2,5}[-_]?\d{3,}/i.test(text);
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("84")) return `0${digits.slice(2)}`;
    return digits;
  }

  private formatDate(isoDate: string): string {
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return isoDate;
    }
  }

  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      active: "✅ Đang hoạt động",
      expired: "❌ Đã hết hạn",
      cancelled: "🚫 Đã hủy",
      pending: "⏳ Chờ xử lý",
      pending_payment: "💳 Chờ thanh toán",
      trial: "🎯 Dùng thử",
      suspended: "⚠️ Tạm ngừng",
    };
    return statusMap[status] ?? status;
  }
}
