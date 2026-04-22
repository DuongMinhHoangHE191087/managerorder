import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProductLookupConfig {
  supabase: SupabaseClient;
  accountId: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  is_active: boolean;
  image_url?: string;
  category?: string;
  duration_type?: string;
  duration_value?: number;
}

export class ProductLookupService {
  private readonly db: SupabaseClient;
  private readonly accountId: string;

  constructor(config: ProductLookupConfig) {
    this.db = config.supabase;
    this.accountId = config.accountId;
  }

  /**
   * Lấy danh sách sản phẩm đang bán (is_active = true)
   */
  async getActiveProducts(limit: number = 10): Promise<Product[]> {
    try {
      const { data, error } = await this.db
        .from("products")
        .select("*")
        .eq("account_id", this.accountId)
        .eq("is_active", true)
        .limit(limit);

      if (error) {
        console.error("[ProductLookup] Supabase error:", error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description || `Gói đăng ký ${row.duration_value || ""} ${row.duration_type || ""}`.trim(),
        price: row.sell_price_vnd || 0,
        currency: "VNĐ",
        is_active: row.is_active,
        image_url: row.image_url,
        category: row.category,
        duration_type: row.duration_type,
        duration_value: row.duration_value,
      }));
    } catch (err) {
      console.error("[ProductLookup] Exception:", err);
      return [];
    }
  }

  /**
   * Format danh sách sản phẩm thành tin nhắn gọn gàng cho Zalo.
   */
  formatProductsMessage(products: Product[]): string {
    if (!products || products.length === 0) {
      return "📦 Hiện tại hệ thống chưa có sản phẩm nào đang được tung ra bán hoặc cung cấp. Bạn vui lòng quay lại sau nhé!";
    }

    const lines = ["🛍️ **DANH SÁCH SẢN PHẨM / DỊCH VỤ NỔI BẬT:**", ""];

    products.forEach((p, idx) => {
      // Format giá: vd 50000 -> 50.000
      const formattedPrice = new Intl.NumberFormat("vi-VN").format(p.price);
      const currency = p.currency || "VNĐ";
      
      lines.push(`${idx + 1}. **${p.name}**`);
      lines.push(`   💰 Giá: ${formattedPrice} ${currency}`);
      if (p.description && p.description !== "Gói đăng ký") {
        lines.push(`   📄 ${p.description}`);
      }
      lines.push(""); // Dòng trống ngăn cách
    });

    lines.push("💡 *Nếu bạn muốn mua hoặc tư vấn chi tiết hơn, hãy nhắn tin trực tiếp để nhân viên tư vấn hoặc nhờ trợ lý AI hỗ trợ.*");

    return lines.join("\n");
  }
}
