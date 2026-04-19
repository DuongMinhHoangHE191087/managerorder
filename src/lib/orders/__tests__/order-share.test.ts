import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/utils";
import {
  buildOrderCustomerSuccessMessage,
  buildOrderInvoiceSummaryMessage,
  type OrderSuccessSnapshot,
} from "../order-share";

const snapshot: OrderSuccessSnapshot = {
  orderId: "order_1234567890",
  orderCode: "ORD-2026-001",
  invoiceNumber: "INV-20260410-567890",
  customerName: "Nguyễn Văn A",
  customerContact: "0901234567",
  paymentMethodLabel: "Trả trước",
  paymentSourceName: "MB Bank",
  salesChannelName: "Facebook",
  totalVnd: 250_000,
  registeredAt: "2026-04-10T00:00:00.000Z",
  expiresAt: "2026-05-10T00:00:00.000Z",
  paymentInstructionText: "Ngân hàng: MB Bank\nSố tài khoản: 0123456789",
  paymentNote: "DH001",
  items: [
    {
      name: "Netflix 1 tháng",
      quantity: 2,
      unitPriceVnd: 125_000,
      lineTotalVnd: 250_000,
      durationLabel: "1 tháng",
    },
  ],
  billingDetails: {
    companyName: "Công ty ABC",
    taxId: "0101234567",
    companyAddress: "Hà Nội",
    email: "billing@abc.com",
  },
  warning: "Kho chỉ còn 1 slot",
  createdAt: "2026-04-10T10:00:00.000Z",
};

describe("order-share messages", () => {
  it("builds a customer success message with order and payment context", () => {
    const message = buildOrderCustomerSuccessMessage(snapshot);

    expect(message).toContain("Chào");
    expect(message).toContain("#ORD-2026-001");
    expect(message).toContain(`Tổng tiền: ${formatMoney(250_000)}`);
    expect(message).toContain("Thanh toán: Trả trước");
    expect(message).toContain("Sản phẩm: Netflix 1 tháng x2");
  });

  it("builds an invoice summary with billing details", () => {
    const message = buildOrderInvoiceSummaryMessage(snapshot);

    expect(message).toContain("TÓM TẮT HOÁ ĐƠN");
    expect(message).toContain("INV-20260410-567890");
    expect(message).toContain("Công ty ABC");
    expect(message).toContain("MST: 0101234567");
    expect(message).toContain("Chi tiết sản phẩm");
  });
});
