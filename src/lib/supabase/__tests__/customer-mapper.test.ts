/**
 * Customer Mapper — Comprehensive Unit Tests
 * Tests: mapToCustomer, mapChannel, mapDbTypeToTier, mapTierToDbType
 */
import { describe, it, expect } from "vitest";
import {
  mapToCustomer,
  mapChannel,
  mapDbTypeToTier,
  mapTierToDbType,
} from "@/lib/supabase/mappers/customer-mapper";

/* ============================================================
   mapChannel
   ============================================================ */
describe("mapChannel", () => {
  it.each([
    ["phone", "phone"],
    ["email", "email"],
    ["zalo", "zalo"],
    ["facebook", "facebook"],
    ["telegram", "telegram"],
  ])("should map '%s' → '%s'", (input, expected) => {
    expect(mapChannel(input)).toBe(expected);
  });

  it("should default unknown channel to 'other'", () => {
    expect(mapChannel("whatsapp")).toBe("other");
    expect(mapChannel("")).toBe("other");
    expect(mapChannel("abc")).toBe("other");
  });
});

/* ============================================================
   mapDbTypeToTier
   ============================================================ */
describe("mapDbTypeToTier", () => {
  it("should map 'agency' → 'vip'", () => {
    expect(mapDbTypeToTier("agency")).toBe("vip");
  });

  it("should map 'wholesale' → 'vip'", () => {
    expect(mapDbTypeToTier("wholesale")).toBe("vip");
  });

  it("should map 'retail' → 'regular'", () => {
    expect(mapDbTypeToTier("retail")).toBe("regular");
  });

  it("should map unknown → 'regular'", () => {
    expect(mapDbTypeToTier("unknown")).toBe("regular");
    expect(mapDbTypeToTier("")).toBe("regular");
  });
});

/* ============================================================
   mapTierToDbType
   ============================================================ */
describe("mapTierToDbType", () => {
  it("should map 'vip' → 'wholesale'", () => {
    expect(mapTierToDbType("vip")).toBe("wholesale");
  });

  it("should map 'agency' → 'agency'", () => {
    expect(mapTierToDbType("agency")).toBe("agency");
  });

  it("should map 'regular' → 'retail'", () => {
    expect(mapTierToDbType("regular")).toBe("retail");
  });

  it("should default unknown → 'retail'", () => {
    expect(mapTierToDbType("gold")).toBe("retail");
    expect(mapTierToDbType("")).toBe("retail");
  });
});

/* ============================================================
   mapToCustomer — Full domain mapping
   ============================================================ */
describe("mapToCustomer", () => {
  const fullRow = {
    id: "cust-1",
    full_name: "Nguyễn Văn A",
    type: "wholesale",
    contacts: [
      { id: "c1", channel: "phone", value: "090123", is_primary: true },
      { id: "c2", channel: "email", value: "a@b.com", is_primary: false },
    ],
    customer_tags: [
      { id: "tag-1", name: "VIP", color: "#ff0000" },
    ],
    nicks_registry: [{ platform: "shopee", nick: "shopA" }],
    debt_amount_vnd: 500000,
    debt_overdue_days: 15,
    reliability_score: 85,
    notes: "Khách ruột",
    segment: "loyal",
    rfm_score: 8,
    rfm_recency: 3,
    rfm_frequency: 3,
    rfm_monetary: 2,
    last_rfm_calculated_at: "2025-01-15T10:00:00Z",
    created_at: "2024-06-01T00:00:00Z",
  };

  it("should map all basic fields", () => {
    const result = mapToCustomer(fullRow);
    expect(result.id).toBe("cust-1");
    expect(result.name).toBe("Nguyễn Văn A");
    expect(result.tier).toBe("vip"); // wholesale → vip
    expect(result.customerType).toBe("wholesale");
  });

  it("should map contacts with channel → type", () => {
    const result = mapToCustomer(fullRow);
    expect(result.contacts).toHaveLength(2);
    expect(result.contacts[0]).toEqual({
      id: "c1",
      type: "phone",
      value: "090123",
      isPrimary: true,
    });
    expect(result.contacts[1]).toEqual({
      id: "c2",
      type: "email",
      value: "a@b.com",
      isPrimary: false,
    });
  });

  it("should map tags", () => {
    const result = mapToCustomer(fullRow);
    expect(result.tags).toEqual([
      { id: "tag-1", name: "VIP", color: "#ff0000" },
    ]);
  });

  it("should map debt fields", () => {
    const result = mapToCustomer(fullRow);
    expect(result.debtAmountVnd).toBe(500000);
    expect(result.debtOverdueDays).toBe(15);
    expect(result.reliabilityScore).toBe(85);
  });

  it("should map RFM fields", () => {
    const result = mapToCustomer(fullRow);
    expect(result.segment).toBe("loyal");
    expect(result.rfmScore).toBe(8);
    expect(result.rfmRecency).toBe(3);
    expect(result.rfmFrequency).toBe(3);
    expect(result.rfmMonetary).toBe(2);
    expect(result.lastRfmCalculatedAt).toBe("2025-01-15T10:00:00Z");
  });

  it("should map nicksRegistry", () => {
    const result = mapToCustomer(fullRow);
    expect(result.nicksRegistry).toHaveLength(1);
  });

  it("should map notes", () => {
    const result = mapToCustomer(fullRow);
    expect(result.notes).toBe("Khách ruột");
  });

  /* ─── Defaults & Defensive ─────────────────────── */
  it("should handle empty row with defaults", () => {
    const result = mapToCustomer({});
    expect(result.id).toBe("");
    expect(result.name).toBe("");
    expect(result.tier).toBe("regular");
    expect(result.customerType).toBe("retail");
    expect(result.contacts).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.debtAmountVnd).toBe(0);
    expect(result.reliabilityScore).toBe(100); // default
    expect(result.segment).toBe("regular");
    expect(result.rfmScore).toBe(0);
    expect(result.nicksRegistry).toEqual([]);
    expect(result.notes).toBeUndefined();
    expect(result.lastRfmCalculatedAt).toBeUndefined();
  });

  it("should fallback to 'name' if 'full_name' is missing", () => {
    const result = mapToCustomer({ name: "Fallback Name" });
    expect(result.name).toBe("Fallback Name");
  });

  it("should assign isPrimary=true to first contact if nothing set", () => {
    const result = mapToCustomer({
      contacts: [
        { id: "c1", channel: "phone", value: "090" },
      ],
    });
    expect(result.contacts[0].isPrimary).toBe(true);  // i === 0
  });

  it("should use fallback contact id (cc_N) when id is missing", () => {
    const result = mapToCustomer({
      contacts: [
        { channel: "zalo", value: "test" },
      ],
    });
    expect(result.contacts[0].id).toBe("cc_0");
  });

  it("should coerce non-array contacts to empty", () => {
    const result = mapToCustomer({ contacts: "not-array" });
    expect(result.contacts).toEqual([]);
  });

  it("should coerce non-array customer_tags to empty", () => {
    const result = mapToCustomer({ customer_tags: "not-array" });
    expect(result.tags).toEqual([]);
  });

  it("should validate segment against allowed values", () => {
    const result = mapToCustomer({ segment: "invalid_segment" });
    expect(result.segment).toBe("regular"); // fallback
  });

  it.each(["vip", "loyal", "regular", "at_risk", "churned", "new"])(
    "should accept valid segment=%s",
    (seg) => {
      const result = mapToCustomer({ segment: seg });
      expect(result.segment).toBe(seg);
    }
  );

  it("should coerce invalid type to 'retail'", () => {
    const result = mapToCustomer({ type: "premium" });
    expect(result.customerType).toBe("retail");
    expect(result.tier).toBe("regular");
  });

  it.each(["retail", "wholesale", "agency"])(
    "should accept valid type=%s",
    (type) => {
      const result = mapToCustomer({ type });
      expect(result.customerType).toBe(type);
    }
  );
});
