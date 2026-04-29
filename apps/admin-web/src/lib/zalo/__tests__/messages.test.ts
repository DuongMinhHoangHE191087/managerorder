import { describe, expect, it } from "vitest";
import {
  formatZaloHelpMessage,
  formatZaloIdStatus,
  formatZaloOrderLookup,
  formatZaloProductCatalog,
  formatZaloStartupNotification,
} from "../messages";

describe("zalo messages", () => {
  it("formats /id with status and capabilities", () => {
    const text = formatZaloIdStatus({
      userId: "00000000-0000-4000-8000-000000000088",
      chatId: "00000000-0000-4000-8000-00000000007c",
      accountId: "00000000-0000-4000-8000-000000000009",
      mode: "human-handoff",
      capabilities: {
        ai: true,
        catalog: true,
        orderLookup: true,
        orderCreation: true,
        humanHandoff: true,
        adminNotify: true,
        gemini: true,
      },
      adminCount: 2,
      displayName: "Nguyen A",
    });

    expect(text).toContain("00000000-0000-4000-8000-000000000088");
    expect(text).toContain("00000000-0000-4000-8000-00000000007c");
    expect(text).toContain("00000000-0000-4000-8000-000000000009");
    expect(text).toContain("human-handoff");
    expect(text).toContain("AI (Gemini)");
    expect(text).toContain("admin notify");
  });

  it("formats product and order lists", () => {
    const productText = formatZaloProductCatalog([
      {
        id: "00000000-0000-4000-8000-0000000003ed",
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
        id: "00000000-0000-4000-8000-0000000003f9",
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
      botUserId: "00000000-0000-4000-8000-000000000167",
      accountId: "00000000-0000-4000-8000-000000000009",
      capabilities: {
        ai: true,
        catalog: true,
        orderLookup: true,
        orderCreation: true,
        humanHandoff: true,
        adminNotify: true,
        gemini: false,
      },
      adminCount: 1,
      startedAt: new Date("2026-04-08T00:00:00.000Z"),
    });

    expect(text).toContain("bot đã chạy thành công");
    expect(text).toContain("ManagerOrder Zalo Bot");
    expect(text).toContain("00000000-0000-4000-8000-000000000009");
  });

  it("includes order flow commands in help", () => {
    const text = formatZaloHelpMessage({
      botToken: "token",
      accountId: "account",
      adminUserIds: [],
      geminiApiKey: "",
      geminiModel: "gemini-2.5-flash",
      appName: "ManagerOrder",
      accountBound: true,
      capabilities: {
        ai: true,
        catalog: true,
        orderLookup: true,
        orderCreation: true,
        humanHandoff: false,
        adminNotify: false,
        gemini: false,
      },
      warnings: [],
    });

    expect(text).toContain("/neworder");
    expect(text).toContain("/cancel");
  });
});
