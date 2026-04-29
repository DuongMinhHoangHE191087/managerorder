import { describe, it, expect, vi } from "vitest";

// Mock supabaseAdmin to prevent env var requirement
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {},
}));

import {
  resolveOrderStatus,
  findProductByPlanSlug,
  ImportService,
  preValidateRecords,
  type ImportRecord,
} from "../import.service";

// ── resolveOrderStatus ────────────────────────────────────────

describe("resolveOrderStatus", () => {
  it("returns normalizedStatus when present", () => {
    const rec = { normalizedStatus: "paid" } as ImportRecord;
    expect(resolveOrderStatus(rec)).toBe("paid");
  });

  it("falls back to normalizePaymentStatus from rawPaymentStatus", () => {
    const rec = {
      rawPaymentStatus: "Đã thanh toán",
      totalAmountVnd: 100,
      totalPaid: 0,
      quantity: 1,
      customerName: "A",
      productName: "B",
    } as ImportRecord;
    expect(resolveOrderStatus(rec)).toBe("paid");
  });

  it("returns paid when totalPaid >= totalAmountVnd > 0", () => {
    const rec = {
      totalAmountVnd: 500,
      totalPaid: 500,
      quantity: 1,
      customerName: "A",
      productName: "B",
    } as ImportRecord;
    expect(resolveOrderStatus(rec)).toBe("paid");
  });

  it("returns pending_payment when partial payment", () => {
    const rec = {
      totalAmountVnd: 500,
      totalPaid: 200,
      quantity: 1,
      customerName: "A",
      productName: "B",
    } as ImportRecord;
    expect(resolveOrderStatus(rec)).toBe("pending_payment");
  });

  it("returns draft when no payment at all", () => {
    const rec = {
      totalAmountVnd: 500,
      totalPaid: 0,
      quantity: 1,
      customerName: "A",
      productName: "B",
    } as ImportRecord;
    expect(resolveOrderStatus(rec)).toBe("draft");
  });

  it("returns draft when zero totalAmountVnd and zero totalPaid", () => {
    const rec = {
      totalAmountVnd: 0,
      totalPaid: 0,
      quantity: 1,
      customerName: "A",
      productName: "B",
    } as ImportRecord;
    expect(resolveOrderStatus(rec)).toBe("draft");
  });

  it("handles refunded via rawPaymentStatus", () => {
    const rec = {
      rawPaymentStatus: "Hoàn tiền",
      totalAmountVnd: 0,
      totalPaid: 0,
      quantity: 1,
      customerName: "A",
      productName: "B",
    } as ImportRecord;
    expect(resolveOrderStatus(rec)).toBe("refunded");
  });
});

// ── findProductByPlanSlug ────────────────────────────────────

describe("findProductByPlanSlug", () => {
  // normalizePlanName("Duolingo Plus 1 Tháng") → "duolingo-plus-1-tháng"
  const productMap = new Map([
    ["duolingo-plus-1-tháng", { id: "p1", name: "Duolingo Plus 1 Tháng" }],
    ["premium-6-tháng", { id: "p2", name: "Premium 6 Tháng" }],
  ]);

  it("finds exact slug match", () => {
    const result = findProductByPlanSlug("Duolingo Plus 1 Tháng", productMap);
    expect(result?.id).toBe("p1");
  });

  it("finds partial slug match (slug contains key)", () => {
    // "duolingo-plus-1-tháng-vip" includes "duolingo-plus-1-tháng"
    const result = findProductByPlanSlug("Duolingo Plus 1 Tháng VIP", productMap);
    expect(result?.id).toBe("p1");
  });

  it("returns undefined when no match", () => {
    const result = findProductByPlanSlug("Unknown Product", productMap);
    expect(result).toBeUndefined();
  });

  it("handles empty product map", () => {
    const result = findProductByPlanSlug("Anything", new Map());
    expect(result).toBeUndefined();
  });
});

// ── ImportService.buildOrderInserts ────────────────────────────

describe("ImportService.buildOrderInserts", () => {
  const service = new ImportService();

  it("builds correct order insert with all fields", () => {
    const records: ImportRecord[] = [
      {
        customerName: "John",
        productName: "Premium",
        quantity: 2,
        totalAmountVnd: 1000,
        totalPaid: 1000,
        paymentMethod: "Banking",
      } as ImportRecord,
    ];
    const customerMap = new Map([["john", "00000000-0000-4000-8000-000000000005"]]);
    const productMap = new Map([
      ["premium", { id: "00000000-0000-4000-8000-000000000039", name: "Premium" }],
    ]);

    const inserts = service.buildOrderInserts("00000000-0000-4000-8000-000000000016", records, customerMap, productMap);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].account_id).toBe("00000000-0000-4000-8000-000000000016");
    expect(inserts[0].customer_id).toBe("00000000-0000-4000-8000-000000000005");
    expect(inserts[0].product_id).toBe("00000000-0000-4000-8000-000000000039");
    expect(inserts[0].unit_price_vnd).toBe(500); // 1000 / 2
    expect(inserts[0].status).toBe("paid");
  });

  it("handles missing customer and product gracefully", () => {
    const records: ImportRecord[] = [
      {
        customerName: "Unknown",
        productName: "Mystery",
        quantity: 1,
        totalAmountVnd: 0,
        totalPaid: 0,
      } as ImportRecord,
    ];

    const inserts = service.buildOrderInserts("00000000-0000-4000-8000-000000000016", records, new Map(), new Map());
    expect(inserts[0].customer_id).toBeNull();
    expect(inserts[0].product_id).toBeNull();
  });

  it("appends CTV and Family to salesNote", () => {
    const records: ImportRecord[] = [
      {
        customerName: "A",
        productName: "B",
        quantity: 1,
        totalAmountVnd: 0,
        totalPaid: 0,
        ctvName: "Agent001",
        sourceUsername: "family-nick",
      } as ImportRecord,
    ];

    const inserts = service.buildOrderInserts("00000000-0000-4000-8000-000000000016", records, new Map(), new Map());
    expect(inserts[0].sales_note).toContain("CTV: Agent001");
    expect(inserts[0].sales_note).toContain("Family: family-nick");
  });
});

// ── ImportService.buildOrderItemInserts ────────────────────────

describe("ImportService.buildOrderItemInserts", () => {
  const service = new ImportService();

  it("builds order items linked to inserted orders", () => {
    const insertedOrders = [{ id: "00000000-0000-4000-8000-00000000000f", product_id: "00000000-0000-4000-8000-000000000039" }];
    const records: ImportRecord[] = [
      {
        customerName: "A",
        productName: "Premium",
        quantity: 3,
        totalAmountVnd: 900,
        totalPaid: 900,
      } as ImportRecord,
    ];
    const productMap = new Map([
      ["premium", { id: "00000000-0000-4000-8000-000000000039", name: "Premium", buy_price_vnd: 100 }],
    ]);

    const items = service.buildOrderItemInserts(insertedOrders, records, productMap);
    expect(items).toHaveLength(1);
    expect(items[0].order_id).toBe("00000000-0000-4000-8000-00000000000f");
    expect(items[0].price_vnd).toBe(300); // 900 / 3
    expect(items[0].cost_price_vnd).toBe(100);
  });
});

// ── preValidateRecords ────────────────────────────────────────

describe("preValidateRecords", () => {
  const validRecord = (): ImportRecord => ({
    customerName: "Nguyễn Văn A",
    productName: "Premium 6 Tháng",
    quantity: 1,
    totalAmountVnd: 500000,
    totalPaid: 500000,
  } as ImportRecord);

  it("returns valid=true for correct records", () => {
    const result = preValidateRecords([validRecord()]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors on missing customerName", () => {
    const rec = validRecord();
    rec.customerName = "";
    const result = preValidateRecords([rec]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("customerName");
  });

  it("errors on missing productName", () => {
    const rec = validRecord();
    rec.productName = "";
    const result = preValidateRecords([rec]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("productName");
  });

  it("errors on invalid phone format", () => {
    const rec = validRecord();
    rec.customerPhone = "abc123";
    const result = preValidateRecords([rec]);
    expect(result.errors.some(e => e.field === "customerPhone")).toBe(true);
  });

  it("passes valid phone formats", () => {
    const rec = validRecord();
    rec.customerPhone = "0901234567";
    const result = preValidateRecords([rec]);
    expect(result.errors.some(e => e.field === "customerPhone")).toBe(false);
  });

  it("errors on invalid email", () => {
    const rec = validRecord();
    rec.customerEmail = "not-an-email";
    const result = preValidateRecords([rec]);
    expect(result.errors.some(e => e.field === "customerEmail")).toBe(true);
  });

  it("errors when endDate is before startDate (using Date parsing)", () => {
    const rec = validRecord();
    rec.startDate = "2025-06-15";
    rec.endDate = "2025-01-01";
    const result = preValidateRecords([rec]);
    expect(result.errors.some(e => e.field === "endDate")).toBe(true);
  });

  it("passes when startDate is before endDate", () => {
    const rec = validRecord();
    rec.startDate = "2025-01-01";
    rec.endDate = "2025-06-15";
    const result = preValidateRecords([rec]);
    expect(result.errors.some(e => e.field === "endDate")).toBe(false);
  });

  it("errors on amount exceeding 1 billion VND", () => {
    const rec = validRecord();
    rec.totalAmountVnd = 2_000_000_000;
    const result = preValidateRecords([rec]);
    expect(result.errors.some(e => e.message.includes("1 tỷ"))).toBe(true);
  });

  it("warns on overpayment (totalPaid > totalAmountVnd)", () => {
    const rec = validRecord();
    rec.totalAmountVnd = 100000;
    rec.totalPaid = 200000;
    const result = preValidateRecords([rec]);
    expect(result.warnings.some(w => w.field === "totalPaid")).toBe(true);
  });

  it("detects duplicate fingerprint within batch", () => {
    const rec1 = validRecord();
    const rec2 = validRecord(); // same fingerprint
    const result = preValidateRecords([rec1, rec2]);
    expect(result.warnings.some(w => w.field === "_duplicate")).toBe(true);
  });

  it("does NOT flag different orders as duplicates", () => {
    const rec1 = validRecord();
    const rec2 = validRecord();
    rec2.productName = "Basic 1 Tháng"; // different product
    const result = preValidateRecords([rec1, rec2]);
    expect(result.warnings.some(w => w.field === "_duplicate")).toBe(false);
  });

  it("errors on negative quantity", () => {
    const rec = validRecord();
    rec.quantity = -1;
    const result = preValidateRecords([rec]);
    expect(result.errors.some(e => e.field === "quantity")).toBe(true);
  });
});
