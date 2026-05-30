import { BaseModel } from "../base-model";
import type { Customer, CustomerSegment, CustomerTag, ContactInfo, CustomerNick } from "@/lib/domain/types";

export interface CustomerModelInput {
  id: string;
  name: string;
  contacts: ContactInfo[];
  tier: "vip" | "regular";
  customerType: "retail" | "wholesale" | "agency";
  group_id?: string;
  tags?: CustomerTag[];
  debtAmountVnd: number;
  debtOverdueDays: number;
  totalSpentVnd?: number;
  balanceVnd?: number;
  reliabilityScore: number;
  notes?: string;
  createdAt: string | Date;
  nicksRegistry?: CustomerNick[];
  segment?: CustomerSegment;
  rfmScore?: number;
  rfmRecency?: number;
  rfmFrequency?: number;
  rfmMonetary?: number;
}

export class CustomerModel extends BaseModel {
  public readonly name: string;
  public readonly contacts: ContactInfo[];
  public readonly tier: "vip" | "regular";
  public readonly customerType: "retail" | "wholesale" | "agency";
  public readonly groupId: string | null;
  public readonly tags: CustomerTag[];
  public readonly debtAmountVnd: number;
  public readonly debtOverdueDays: number;
  public readonly totalSpentVnd: number;
  public readonly balanceVnd: number;
  public readonly reliabilityScore: number;
  public readonly notes: string | null;
  public readonly nicksRegistry: CustomerNick[];
  public readonly segment: CustomerSegment | null;
  public readonly rfmScore: number | null;

  constructor(data: CustomerModelInput) {
    super({
      id: data.id,
      createdAt: data.createdAt,
      updatedAt: data.createdAt, // default to createdAt if not present
    });

    this.name = data.name;
    this.contacts = data.contacts || [];
    this.tier = data.tier || "regular";
    this.customerType = data.customerType || "retail";
    this.groupId = data.group_id || null;
    this.tags = data.tags || [];
    this.debtAmountVnd = data.debtAmountVnd ?? 0;
    this.debtOverdueDays = data.debtOverdueDays ?? 0;
    this.totalSpentVnd = data.totalSpentVnd ?? 0;
    this.balanceVnd = data.balanceVnd ?? 0;
    this.reliabilityScore = data.reliabilityScore ?? 100;
    this.notes = data.notes || null;
    this.nicksRegistry = data.nicksRegistry || [];
    this.segment = data.segment || null;
    this.rfmScore = data.rfmScore || null;
  }

  /**
   * Trả về thông tin liên lạc chính
   */
  public getPrimaryContact(): ContactInfo | null {
    if (this.contacts && this.contacts.length > 0) {
      const primary = this.contacts.find(c => c.isPrimary);
      return primary || this.contacts[0];
    }
    return null;
  }

  /**
   * Định dạng công nợ dư nợ
   */
  public getFormattedDebt(): string {
    return this.debtAmountVnd.toLocaleString("vi-VN") + " ₫";
  }

  /**
   * Định dạng tổng chi tiêu
   */
  public getFormattedTotalSpent(): string {
    return this.totalSpentVnd.toLocaleString("vi-VN") + " ₫";
  }

  /**
   * Định dạng số dư tài khoản
   */
  public getFormattedBalance(): string {
    return this.balanceVnd.toLocaleString("vi-VN") + " ₫";
  }

  /**
   * Metadata cho phân khúc khách hàng tiếng Việt
   */
  public getSegmentMeta(): { label: string; class: string; dotClass: string } {
    const defaultMeta = { label: "Mới", class: "bg-blue-50 text-blue-600 border-blue-500/20", dotClass: "bg-blue-500" };
    if (!this.segment) return defaultMeta;

    switch (this.segment) {
      case "vip":
        return {
          label: "VIP",
          class: "bg-purple-100 text-purple-700 border-purple-300",
          dotClass: "bg-purple-600"
        };
      case "loyal":
        return {
          label: "Thân thiết",
          class: "bg-emerald-100 text-emerald-700 border-emerald-300",
          dotClass: "bg-emerald-600"
        };
      case "regular":
        return {
          label: "Thường xuyên",
          class: "bg-blue-100 text-blue-700 border-blue-300",
          dotClass: "bg-blue-600"
        };
      case "at_risk":
        return {
          label: "Rủi ro",
          class: "bg-amber-100 text-amber-700 border-amber-300",
          dotClass: "bg-amber-600"
        };
      case "churned":
        return {
          label: "Rời bỏ",
          class: "bg-red-100 text-red-700 border-red-300",
          dotClass: "bg-red-600"
        };
      case "new":
        return {
          label: "Mới",
          class: "bg-gray-100 text-gray-700 border-gray-300",
          dotClass: "bg-gray-500"
        };
      default:
        return defaultMeta;
    }
  }

  /**
   * Phân loại mức độ dư nợ để cảnh báo UI
   */
  public getDebtState(): "normal" | "warning" | "critical" {
    if (this.debtAmountVnd <= 0) return "normal";
    if (this.debtOverdueDays > 7 || this.debtAmountVnd > 500000) return "critical";
    return "warning";
  }

  /**
   * Metadata cho mức độ tin cậy
   */
  public getReliabilityState(): { label: string; class: string } {
    if (this.reliabilityScore >= 80) {
      return { label: "Cao", class: "text-emerald-600 font-semibold" };
    }
    if (this.reliabilityScore >= 50) {
      return { label: "Trung bình", class: "text-amber-600 font-medium" };
    }
    return { label: "Thấp", class: "text-red-500 font-bold" };
  }

  /**
   * Serialize thành JSON
   */
  public override toJSON(): Record<string, any> {
    const primaryContact = this.getPrimaryContact();
    const segmentMeta = this.getSegmentMeta();
    const debtState = this.getDebtState();
    const reliabilityState = this.getReliabilityState();

    return {
      ...super.toJSON(),
      name: this.name,
      contacts: this.contacts,
      tier: this.tier,
      customerType: this.customerType,
      groupId: this.groupId,
      tags: this.tags,
      debtAmountVnd: this.debtAmountVnd,
      debtOverdueDays: this.debtOverdueDays,
      totalSpentVnd: this.totalSpentVnd,
      balanceVnd: this.balanceVnd,
      reliabilityScore: this.reliabilityScore,
      notes: this.notes,
      nicksRegistry: this.nicksRegistry,
      segment: this.segment,
      rfmScore: this.rfmScore,

      // Getters & Helpers
      primaryContact,
      segmentMeta,
      debtState,
      reliabilityState,
      formattedDebt: this.getFormattedDebt(),
      formattedTotalSpent: this.getFormattedTotalSpent(),
      formattedBalance: this.getFormattedBalance(),
    };
  }
}
