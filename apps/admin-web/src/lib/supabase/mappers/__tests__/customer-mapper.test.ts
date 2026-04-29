import { describe, it, expect } from "vitest";
import {
  mapChannel,
  mapDbTypeToTier,
  mapTierToDbType,
  mapToCustomer,
} from "../customer-mapper";

// ============================================
// mapChannel
// ============================================

describe("mapChannel", () => {
  it.each([
    ["phone", "phone"],
    ["email", "email"],
    ["zalo", "zalo"],
    ["facebook", "facebook"],
    ["telegram", "telegram"],
  ] as const)('maps "%s" → "%s"', (input, expected) => {
    expect(mapChannel(input)).toBe(expected);
  });

  it('returns "other" for unknown channels', () => {
    expect(mapChannel("instagram")).toBe("other");
    expect(mapChannel("")).toBe("other");
    expect(mapChannel("whatsapp")).toBe("other");
  });
});

// ============================================
// mapDbTypeToTier
// ============================================

describe("mapDbTypeToTier", () => {
  it('maps "agency" → "vip"', () => {
    expect(mapDbTypeToTier("agency")).toBe("vip");
  });

  it('maps "wholesale" → "vip"', () => {
    expect(mapDbTypeToTier("wholesale")).toBe("vip");
  });

  it('maps "retail" → "regular"', () => {
    expect(mapDbTypeToTier("retail")).toBe("regular");
  });

  it('maps unknown → "regular"', () => {
    expect(mapDbTypeToTier("something")).toBe("regular");
  });
});

// ============================================
// mapTierToDbType
// ============================================

describe("mapTierToDbType", () => {
  it.each([
    ["vip", "wholesale"],
    ["agency", "agency"],
    ["regular", "retail"],
  ] as const)('maps tier "%s" → dbType "%s"', (tier, expected) => {
    expect(mapTierToDbType(tier)).toBe(expected);
  });

  it('defaults to "retail" for unknown tiers', () => {
    expect(mapTierToDbType("unknown")).toBe("retail");
    expect(mapTierToDbType("")).toBe("retail");
  });
});

// ============================================
// mapToCustomer
// ============================================

describe("mapToCustomer", () => {
  const fullRow = {
    id: "00000000-0000-4000-8000-000000000005",
    full_name: "Nguyễn Văn A",
    type: "wholesale",
    contacts: [
      { id: "c1", channel: "phone", value: "0123456789", is_primary: true },
      { channel: "zalo", value: "zalo123" },
    ],
    customer_tags: [
      { id: "t1", name: "VIP", color: "#ff0000" },
    ],
    nicks_registry: [{ nick: "test_nick", product_id: "p1" }],
    debt_amount_vnd: 500000,
    debt_overdue_days: 3,
    reliability_score: 85,
    notes: "Important customer",
    created_at: "2024-01-15T00:00:00Z",
    segment: "vip",
    rfm_score: 90,
    rfm_recency: 8,
    rfm_frequency: 7,
    rfm_monetary: 9,
    last_rfm_calculated_at: "2024-03-01T00:00:00Z",
  };

  it("maps full row to Customer domain object", () => {
    const customer = mapToCustomer(fullRow);
    expect(customer.id).toBe("00000000-0000-4000-8000-000000000005");
    expect(customer.name).toBe("Nguyễn Văn A");
    expect(customer.tier).toBe("vip"); // wholesale → vip
    expect(customer.customerType).toBe("wholesale");
    expect(customer.contacts).toHaveLength(2);
    expect(customer.contacts[0].type).toBe("phone");
    expect(customer.contacts[0].isPrimary).toBe(true);
    expect(customer.tags).toHaveLength(1);
    expect(customer.tags![0].name).toBe("VIP");
    expect(customer.debtAmountVnd).toBe(500000);
    expect(customer.reliabilityScore).toBe(85);
    expect(customer.notes).toBe("Important customer");
    expect(customer.segment).toBe("vip");
    expect(customer.rfmScore).toBe(90);
  });

  it("handles missing optional fields with defaults", () => {
    const minimalRow = { id: "00000000-0000-4000-8000-000000000006" };
    const customer = mapToCustomer(minimalRow);
    expect(customer.id).toBe("00000000-0000-4000-8000-000000000006");
    expect(customer.name).toBe("");
    expect(customer.contacts).toEqual([]);
    expect(customer.tags).toEqual([]);
    expect(customer.tier).toBe("regular");
    expect(customer.customerType).toBe("retail");
    expect(customer.debtAmountVnd).toBe(0);
    expect(customer.reliabilityScore).toBe(100);
    expect(customer.notes).toBeUndefined();
    expect(customer.segment).toBe("regular");
    expect(customer.rfmScore).toBe(0);
  });

  it("uses name fallback when full_name is missing", () => {
    const row = { id: "x", name: "Fallback Name" };
    const customer = mapToCustomer(row);
    expect(customer.name).toBe("Fallback Name");
  });

  it("maps contact without explicit id — generates cc_N id", () => {
    const row = {
      id: "x",
      contacts: [{ value: "0912345678" }],
    };
    const customer = mapToCustomer(row);
    expect(customer.contacts[0].id).toBe("cc_0");
  });

  it("defaults first contact isPrimary to true if not specified", () => {
    const row = {
      id: "x",
      contacts: [{ value: "test", channel: "email" }],
    };
    const customer = mapToCustomer(row);
    expect(customer.contacts[0].isPrimary).toBe(true);
  });

  it("maps invalid type to retail", () => {
    const row = { id: "x", type: "invalid_type" };
    const customer = mapToCustomer(row);
    expect(customer.customerType).toBe("retail");
  });

  it("maps invalid segment to regular", () => {
    const row = { id: "x", segment: "nonexistent_segment" };
    const customer = mapToCustomer(row);
    expect(customer.segment).toBe("regular");
  });

  it("handles all valid segments", () => {
    const segments = ["vip", "loyal", "regular", "at_risk", "churned", "new"];
    segments.forEach((seg) => {
      const row = { id: "x", segment: seg };
      expect(mapToCustomer(row).segment).toBe(seg);
    });
  });

  it("handles null contacts array", () => {
    const row = { id: "x", contacts: null };
    const customer = mapToCustomer(row);
    expect(customer.contacts).toEqual([]);
  });

  it("handles null nicks_registry", () => {
    const row = { id: "x", nicks_registry: null };
    const customer = mapToCustomer(row);
    expect(customer.nicksRegistry).toEqual([]);
  });

  it("handles negative debt value (should take as-is)", () => {
    const row = { id: "x", debt_amount_vnd: -100 };
    const customer = mapToCustomer(row);
    expect(customer.debtAmountVnd).toBe(-100);
  });

  it("handles null rfm values → defaults to 0", () => {
    const row = { id: "x", rfm_score: null, rfm_recency: null, rfm_frequency: null, rfm_monetary: null };
    const customer = mapToCustomer(row);
    expect(customer.rfmScore).toBe(0);
    expect(customer.rfmRecency).toBe(0);
    expect(customer.rfmFrequency).toBe(0);
    expect(customer.rfmMonetary).toBe(0);
  });

  it("second contact isPrimary defaults to false", () => {
    const row = {
      id: "x",
      contacts: [
        { id: "c1", value: "a", channel: "phone" },
        { id: "c2", value: "b", channel: "zalo" },
      ],
    };
    const customer = mapToCustomer(row);
    expect(customer.contacts[0].isPrimary).toBe(true);
    expect(customer.contacts[1].isPrimary).toBe(false);
  });
});
