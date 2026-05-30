import { BaseModel } from "../base-model";
import type { Provider, ContactInfo } from "@/lib/domain/types";

export interface ProviderModelInput {
  id: string;
  name: string;
  code?: string;
  status?: string;
  contacts: ContactInfo[];
  tier: "vip" | "regular";
  reliabilityScore: number;
  notes?: string;
  debtAmountVnd?: number;
  totalImportAmountVnd?: number;
  purchaseOrderCount?: number;
  createdAt: string | Date;
}

export class ProviderModel extends BaseModel {
  public readonly name: string;
  public readonly code: string | null;
  public readonly status: string | null;
  public readonly contacts: ContactInfo[];
  public readonly tier: "vip" | "regular";
  public readonly reliabilityScore: number;
  public readonly notes: string | null;
  public readonly debtAmountVnd: number;
  public readonly totalImportAmountVnd: number;
  public readonly purchaseOrderCount: number;

  constructor(data: ProviderModelInput) {
    super({
      id: data.id,
      createdAt: data.createdAt,
      updatedAt: data.createdAt,
    });

    this.name = data.name;
    this.code = data.code || null;
    this.status = data.status || null;
    this.contacts = data.contacts || [];
    this.tier = data.tier || "regular";
    this.reliabilityScore = data.reliabilityScore ?? 100;
    this.notes = data.notes || null;
    this.debtAmountVnd = data.debtAmountVnd ?? 0;
    this.totalImportAmountVnd = data.totalImportAmountVnd ?? 0;
    this.purchaseOrderCount = data.purchaseOrderCount ?? 0;
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
   * Định dạng tổng số tiền hàng đã nhập
   */
  public getFormattedTotalImport(): string {
    return this.totalImportAmountVnd.toLocaleString("vi-VN") + " ₫";
  }

  /**
   * Metadata mức độ tin cậy
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
    const reliabilityState = this.getReliabilityState();

    return {
      ...super.toJSON(),
      name: this.name,
      code: this.code,
      status: this.status,
      contacts: this.contacts,
      tier: this.tier,
      reliabilityScore: this.reliabilityScore,
      notes: this.notes,
      debtAmountVnd: this.debtAmountVnd,
      totalImportAmountVnd: this.totalImportAmountVnd,
      purchaseOrderCount: this.purchaseOrderCount,

      // Getters & Helpers
      primaryContact,
      reliabilityState,
      formattedDebt: this.getFormattedDebt(),
      formattedTotalImport: this.getFormattedTotalImport(),
    };
  }
}
