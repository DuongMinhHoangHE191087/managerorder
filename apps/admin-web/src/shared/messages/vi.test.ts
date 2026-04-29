import { describe, expect, it } from "vitest";
import { vi } from "@/shared/messages/vi";

describe("vi messages", () => {
  it("repairs critical navigation labels without mojibake", () => {
    expect(vi.common.loading).toBe("\u0110ang t\u1ea3i...");
    expect(vi.navigation.sections.operations).toBe("\u0110i\u1ec1u h\u00e0nh");
    expect(vi.navigation.items.dashboard).toBe("T\u1ed5ng quan");
    expect(vi.navigation.items.customers).toBe("Kh\u00e1ch h\u00e0ng");
    expect(vi.navigation.items.healthChecks).toBe("S\u1ee9c kh\u1ecfe");
    expect(vi.navigation.items.renewals).toBe("Gia h\u1ea1n");
    expect(vi.navigation.items.trash).toBe("Th\u00f9ng r\u00e1c");
    expect(vi.navigation.actions.quickSearch).toBe("T\u00ecm nhanh");
  });

  it("keeps customer intake and trash strings in clean utf-8", () => {
    expect(vi.customers.header.title).toBe("Kh\u00e1ch h\u00e0ng");
    expect(vi.customers.header.create).toBe("Th\u00eam kh\u00e1ch h\u00e0ng");
    expect(vi.customers.list.noCustomers).toBe("Kh\u00f4ng c\u00f3 kh\u00e1ch h\u00e0ng n\u00e0o");
    expect(vi.customers.detail.tabs.orders).toBe("\u0110\u01a1n h\u00e0ng & TT");
    expect(vi.customers.import.resultTitle).toBe("K\u1ebft qu\u1ea3 import");
    expect(vi.customers.export.columns.notes).toBe("Ghi ch\u00fa");
    expect(vi.customers.newPage.title).toBe("T\u1ea1o kh\u00e1ch h\u00e0ng m\u1edbi");
    expect(vi.customers.createModal.titleCustomer).toBe("T\u1ea1o kh\u00e1ch h\u00e0ng m\u1edbi");
    expect(vi.customers.createModal.entityTypes.customer.label).toBe("Kh\u00e1ch h\u00e0ng");
    expect(vi.customers.editModal.title).toBe("C\u1eadp nh\u1eadt h\u1ed3 s\u01a1 kh\u00e1ch h\u00e0ng");
    expect(vi.customers.dynamicContactList.title).toBe("Th\u00f4ng tin li\u00ean h\u1ec7");
    expect(vi.trash.page.title).toBe("Th\u00f9ng r\u00e1c");
    expect(vi.trash.tabs.shortLinks).toBe("Link r\u00fat g\u1ecdn");
    expect(vi.trash.page.deleteForeverConfirmText).toBe("X\u00d3A V\u0128NH VI\u1ec4N");
  });

  it("repairs dashboard and inventory operational labels used on cards", () => {
    expect(vi.dashboard.kpis.collected("TH\u00c1NG")).toBe("\u0110\u00e3 thu (TH\u00c1NG)");
    expect(vi.dashboard.kpis.totalProfit("TH\u00c1NG")).toBe("T\u1ed5ng l\u1ee3i nhu\u1eadn (TH\u00c1NG)");
    expect(vi.dashboard.alerts.pendingOrdersCount(0)).toBe("0 \u0111\u01a1n ch\u1edd thanh to\u00e1n");
    expect(vi.dashboard.alerts.pendingOrdersEmpty).toBe("Kh\u00f4ng c\u00f3 \u0111\u01a1n h\u00e0ng ch\u1edd");

    expect(vi.inventory.page.pendingOrders.title).toBe("\u0110\u01a1n h\u00e0ng ch\u1edd c\u1ea5p ph\u00e1t");
    expect(vi.inventory.page.pendingOrders.empty).toBe("Kh\u00f4ng c\u00f3 \u0111\u01a1n ch\u1edd c\u1ea5p ph\u00e1t");
    expect(vi.inventory.page.pendingOrders.headers.customerOrder).toBe("Kh\u00e1ch h\u00e0ng / M\u00e3 \u0110\u01a1n");
    expect(vi.inventory.page.pendingOrders.paymentStatus.pendingPayment).toBe("Ch\u1edd Thanh To\u00e1n");
  });

  it("repairs dynamic short-link labels returned from message functions", () => {
    expect(vi.shortLinks.page.listDescription(17)).toBe("T\u1ed5ng: 17 link");
    expect(vi.shortLinks.page.selectedCount(3)).toBe("3 link \u0111\u00e3 ch\u1ecdn");
    expect(vi.shortLinks.page.bulkRenewSuccess(7, 2)).toBe("\u0110\u00e3 gia h\u1ea1n 7 ng\u00e0y cho 2 link");
    expect(vi.shortLinks.card.clicksShort(0, 3)).toBe("0/3 l\u01b0\u1ee3t nh\u1ea5p");
    expect(vi.shortLinks.analytics.clickLog(5)).toBe("Nh\u1eadt k\u00fd l\u01b0\u1ee3t nh\u1ea5p chi ti\u1ebft (5 b\u1ea3n ghi)");
    expect(vi.shortLinks.detail.maxClicksSummary(12)).toBe("/ 12 t\u1ed1i \u0111a");
  });
});
