import { describe, it, expect } from "vitest";
import { OrderModel } from "../order.model";

describe("OrderModel Entity Test", () => {
  const sampleInput = {
    id: "order-123",
    order_code: "DMH_ABCD_250526",
    customer_id: "cust-999",
    product_id: "prod-duolingo",
    quantity: 1,
    total_amount_vnd: 120000,
    total_paid: 120000,
    total_cost_vnd: 40000,
    status: "active",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    expires_at: "2026-06-01T00:00:00.000Z",
    customerName: "Nguyễn Văn A",
    productName: "Duolingo Super 12 Months",
    customerContacts: [
      { channel: "zalo", value: "0901234567", is_verified: true }
    ],
  };

  it("nên khởi tạo chính xác các thuộc tính cơ bản", () => {
    const model = new OrderModel(sampleInput);
    expect(model.id).toBe("order-123");
    expect(model.orderCode).toBe("DMH_ABCD_250526");
    expect(model.totalAmountVnd).toBe(120000);
    expect(model.totalCostVnd).toBe(40000);
    expect(model.status).toBe("active");
  });

  it("nên tính toán lợi nhuận chính xác", () => {
    const model = new OrderModel(sampleInput);
    expect(model.getProfit()).toBe(80000); // 120000 - 40000
  });

  it("nên tính số ngày còn lại chính xác", () => {
    const model = new OrderModel(sampleInput);
    // Giả sử hôm nay là 2026-05-25
    const today = new Date("2026-05-25T00:00:00.000Z");
    // Hạn là 2026-06-01. Số ngày còn lại: 1 -> 31 (tháng 5 có 31 ngày) -> từ 25 đến 31 là 6 ngày + 1 ngày tháng 6 = 7 ngày.
    expect(model.getDaysLeft(today)).toBe(7);
  });

  it("nên trả về trạng thái khẩn cấp chính xác", () => {
    const model = new OrderModel(sampleInput);
    
    // Còn 7 ngày -> soon
    const todaySoon = new Date("2026-05-25T00:00:00.000Z");
    expect(model.getUrgencyState(todaySoon)).toBe("soon");

    // Còn 20 ngày -> ok
    const todayOk = new Date("2026-05-12T00:00:00.000Z");
    expect(model.getUrgencyState(todayOk)).toBe("ok");

    // Quá hạn -> expired
    const todayExpired = new Date("2026-06-05T00:00:00.000Z");
    expect(model.getUrgencyState(todayExpired)).toBe("expired");
  });

  it("nên trả về contact chính xác", () => {
    const model = new OrderModel(sampleInput);
    const primary = model.getPrimaryContact();
    expect(primary).not.toBeNull();
    expect(primary?.channel).toBe("zalo");
    expect(primary?.value).toBe("0901234567");
  });

  it("nên phân tích contact_snapshot khi không có customerContacts", () => {
    const model = new OrderModel({
      ...sampleInput,
      customerContacts: null,
      contact_snapshot: "Zalo: 0987654321"
    });
    const primary = model.getPrimaryContact();
    expect(primary).not.toBeNull();
    expect(primary?.channel).toBe("zalo");
    expect(primary?.value).toBe("0987654321");
  });

  it("nên trả về status metadata chính xác", () => {
    const activeModel = new OrderModel(sampleInput);
    expect(activeModel.getStatusMeta().label).toBe("Active");
    expect(activeModel.getStatusMeta().tone).toBe("green");

    const pendingModel = new OrderModel({ ...sampleInput, status: "pending_payment" });
    expect(pendingModel.getStatusMeta().label).toBe("Chờ TT");
    expect(pendingModel.getStatusMeta().tone).toBe("amber");
  });

  it("nên serialize thành JSON chính xác", () => {
    const model = new OrderModel(sampleInput);
    const json = model.toJSON();
    expect(json.profit).toBe(80000);
    expect(json.formattedAmount).toBe("120.000 ₫");
    expect(json.formattedProfit).toBe("+80.000 ₫");
    expect(json.primaryContact?.value).toBe("0901234567");
  });
});
