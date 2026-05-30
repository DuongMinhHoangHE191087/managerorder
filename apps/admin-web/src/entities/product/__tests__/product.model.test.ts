import { describe, it, expect } from "vitest";
import { ProductModel } from "../product.model";

describe("ProductModel Entity Test", () => {
  const sampleInput = {
    id: "prod-1",
    name: "Netflix Premium 1 Month",
    mode: "slot" as const,
    buyPriceVnd: 30000,
    sellPriceVnd: 65000,
    durationType: "months" as const,
    durationValue: 1,
    isActive: true,
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  it("nên khởi tạo chính xác các thuộc tính cơ bản", () => {
    const model = new ProductModel(sampleInput);
    expect(model.id).toBe("prod-1");
    expect(model.name).toBe("Netflix Premium 1 Month");
    expect(model.mode).toBe("slot");
    expect(model.buyPriceVnd).toBe(30000);
    expect(model.sellPriceVnd).toBe(65000);
    expect(model.isActive).toBe(true);
  });

  it("nên tính toán lợi nhuận gộp chính xác", () => {
    const model = new ProductModel(sampleInput);
    expect(model.getProfit()).toBe(35000); // 65000 - 30000
    expect(model.getFormattedProfit()).toContain("+35.000");
  });

  it("nên tính tỷ suất lợi nhuận biên chính xác", () => {
    const model = new ProductModel(sampleInput);
    // (65000 - 30000) / 65000 * 100 = 53.84% ~ 54%
    expect(model.getMarginPercent()).toBe(54);
  });

  it("nên định dạng nhãn chế độ tiếng Việt chính xác", () => {
    const slotModel = new ProductModel(sampleInput);
    expect(slotModel.getModeLabel()).toBe("Slot tài khoản");

    const keyModel = new ProductModel({ ...sampleInput, mode: "key" });
    expect(keyModel.getModeLabel()).toBe("Key kích hoạt");

    const hybridModel = new ProductModel({ ...sampleInput, mode: "hybrid" });
    expect(hybridModel.getModeLabel()).toBe("Cấp phát Hybrid");
  });

  it("nên định dạng thời hạn tiếng Việt chính xác", () => {
    const monthModel = new ProductModel(sampleInput);
    expect(monthModel.getFormattedDuration()).toBe("1 tháng");

    const dayModel = new ProductModel({ ...sampleInput, durationType: "days", durationValue: 7 });
    expect(dayModel.getFormattedDuration()).toBe("7 ngày");
  });

  it("nên serialize thành JSON chính xác", () => {
    const model = new ProductModel(sampleInput);
    const json = model.toJSON();
    expect(json.profit).toBe(35000);
    expect(json.marginPercent).toBe(54);
    expect(json.modeLabel).toBe("Slot tài khoản");
    expect(json.formattedSellPrice).toContain("65.000");
  });
});
