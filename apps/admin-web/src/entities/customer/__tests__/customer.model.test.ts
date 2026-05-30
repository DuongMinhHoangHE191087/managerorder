import { describe, it, expect } from "vitest";
import { CustomerModel } from "../customer.model";

describe("CustomerModel Entity Test", () => {
  const sampleInput = {
    id: "cust-1",
    name: "Nguyễn Văn A",
    contacts: [
      { id: "contact-1", type: "zalo" as const, value: "0901234567", isPrimary: true },
      { id: "contact-2", type: "email" as const, value: "a@gmail.com", isPrimary: false }
    ],
    tier: "vip" as const,
    customerType: "retail" as const,
    group_id: "group-vip",
    tags: [
      { id: "tag-1", name: "Khách sỉ", color: "#ff0000" }
    ],
    debtAmountVnd: 600000,
    debtOverdueDays: 10,
    totalSpentVnd: 2000000,
    balanceVnd: 100000,
    reliabilityScore: 90,
    notes: "Khách vip nhiệt tình",
    createdAt: "2026-05-01T00:00:00.000Z",
    segment: "vip" as const,
    rfmScore: 555
  };

  it("nên khởi tạo chính xác các thuộc tính cơ bản", () => {
    const model = new CustomerModel(sampleInput);
    expect(model.id).toBe("cust-1");
    expect(model.name).toBe("Nguyễn Văn A");
    expect(model.tier).toBe("vip");
    expect(model.customerType).toBe("retail");
    expect(model.debtAmountVnd).toBe(600000);
    expect(model.debtOverdueDays).toBe(10);
    expect(model.totalSpentVnd).toBe(2000000);
    expect(model.balanceVnd).toBe(100000);
    expect(model.reliabilityScore).toBe(90);
  });

  it("nên trả về thông tin liên lạc chính xác", () => {
    const model = new CustomerModel(sampleInput);
    const primary = model.getPrimaryContact();
    expect(primary).not.toBeNull();
    expect(primary?.type).toBe("zalo");
    expect(primary?.value).toBe("0901234567");
  });

  it("nên định dạng tiền tệ công nợ, số dư, chi tiêu chính xác", () => {
    const model = new CustomerModel(sampleInput);
    expect(model.getFormattedDebt()).toContain("600.000");
    expect(model.getFormattedTotalSpent()).toContain("2.000.000");
    expect(model.getFormattedBalance()).toContain("100.000");
  });

  it("nên phân tích phân khúc RFM chính xác", () => {
    const vipModel = new CustomerModel(sampleInput);
    expect(vipModel.getSegmentMeta().label).toBe("VIP");

    const loyalModel = new CustomerModel({ ...sampleInput, segment: "loyal" });
    expect(loyalModel.getSegmentMeta().label).toBe("Thân thiết");

    const churnedModel = new CustomerModel({ ...sampleInput, segment: "churned" });
    expect(churnedModel.getSegmentMeta().label).toBe("Rời bỏ");
  });

  it("nên trả về mức độ cảnh báo dư nợ chính xác", () => {
    const model = new CustomerModel(sampleInput);
    expect(model.getDebtState()).toBe("critical"); // > 7 days or > 500k

    const lowDebtModel = new CustomerModel({ ...sampleInput, debtAmountVnd: 100000, debtOverdueDays: 2 });
    expect(lowDebtModel.getDebtState()).toBe("warning");

    const noDebtModel = new CustomerModel({ ...sampleInput, debtAmountVnd: 0, debtOverdueDays: 0 });
    expect(noDebtModel.getDebtState()).toBe("normal");
  });

  it("nên trả về trạng thái tin cậy chính xác", () => {
    const model = new CustomerModel(sampleInput);
    expect(model.getReliabilityState().label).toBe("Cao");

    const lowReliabilityModel = new CustomerModel({ ...sampleInput, reliabilityScore: 40 });
    expect(lowReliabilityModel.getReliabilityState().label).toBe("Thấp");
  });

  it("nên serialize thành JSON chính xác", () => {
    const model = new CustomerModel(sampleInput);
    const json = model.toJSON();
    expect(json.name).toBe("Nguyễn Văn A");
    expect(json.debtState).toBe("critical");
    expect(json.formattedDebt).toContain("600.000");
    expect(json.primaryContact?.value).toBe("0901234567");
  });
});
