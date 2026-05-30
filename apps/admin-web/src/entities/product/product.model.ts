import { BaseModel } from "../base-model";
import type { ProductMode, ProductService } from "@/lib/domain/types";

export interface ProductModelInput {
  id: string;
  name: string;
  mode: ProductMode;
  buyPriceVnd: number;
  sellPriceVnd: number;
  durationType: 'days' | 'months' | 'years';
  durationValue: number;
  isActive: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export class ProductModel extends BaseModel {
  public readonly name: string;
  public readonly mode: ProductMode;
  public readonly buyPriceVnd: number;
  public readonly sellPriceVnd: number;
  public readonly durationType: 'days' | 'months' | 'years';
  public readonly durationValue: number;
  public readonly isActive: boolean;

  constructor(data: ProductModelInput) {
    super({
      id: data.id,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
    });

    this.name = data.name;
    this.mode = data.mode || "slot";
    this.buyPriceVnd = data.buyPriceVnd ?? 0;
    this.sellPriceVnd = data.sellPriceVnd ?? 0;
    this.durationType = data.durationType || "months";
    this.durationValue = data.durationValue ?? 1;
    this.isActive = data.isActive ?? true;
  }

  /**
   * Tính lợi nhuận gộp trên mỗi sản phẩm
   */
  public getProfit(): number {
    return this.sellPriceVnd - this.buyPriceVnd;
  }

  /**
   * Tính tỷ suất lợi nhuận biên (%)
   */
  public getMarginPercent(): number {
    if (this.sellPriceVnd <= 0) return 0;
    return Math.round((this.getProfit() / this.sellPriceVnd) * 100);
  }

  /**
   * Trả về nhãn chế độ cấp phát tiếng Việt
   */
  public getModeLabel(): string {
    switch (this.mode) {
      case "slot":
        return "Slot tài khoản";
      case "key":
        return "Key kích hoạt";
      case "hybrid":
        return "Cấp phát Hybrid";
      default:
        return String(this.mode).toUpperCase();
    }
  }

  /**
   * Formatting Helpers
   */
  public getFormattedSellPrice(): string {
    return this.sellPriceVnd.toLocaleString("vi-VN") + " ₫";
  }

  public getFormattedBuyPrice(): string {
    return this.buyPriceVnd.toLocaleString("vi-VN") + " ₫";
  }

  public getFormattedProfit(): string {
    const profit = this.getProfit();
    return (profit >= 0 ? "+" : "") + profit.toLocaleString("vi-VN") + " ₫";
  }

  public getFormattedDuration(): string {
    const unitMap = {
      days: "ngày",
      months: "tháng",
      years: "năm"
    };
    return `${this.durationValue} ${unitMap[this.durationType] || this.durationType}`;
  }

  /**
   * Serialize thành JSON
   */
  public override toJSON(): Record<string, any> {
    const profit = this.getProfit();
    const marginPercent = this.getMarginPercent();
    const modeLabel = this.getModeLabel();
    const formattedDuration = this.getFormattedDuration();

    return {
      ...super.toJSON(),
      name: this.name,
      mode: this.mode,
      buyPriceVnd: this.buyPriceVnd,
      sellPriceVnd: this.sellPriceVnd,
      durationType: this.durationType,
      durationValue: this.durationValue,
      isActive: this.isActive,

      // Getters & Helpers
      profit,
      marginPercent,
      modeLabel,
      formattedDuration,
      formattedSellPrice: this.getFormattedSellPrice(),
      formattedBuyPrice: this.getFormattedBuyPrice(),
      formattedProfit: this.getFormattedProfit(),
    };
  }
}
