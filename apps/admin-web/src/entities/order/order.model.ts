import { BaseModel } from "../base-model";
import type { OrderStatus, PaymentMethod, PaymentState, PaymentTerms } from "@/lib/domain/types";

export type OrderModelContact = {
  id?: string;
  channel: string;
  value: string;
  is_verified?: boolean;
};

export interface OrderModelInput {
  id: string;
  order_code?: string | null;
  customer_id: string;
  product_id?: string;
  quantity?: number;
  total_amount_vnd: number;
  total_paid?: number;
  total_cost_vnd?: number;
  payment_method?: string | null;
  payment_terms?: string | null;
  payment_state?: string | null;
  balance_due_vnd?: number;
  is_fully_paid?: boolean;
  payment_source_id?: string | null;
  sales_channel_id?: string | null;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  expires_at?: string | Date | null;
  
  // Enriched fields from UI queries
  customerName?: string | null;
  productName?: string | null;
  customerEmail?: string | null;
  customerContacts?: OrderModelContact[] | null;
  salesChannelName?: string | null;
  paymentSourceName?: string | null;
  unit_price_vnd?: number | null;
  cost_price_vnd?: number | null;
  sales_note?: string | null;
  contact_snapshot?: string | null;
  proof_image_urls?: string[] | null;
}

export class OrderModel extends BaseModel {
  public readonly orderCode: string | null;
  public readonly customerId: string;
  public readonly productId: string | null;
  public readonly quantity: number;
  public readonly totalAmountVnd: number;
  public readonly totalPaid: number;
  public readonly totalCostVnd: number;
  public readonly paymentMethod: PaymentMethod | null;
  public readonly paymentTerms: PaymentTerms | null;
  public readonly paymentState: PaymentState | null;
  public readonly balanceDueVnd: number;
  public readonly isFullyPaid: boolean;
  public readonly paymentSourceId: string | null;
  public readonly salesChannelId: string | null;
  public readonly status: OrderStatus;
  public readonly expiresAt: Date | null;

  // Enriched UI Fields
  public readonly customerName: string;
  public readonly productName: string;
  public readonly customerEmail: string | null;
  public readonly customerContacts: OrderModelContact[];
  public readonly salesChannelName: string | null;
  public readonly paymentSourceName: string | null;
  public readonly unitPriceVnd: number | null;
  public readonly costPriceVnd: number | null;
  public readonly salesNote: string | null;
  public readonly contactSnapshot: string | null;
  public readonly proofImageUrls: string[] | null;

  constructor(data: OrderModelInput) {
    super({
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });

    this.orderCode = data.order_code || null;
    this.customerId = data.customer_id;
    this.productId = data.product_id || null;
    this.quantity = data.quantity ?? 1;
    this.totalAmountVnd = data.total_amount_vnd;
    this.totalPaid = data.total_paid ?? 0;
    this.totalCostVnd = data.total_cost_vnd ?? 0;
    
    this.paymentMethod = (data.payment_method as PaymentMethod) || null;
    this.paymentTerms = (data.payment_terms as PaymentTerms) || null;
    this.paymentState = (data.payment_state as PaymentState) || null;
    
    this.balanceDueVnd = data.balance_due_vnd ?? Math.max(0, this.totalAmountVnd - this.totalPaid);
    this.isFullyPaid = data.is_fully_paid ?? (this.totalPaid >= this.totalAmountVnd && this.totalAmountVnd > 0);
    this.paymentSourceId = data.payment_source_id || null;
    this.salesChannelId = data.sales_channel_id || null;
    this.status = data.status as OrderStatus;
    this.expiresAt = data.expires_at ? new Date(data.expires_at) : null;

    // Enriched fields defaults
    this.customerName = data.customerName || data.customer_id;
    this.productName = data.productName || data.product_id || "Sản phẩm";
    this.customerEmail = data.customerEmail || null;
    this.customerContacts = data.customerContacts || [];
    this.salesChannelName = data.salesChannelName || null;
    this.paymentSourceName = data.paymentSourceName || null;
    this.unitPriceVnd = data.unit_price_vnd ?? null;
    this.costPriceVnd = data.cost_price_vnd ?? null;
    this.salesNote = data.sales_note || null;
    this.contactSnapshot = data.contact_snapshot || null;
    this.proofImageUrls = data.proof_image_urls || null;
  }

  /**
   * Tính lợi nhuận của đơn hàng (Doanh thu - Vốn)
   */
  public getProfit(): number {
    return this.totalAmountVnd - this.totalCostVnd;
  }

  /**
   * Tính số ngày còn lại đến khi hết hạn
   */
  public getDaysLeft(relativeTo: Date = new Date()): number | null {
    if (!this.expiresAt) return null;
    
    // Normalize dates to mid-night to get exact days difference
    const d1 = new Date(relativeTo.getFullYear(), relativeTo.getMonth(), relativeTo.getDate());
    const d2 = new Date(this.expiresAt.getFullYear(), this.expiresAt.getMonth(), this.expiresAt.getDate());
    
    return Math.round((d2.getTime() - d1.getTime()) / 86400000);
  }

  /**
   * Xác định trạng thái độ khẩn cấp về hạn dùng
   */
  public getUrgencyState(relativeTo: Date = new Date()): "expired" | "soon" | "ok" | "none" {
    if (this.status === "expired") return "expired";
    const days = this.getDaysLeft(relativeTo);
    if (days === null) return "none";
    if (days <= 0) return "expired";
    if (days <= 14) return "soon";
    return "ok";
  }

  /**
   * Kiểm tra xem đơn hàng đã bị quá hạn chưa
   */
  public isOverdue(relativeTo: Date = new Date()): boolean {
    const days = this.getDaysLeft(relativeTo);
    return days !== null && days <= 0;
  }

  /**
   * Trả về thông tin liên lạc chính của khách hàng
   */
  public getPrimaryContact(): OrderModelContact | null {
    if (this.customerContacts && this.customerContacts.length > 0) {
      return this.customerContacts[0];
    }
    if (this.contactSnapshot) {
      const parts = this.contactSnapshot.split(":");
      if (parts.length >= 2) {
        return {
          channel: parts[0].trim().toLowerCase(),
          value: parts.slice(1).join(":").trim()
        };
      }
      return {
        channel: "other",
        value: this.contactSnapshot
      };
    }
    return null;
  }

  /**
   * Metadata hiển thị trạng thái tiếng Việt
   */
  public getStatusMeta(): { label: string; tone: "green" | "blue" | "teal" | "amber" | "red" | "gray"; class: string; dotClass: string } {
    const defaultMeta = { label: "Nháp", tone: "gray" as const, class: "bg-gray-100 text-gray-600 border-gray-500/20", dotClass: "bg-gray-400" };
    
    switch (this.status) {
      case "draft":
        return {
          label: "Nháp",
          tone: "gray",
          class: "bg-gray-100 text-gray-500 border-gray-200",
          dotClass: "bg-gray-400"
        };
      case "pending_payment":
        return {
          label: "Chờ TT",
          tone: "amber",
          class: "bg-amber-50 text-amber-600 border-amber-500/20",
          dotClass: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
        };
      case "paid":
        return {
          label: "Đã TT",
          tone: "blue",
          class: "bg-blue-50 text-blue-600 border-blue-500/20",
          dotClass: "bg-blue-500"
        };
      case "provisioning":
        return {
          label: "Cấp phát",
          tone: "teal",
          class: "bg-teal-50 text-teal-600 border-teal-500/20",
          dotClass: "bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.5)]"
        };
      case "active":
        return {
          label: "Active",
          tone: "green",
          class: "bg-emerald-50 text-emerald-600 border-emerald-500/20",
          dotClass: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
        };
      case "expired":
        return {
          label: "Hết hạn",
          tone: "red",
          class: "bg-red-50 text-red-500 border-red-500/20",
          dotClass: "bg-red-500"
        };
      case "refunded":
        return {
          label: "Hoàn tiền",
          tone: "gray",
          class: "bg-purple-50 text-purple-600 border-purple-500/20",
          dotClass: "bg-purple-500"
        };
      default:
        return defaultMeta;
    }
  }

  /* ---------- Formatting Helpers ---------- */

  public getFormattedAmount(): string {
    return this.totalAmountVnd.toLocaleString("vi-VN") + " ₫";
  }

  public getFormattedProfit(): string {
    const profit = this.getProfit();
    return (profit >= 0 ? "+" : "") + profit.toLocaleString("vi-VN") + " ₫";
  }

  public getFormattedExpiryDate(): string {
    if (!this.expiresAt) return "—";
    return this.expiresAt.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  public getFormattedCreatedDate(): string {
    return this.createdAt.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  /**
   * Serialize đối tượng thành JSON thuần túy để render an toàn.
   */
  public override toJSON(): Record<string, any> {
    const daysLeft = this.getDaysLeft();
    const primaryContact = this.getPrimaryContact();
    const statusMeta = this.getStatusMeta();
    const profit = this.getProfit();
    const urgency = this.getUrgencyState();

    return {
      ...super.toJSON(),
      orderCode: this.orderCode,
      customerId: this.customerId,
      productId: this.productId,
      quantity: this.quantity,
      totalAmountVnd: this.totalAmountVnd,
      totalPaid: this.totalPaid,
      totalCostVnd: this.totalCostVnd,
      paymentMethod: this.paymentMethod,
      paymentTerms: this.paymentTerms,
      paymentState: this.paymentState,
      balanceDueVnd: this.balanceDueVnd,
      isFullyPaid: this.isFullyPaid,
      paymentSourceId: this.paymentSourceId,
      salesChannelId: this.salesChannelId,
      status: this.status,
      expiresAt: this.expiresAt ? this.expiresAt.toISOString() : null,
      
      // Enriched & Computed Fields
      customerName: this.customerName,
      productName: this.productName,
      customerEmail: this.customerEmail,
      customerContacts: this.customerContacts,
      salesChannelName: this.salesChannelName,
      paymentSourceName: this.paymentSourceName,
      unitPriceVnd: this.unitPriceVnd,
      costPriceVnd: this.costPriceVnd,
      salesNote: this.salesNote,
      contactSnapshot: this.contactSnapshot,
      proofImageUrls: this.proofImageUrls,
      
      // Getter/Computed values
      profit,
      daysLeft,
      urgency,
      primaryContact,
      statusMeta,
      formattedAmount: this.getFormattedAmount(),
      formattedProfit: this.getFormattedProfit(),
      formattedExpiryDate: this.getFormattedExpiryDate(),
      formattedCreatedDate: this.getFormattedCreatedDate(),
    };
  }
}
