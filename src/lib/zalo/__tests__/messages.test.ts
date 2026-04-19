import { describe, expect, it } from "vitest";
import {
  formatZaloIdStatus,
  formatZaloOrderLookup,
  formatZaloProductCatalog,
  formatZaloStartupNotification,
} from "../messages";

describe("zalo messages", () => {
  it("formats /id with status and capabilities", () => {
    const text = formatZaloIdStatus({
      userId: "user-1",
      chatId: "chat-1",
      accountId: "account-1",
      mode: "human-handoff",
      capabilities: {
        ai: true,
        catalog: true,
        orderLookup: true,
        humanHandoff: true,
        adminNotify: true,
        gemini: true,
      },
      adminCount: 2,
      displayName: "Nguyen A",
    });

    expect(text).toContain("user-1");
    expect(text).toContain("chat-1");
    expect(text).toContain("account-1");
    expect(text).toContain("human-handoff");
    expect(text).toContain("AI (Gemini)");
    expect(text).toContain("admin notify");
  });

  it("formats product and order lists", () => {
    const productText = formatZaloProductCatalog([
      {
        id: "p-1",
        name: "ChatGPT Plus",
        mode: "key",
        durationType: "months",
        durationValue: 1,
        buyPriceVnd: 100000,
        sellPriceVnd: 199000,
        isActive: true,
        createdAt: "2026-04-08T00:00:00.000Z",
      },
    ]);

    expect(productText).toContain("ChatGPT Plus");
    expect(productText).toContain("199.000đ");

    const orderText = formatZaloOrderLookup("DMH_A1B2", [
      {
        id: "o-1",
        orderCode: "DMH_A1B2",
        customerName: "Nguyen A",
        productNameSnapshot: "ChatGPT Plus",
        totalAmountVnd: 199000,
        totalPaid: 99000,
        status: "pending_payment",
        expiresAt: "2026-05-01T00:00:00.000Z",
        createdAt: "2026-04-08T00:00:00.000Z",
      },
    ]);

    expect(orderText).toContain("DMH_A1B2");
    expect(orderText).toContain("Nguyen A");
    expect(orderText).toContain("chờ thanh toán");
  });

  it("formats startup notification", () => {
    const text = formatZaloStartupNotification({
      botName: "ManagerOrder Zalo Bot",
      botUserId: "bot-1",
      accountId: "account-1",
      capabilities: {
        ai: true,
        catalog: true,
        orderLookup: true,
        humanHandoff: true,
        adminNotify: true,
        gemini: false,
      },
      adminCount: 1,
      startedAt: new Date("2026-04-08T00:00:00.000Z"),
    });

    expect(text).toContain("bot đã chạy thành công");
    expect(text).toContain("ManagerOrder Zalo Bot");
    expect(text).toContain("account-1");
  });
});
