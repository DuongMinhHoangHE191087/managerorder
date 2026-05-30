import { describe, it, expect } from "vitest";
import { ProviderModel } from "../provider.model";

describe("ProviderModel Entity Test", () => {
  const sampleInput = {
    id: "prov-1",
    name: "Supplier Netflix Premium",
    code: "NETFLIX_SUPP",
    status: "active",
    contacts: [
      { id: "contact-1", type: "phone" as const, value: "0909999999", isPrimary: true },
      { id: "contact-2", type: "email" as const, value: "supp@netflix.com", isPrimary: false }
    ],
    tier: "vip" as const,
    reliabilityScore: 95,
    notes: "Nhà cung cấp uy tín nhất",
    debtAmountVnd: 500000,
    totalImportAmountVnd: 15000000,
    purchaseOrderCount: 45,
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  it("nên khởi tạo chính xác các thuộc tính cơ bản", () => {
    const model = new ProviderModel(sampleInput);
    expect(model.id).toBe("prov-1");
    expect(model.name).toBe("Supplier Netflix Premium");
    expect(model.code).toBe("NETFLIX_SUPP");
    expect(model.tier).toBe("vip");
    expect(model.reliabilityScore).toBe(95);
    expect(model.debtAmountVnd).toBe(500000);
    expect(model.totalImportAmountVnd).toBe(15000000);
    expect(model.purchaseOrderCount).toBe(45);
  });

  it("nên trả về thông tin liên lạc chính xác", () => {
    const model = new ProviderModel(sampleInput);
    const primary = model.getPrimaryContact();
    expect(primary).not.toBeNull();
    expect(primary?.type).toBe("phone");
    expect(primary?.value).toBe("0909999999");
  });

  it("nên định dạng dư nợ công nợ và tổng tiền nhập chính xác", () => {
    const model = new ProviderModel(sampleInput);
    expect(model.getFormattedDebt()).toContain("500.000");
    expect(model.getFormattedTotalImport()).toContain("15.000.000");
  });

  it("nên phân tích mức độ tin cậy chính xác", () => {
    const highTrustModel = new ProviderModel(sampleInput);
    expect(highTrustModel.getReliabilityState().label).toBe("Cao");

    const medTrustModel = new ProviderModel({ ...sampleInput, reliabilityScore: 65 });
    expect(medTrustModel.getReliabilityState().label).toBe("Trung bình");

    const lowTrustModel = new ProviderModel({ ...sampleInput, reliabilityScore: 30 });
    expect(lowTrustModel.getReliabilityState().label).toBe("Thấp");
  });

  it("nên serialize thành JSON chính xác", () => {
    const model = new ProviderModel(sampleInput);
    const json = model.toJSON();
    expect(json.name).toBe("Supplier Netflix Premium");
    expect(json.reliabilityState.label).toBe("Cao");
    expect(json.formattedDebt).toContain("500.000");
    expect(json.primaryContact?.value).toBe("0909999999");
  });
});
