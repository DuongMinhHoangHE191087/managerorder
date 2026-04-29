/**
 * Product & Customer Schema Validation — Comprehensive Tests
 * Tests: createProductInputSchema, createCustomerInputSchema,
 *        updateCustomerInputSchema, contactInfoSchema
 */
import { describe, it, expect } from "vitest";
import {
  createProductInputSchema,
  createCustomerInputSchema,
  updateCustomerInputSchema,
  contactInfoSchema,
} from "@/lib/domain/schemas";

/* ============================================================
   createProductInputSchema
   ============================================================ */
describe("createProductInputSchema", () => {
  const validProduct = {
    name: "Netflix Premium",
    mode: "slot",
    buyPriceVnd: 50000,
    sellPriceVnd: 150000,
    durationType: "months",
    durationValue: 1,
    isActive: true,
  };

  it("should accept valid product data", () => {
    const result = createProductInputSchema.parse(validProduct);
    expect(result.name).toBe("Netflix Premium");
    expect(result.mode).toBe("slot");
    expect(result.sellPriceVnd).toBe(150000);
  });

  // --- Defaults ---
  it("should default mode to 'slot'", () => {
    const { mode: _, ...noMode } = validProduct;
    const result = createProductInputSchema.parse(noMode);
    expect(result.mode).toBe("slot");
  });

  it("should default buyPriceVnd to 0", () => {
    const { buyPriceVnd: _, ...noBuy } = validProduct;
    const result = createProductInputSchema.parse(noBuy);
    expect(result.buyPriceVnd).toBe(0);
  });

  it("should default isActive to true", () => {
    const { isActive: _, ...noActive } = validProduct;
    const result = createProductInputSchema.parse(noActive);
    expect(result.isActive).toBe(true);
  });

  it("should default durationType to 'days'", () => {
    const { durationType: _, ...noDT } = validProduct;
    const result = createProductInputSchema.parse(noDT);
    expect(result.durationType).toBe("days");
  });

  // --- Mode enum ---
  it.each(["slot", "key", "hybrid"])("should accept mode=%s", (mode) => {
    const result = createProductInputSchema.parse({ ...validProduct, mode });
    expect(result.mode).toBe(mode);
  });

  it("should reject invalid mode", () => {
    expect(() =>
      createProductInputSchema.parse({ ...validProduct, mode: "invalid" })
    ).toThrow();
  });

  // --- Duration type enum ---
  it.each(["days", "months", "years"])("should accept durationType=%s", (dt) => {
    const result = createProductInputSchema.parse({ ...validProduct, durationType: dt });
    expect(result.durationType).toBe(dt);
  });

  it("should reject invalid durationType", () => {
    expect(() =>
      createProductInputSchema.parse({ ...validProduct, durationType: "weeks" })
    ).toThrow();
  });

  // --- Required fields ---
  it("should reject empty name", () => {
    expect(() =>
      createProductInputSchema.parse({ ...validProduct, name: "" })
    ).toThrow("Vui lòng nhập tên sản phẩm");
  });

  it("should reject missing name", () => {
    const { name: _, ...noName } = validProduct;
    expect(() => createProductInputSchema.parse(noName)).toThrow();
  });

  it("should require durationValue ≥ 1", () => {
    expect(() =>
      createProductInputSchema.parse({ ...validProduct, durationValue: 0 })
    ).toThrow();
  });

  it("should require durationValue to be integer", () => {
    expect(() =>
      createProductInputSchema.parse({ ...validProduct, durationValue: 1.5 })
    ).toThrow();
  });

  // --- Price validation ---
  it("should reject negative sellPriceVnd", () => {
    expect(() =>
      createProductInputSchema.parse({ ...validProduct, sellPriceVnd: -1 })
    ).toThrow();
  });

  it("should reject negative buyPriceVnd", () => {
    expect(() =>
      createProductInputSchema.parse({ ...validProduct, buyPriceVnd: -1 })
    ).toThrow();
  });

  it("should accept zero prices", () => {
    const result = createProductInputSchema.parse({
      ...validProduct,
      buyPriceVnd: 0,
      sellPriceVnd: 0,
    });
    expect(result.buyPriceVnd).toBe(0);
    expect(result.sellPriceVnd).toBe(0);
  });

  // --- Partial for update ---
  it("should support .partial() for product update", () => {
    const result = createProductInputSchema.partial().parse({ name: "Updated" });
    expect(result.name).toBe("Updated");
    // .partial() makes fields optional, but .default() still applies
    expect(result.mode).toBe("slot");
  });

  it("should accept empty object in partial mode", () => {
    const result = createProductInputSchema.partial().parse({});
    // Zod applies defaults even in partial mode
    expect(result.mode).toBe("slot");
    expect(result.buyPriceVnd).toBe(0);
    expect(result.isActive).toBe(true);
    expect(result.durationType).toBe("days");
    expect(result.name).toBeUndefined();
    expect(result.sellPriceVnd).toBeUndefined();
    expect(result.durationValue).toBeUndefined();
  });
});

/* ============================================================
   contactInfoSchema
   ============================================================ */
describe("contactInfoSchema", () => {
  it("should accept valid contact", () => {
    const result = contactInfoSchema.parse({
      type: "phone",
      value: "0901234567",
      isPrimary: true,
    });
    expect(result.type).toBe("phone");
    expect(result.value).toBe("0901234567");
    expect(result.isPrimary).toBe(true);
  });

  it.each(["phone", "email", "zalo", "facebook", "telegram", "other"])(
    "should accept type=%s",
    (type) => {
      const result = contactInfoSchema.parse({ type, value: "test" });
      expect(result.type).toBe(type);
    }
  );

  it("should reject invalid type", () => {
    expect(() =>
      contactInfoSchema.parse({ type: "whatsapp", value: "123" })
    ).toThrow();
  });

  it("should reject empty value", () => {
    expect(() =>
      contactInfoSchema.parse({ type: "phone", value: "" })
    ).toThrow();
  });

  it("should make isPrimary optional", () => {
    const result = contactInfoSchema.parse({ type: "email", value: "a@b.com" });
    expect(result.isPrimary).toBeUndefined();
  });

  it("should make id optional", () => {
    const result = contactInfoSchema.parse({
      id: "00000000-0000-4000-8000-0000000003e8",
      type: "zalo",
      value: "0909",
    });
    expect(result.id).toBe("00000000-0000-4000-8000-0000000003e8");
  });
});

/* ============================================================
   createCustomerInputSchema
   ============================================================ */
describe("createCustomerInputSchema", () => {
  const validCustomer = {
    name: "Nguyễn Văn A",
    contacts: [{ type: "phone", value: "090123" }],
    tier: "regular",
  };

  it("should accept valid customer data", () => {
    const result = createCustomerInputSchema.parse(validCustomer);
    expect(result.name).toBe("Nguyễn Văn A");
    expect(result.contacts).toHaveLength(1);
    expect(result.tier).toBe("regular");
  });

  it("should default tier to 'regular'", () => {
    const { tier: _, ...noTier } = validCustomer;
    const result = createCustomerInputSchema.parse(noTier);
    expect(result.tier).toBe("regular");
  });

  it("should accept tier='vip'", () => {
    const result = createCustomerInputSchema.parse({
      ...validCustomer,
      tier: "vip",
    });
    expect(result.tier).toBe("vip");
  });

  it("should reject invalid tier", () => {
    expect(() =>
      createCustomerInputSchema.parse({ ...validCustomer, tier: "gold" })
    ).toThrow();
  });

  it("should reject empty name", () => {
    expect(() =>
      createCustomerInputSchema.parse({ ...validCustomer, name: "" })
    ).toThrow();
  });

  it("should reject empty contacts array", () => {
    expect(() =>
      createCustomerInputSchema.parse({ ...validCustomer, contacts: [] })
    ).toThrow();
  });

  it("should accept multiple contacts", () => {
    const result = createCustomerInputSchema.parse({
      ...validCustomer,
      contacts: [
        { type: "phone", value: "090123" },
        { type: "email", value: "a@b.com" },
        { type: "zalo", value: "090456" },
      ],
    });
    expect(result.contacts).toHaveLength(3);
  });

  it("should accept tagIds as UUID array", () => {
    const result = createCustomerInputSchema.parse({
      ...validCustomer,
      tagIds: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
    });
    expect(result.tagIds).toHaveLength(1);
  });

  it("should reject non-UUID tagIds", () => {
    expect(() =>
      createCustomerInputSchema.parse({
        ...validCustomer,
        tagIds: ["not-a-uuid"],
      })
    ).toThrow();
  });

  it("should make tagIds optional", () => {
    const result = createCustomerInputSchema.parse(validCustomer);
    expect(result.tagIds).toBeUndefined();
  });
});

/* ============================================================
   updateCustomerInputSchema
   ============================================================ */
describe("updateCustomerInputSchema", () => {
  it("should accept empty object", () => {
    const result = updateCustomerInputSchema.parse({});
    expect(result).toEqual({});
  });

  it("should accept partial name update", () => {
    const result = updateCustomerInputSchema.parse({ name: "Updated Name" });
    expect(result.name).toBe("Updated Name");
  });

  it("should accept customerType directly", () => {
    const result = updateCustomerInputSchema.parse({ customerType: "wholesale" });
    expect(result.customerType).toBe("wholesale");
  });

  it.each(["retail", "wholesale", "agency"])(
    "should accept customerType=%s",
    (ct) => {
      const result = updateCustomerInputSchema.parse({ customerType: ct });
      expect(result.customerType).toBe(ct);
    }
  );

  it("should accept reliabilityScore 0-100", () => {
    expect(updateCustomerInputSchema.parse({ reliabilityScore: 0 }).reliabilityScore).toBe(0);
    expect(updateCustomerInputSchema.parse({ reliabilityScore: 100 }).reliabilityScore).toBe(100);
    expect(updateCustomerInputSchema.parse({ reliabilityScore: 55 }).reliabilityScore).toBe(55);
  });

  it("should reject reliabilityScore > 100", () => {
    expect(() =>
      updateCustomerInputSchema.parse({ reliabilityScore: 101 })
    ).toThrow();
  });

  it("should reject reliabilityScore < 0", () => {
    expect(() =>
      updateCustomerInputSchema.parse({ reliabilityScore: -1 })
    ).toThrow();
  });

  it("should accept notes up to 1000 chars", () => {
    const result = updateCustomerInputSchema.parse({
      notes: "A".repeat(1000),
    });
    expect(result.notes).toHaveLength(1000);
  });

  it("should reject notes > 1000 chars", () => {
    expect(() =>
      updateCustomerInputSchema.parse({ notes: "A".repeat(1001) })
    ).toThrow();
  });

  it("should accept tagIds", () => {
    const result = updateCustomerInputSchema.parse({
      tagIds: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
    });
    expect(result.tagIds).toHaveLength(1);
  });

  it("should accept optional contacts", () => {
    const result = updateCustomerInputSchema.parse({
      contacts: [{ type: "phone", value: "090123" }],
    });
    expect(result.contacts).toHaveLength(1);
  });
});
