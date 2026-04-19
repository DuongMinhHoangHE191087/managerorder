import { describe, it, expect } from "vitest";
import {
  mapCustomerRow,
  mapProviderRow,
  mapProductRow,
  mapCalendarEventRow,
} from "../mappers";

/* ─── mapCustomerRow ──────────────────────────────────────── */
describe("mapCustomerRow", () => {
  it("maps basic DB fields correctly", () => {
    const row = {
      id: "123",
      full_name: "Nguyễn Văn A",
      type: "retail",
      debt_amount_vnd: 100000,
      debt_overdue_days: 5,
      reliability_score: 90,
      created_at: "2026-01-01T00:00:00Z",
    };
    const result = mapCustomerRow(row);
    expect(result.id).toBe("123");
    expect(result.name).toBe("Nguyễn Văn A");
    expect(result.customerType).toBe("retail");
    expect(result.debtAmountVnd).toBe(100000);
    expect(result.debtOverdueDays).toBe(5);
    expect(result.reliabilityScore).toBe(90);
  });

  it("maps RFM fields when present", () => {
    const row = {
      id: "1",
      full_name: "Test",
      type: "wholesale",
      segment: "vip",
      rfm_score: 85,
      rfm_recency: 5,
      rfm_frequency: 4,
      rfm_monetary: 5,
      last_rfm_calculated_at: "2026-03-01T00:00:00Z",
    };
    const result = mapCustomerRow(row);
    expect(result.segment).toBe("vip");
    expect(result.rfmScore).toBe(85);
    expect(result.rfmRecency).toBe(5);
    expect(result.rfmFrequency).toBe(4);
    expect(result.rfmMonetary).toBe(5);
    expect(result.lastRfmCalculatedAt).toBe("2026-03-01T00:00:00Z");
  });

  it("returns undefined RFM fields when not present", () => {
    const row = { id: "1", full_name: "Test" };
    const result = mapCustomerRow(row);
    expect(result.segment).toBeUndefined();
    expect(result.rfmScore).toBeUndefined();
    expect(result.rfmRecency).toBeUndefined();
  });

  it("rejects invalid segment values", () => {
    const row = { id: "1", full_name: "Test", segment: "invalid_segment" };
    const result = mapCustomerRow(row);
    expect(result.segment).toBeUndefined();
  });

  it("validates all valid segment values", () => {
    const segments = ["vip", "loyal", "regular", "at_risk", "churned"] as const;
    for (const seg of segments) {
      const result = mapCustomerRow({ id: "1", full_name: "Test", segment: seg });
      expect(result.segment).toBe(seg);
    }
  });

  it("defaults customerType to retail for invalid values", () => {
    const row = { id: "1", full_name: "Test", type: "unknown" };
    const result = mapCustomerRow(row);
    expect(result.customerType).toBe("retail");
  });

  it("maps contacts from customer_contacts array", () => {
    const row = {
      id: "1",
      full_name: "Test",
      customer_contacts: [
        { id: "c1", channel: "phone", value: "0901234567", is_primary: true },
        { id: "c2", channel: "email", value: "a@b.com", is_primary: false },
      ],
    };
    const result = mapCustomerRow(row);
    expect(result.contacts.length).toBe(2);
    expect(result.contacts[0].type).toBe("phone");
    expect(result.contacts[0].isPrimary).toBe(true);
  });

  it("handles missing fields with defaults", () => {
    const row = {};
    const result = mapCustomerRow(row);
    expect(result.id).toBe("");
    expect(result.name).toBe("");
    expect(result.customerType).toBe("retail");
    expect(result.debtAmountVnd).toBe(0);
    expect(result.reliabilityScore).toBe(100);
  });

  it("derives tier from customerType", () => {
    expect(mapCustomerRow({ id: "1", type: "wholesale" }).tier).toBe("vip");
    expect(mapCustomerRow({ id: "1", type: "agency" }).tier).toBe("vip");
    expect(mapCustomerRow({ id: "1", type: "retail" }).tier).toBe("regular");
  });
});

/* ─── mapProviderRow ──────────────────────────────────────── */
describe("mapProviderRow", () => {
  it("maps provider fields correctly", () => {
    const row = {
      id: "p1",
      name: "Provider A",
      reliability_score: 95,
      created_at: "2026-01-01T00:00:00Z",
    };
    const result = mapProviderRow(row);
    expect(result.id).toBe("p1");
    expect(result.name).toBe("Provider A");
    expect(result.reliabilityScore).toBe(95);
  });

  it("defaults tier to regular", () => {
    const result = mapProviderRow({ id: "1", name: "Test" });
    expect(result.tier).toBe("regular");
  });

  it("maps contacts array", () => {
    const row = {
      id: "1",
      name: "Test",
      contacts: [{ id: "c1", type: "phone", value: "123", isPrimary: true }],
    };
    const result = mapProviderRow(row);
    expect(result.contacts.length).toBe(1);
  });

  it("maps notes from legacy json payloads", () => {
    const row = {
      id: "1",
      name: "Test",
      notes: { text: "Ghi chú NCC" },
    };
    const result = mapProviderRow(row);
    expect(result.notes).toBe("Ghi chú NCC");
  });
});

/* ─── mapProductRow ───────────────────────────────────────── */
describe("mapProductRow", () => {
  it("maps product fields correctly", () => {
    const row = {
      id: "prod1",
      name: "Service A",
      mode: "slot",
      buy_price_vnd: 50000,
      sell_price_vnd: 80000,
      duration_type: "months",
      duration_value: 3,
      is_active: true,
    };
    const result = mapProductRow(row);
    expect(result.id).toBe("prod1");
    expect(result.buyPriceVnd).toBe(50000);
    expect(result.sellPriceVnd).toBe(80000);
    expect(result.durationType).toBe("months");
    expect(result.durationValue).toBe(3);
    expect(result.isActive).toBe(true);
  });

  it("handles missing fields with defaults", () => {
    const result = mapProductRow({});
    expect(result.id).toBe("");
    expect(result.name).toBe("");
    expect(result.mode).toBe("slot");
    expect(result.buyPriceVnd).toBe(0);
    expect(result.isActive).toBe(true);
  });
});

/* ─── mapCalendarEventRow ─────────────────────────────────── */
describe("mapCalendarEventRow", () => {
  it("maps calendar event basic fields", () => {
    const row = {
      id: "e1",
      title: "Nhắc hạn",
      due_at: "2026-03-15T14:30:00Z",
      type: "expiry",
      is_done: false,
    };
    const result = mapCalendarEventRow(row);
    expect(result.id).toBe("e1");
    expect(result.title).toBe("Nhắc hạn");
    expect(result.date).toBe("2026-03-15");
    expect(result.time).toBe("14:30");
    expect(result.type).toBe("expiry");
    expect(result.isDone).toBe(false);
  });

  it("hides time 00:00", () => {
    const row = { id: "1", title: "T", due_at: "2026-03-15T00:00:00Z" };
    const result = mapCalendarEventRow(row);
    expect(result.time).toBeUndefined();
  });

  it("extracts customer_ids", () => {
    const row = {
      id: "1",
      title: "T",
      due_at: "2026-03-15",
      customer_ids: ["c1", "c2"],
    };
    const result = mapCalendarEventRow(row);
    expect(result.customerIds).toEqual(["c1", "c2"]);
  });

  it("maps enriched _customers", () => {
    const row = {
      id: "1",
      title: "T",
      due_at: "2026-03-15",
      _customers: [
        {
          id: "c1",
          full_name: "Customer A",
          type: "retail",
          customer_contacts: [{ value: "0901234567", is_primary: true, channel: "phone" }],
        },
      ],
    };
    const result = mapCalendarEventRow(row);
    expect(result.customers.length).toBe(1);
    expect(result.customers[0].name).toBe("Customer A");
    expect(result.customers[0].contact).toBe("0901234567");
  });
});
