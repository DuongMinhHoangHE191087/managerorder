/**
 * Zod Schemas — Validation Unit Tests
 * Tests all major schemas for valid/invalid inputs and edge cases
 */

import { describe, it, expect } from "vitest";
import {
  createOrderInputSchema,
  createProductInputSchema,
  createCustomerInputSchema,
  updateCustomerInputSchema,
  createLicenseKeyInputSchema,
  createCalendarEventSchema,
  addInventoryItemSchema,
  updateSystemSettingSchema,
  allocationRequestSchema,
} from "../schemas";

// ── createOrderInputSchema ───────────────────────────────────
describe("createOrderInputSchema", () => {
  const validOrder = {
    customerId: "cust-001",
    items: [{ productId: "prod-001", quantity: 1 }],
  };

  it("accepts minimal valid input", () => {
    const result = createOrderInputSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("accepts full input with all optional fields", () => {
    const result = createOrderInputSchema.safeParse({
      ...validOrder,
      paymentTerms: "credit",
      salesNote: "Test note",
      proofImageUrls: ["https://example.com/proof.jpg"],
      billingDetails: { companyName: "ACME", taxId: "123456789" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty customerId", () => {
    const result = createOrderInputSchema.safeParse({ ...validOrder, customerId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty items array", () => {
    const result = createOrderInputSchema.safeParse({ ...validOrder, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects item with quantity 0", () => {
    const result = createOrderInputSchema.safeParse({
      ...validOrder,
      items: [{ productId: "prod-001", quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid paymentMethod", () => {
    const result = createOrderInputSchema.safeParse({ ...validOrder, paymentMethod: "crypto" });
    expect(result.success).toBe(false);
  });

  it("rejects proofImageUrls with more than 5 items", () => {
    const result = createOrderInputSchema.safeParse({
      ...validOrder,
      proofImageUrls: ["a", "b", "c", "d", "e", "f"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid paymentTerms options", () => {
    for (const paymentTerms of ["prepaid", "credit", "cod"]) {
      expect(createOrderInputSchema.safeParse({ ...validOrder, paymentTerms }).success).toBe(true);
    }
  });

  it("accepts legacy paymentMethod options for backward compatibility", () => {
    for (const pm of ["paid", "debt", "cod"]) {
      expect(createOrderInputSchema.safeParse({ ...validOrder, paymentMethod: pm }).success).toBe(true);
    }
  });
});

// ── createProductInputSchema ─────────────────────────────────
describe("createProductInputSchema", () => {
  it("accepts valid product", () => {
    const result = createProductInputSchema.safeParse({
      name: "Netflix Premium",
      sellPriceVnd: 150_000,
      durationValue: 30,
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for mode, buyPriceVnd, durationType, isActive", () => {
    const result = createProductInputSchema.parse({
      name: "Test",
      sellPriceVnd: 100_000,
      durationValue: 7,
    });
    expect(result.mode).toBe("slot");
    expect(result.buyPriceVnd).toBe(0);
    expect(result.durationType).toBe("days");
    expect(result.isActive).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createProductInputSchema.safeParse({ name: "", sellPriceVnd: 100, durationValue: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects negative sellPriceVnd", () => {
    const result = createProductInputSchema.safeParse({ name: "Test", sellPriceVnd: -1, durationValue: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects durationValue 0", () => {
    const result = createProductInputSchema.safeParse({ name: "Test", sellPriceVnd: 100, durationValue: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts all valid modes", () => {
    for (const mode of ["slot", "key", "hybrid"]) {
      expect(createProductInputSchema.safeParse({
        name: "Test", sellPriceVnd: 100, durationValue: 1, mode,
      }).success).toBe(true);
    }
  });
});

// ── createCustomerInputSchema ────────────────────────────────
describe("createCustomerInputSchema", () => {
  const validCustomer = {
    name: "Nguyen Van A",
    contacts: [{ type: "phone", value: "0912345678" }],
  };

  it("accepts valid customer", () => {
    expect(createCustomerInputSchema.safeParse(validCustomer).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createCustomerInputSchema.safeParse({ ...validCustomer, name: "" }).success).toBe(false);
  });

  it("rejects empty contacts array", () => {
    expect(createCustomerInputSchema.safeParse({ ...validCustomer, contacts: [] }).success).toBe(false);
  });

  it("rejects contact with empty value", () => {
    expect(createCustomerInputSchema.safeParse({
      ...validCustomer,
      contacts: [{ type: "phone", value: "" }],
    }).success).toBe(false);
  });

  it("rejects invalid contact type", () => {
    expect(createCustomerInputSchema.safeParse({
      ...validCustomer,
      contacts: [{ type: "pigeon", value: "coo" }],
    }).success).toBe(false);
  });

  it("accepts all valid contact types", () => {
    for (const type of ["phone", "email", "zalo", "facebook", "telegram", "other"]) {
      expect(createCustomerInputSchema.safeParse({
        name: "Test",
        contacts: [{ type, value: "test" }],
      }).success).toBe(true);
    }
  });
});

// ── updateCustomerInputSchema ────────────────────────────────
describe("updateCustomerInputSchema", () => {
  it("accepts partial update", () => {
    expect(updateCustomerInputSchema.safeParse({ name: "New Name" }).success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    expect(updateCustomerInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects reliabilityScore > 100", () => {
    expect(updateCustomerInputSchema.safeParse({ reliabilityScore: 101 }).success).toBe(false);
  });

  it("rejects reliabilityScore < 0", () => {
    expect(updateCustomerInputSchema.safeParse({ reliabilityScore: -1 }).success).toBe(false);
  });

  it("accepts valid customerType", () => {
    for (const ct of ["retail", "wholesale", "agency"]) {
      expect(updateCustomerInputSchema.safeParse({ customerType: ct }).success).toBe(true);
    }
  });
});

// ── createLicenseKeyInputSchema ──────────────────────────────
describe("createLicenseKeyInputSchema", () => {
  it("accepts valid key", () => {
    expect(createLicenseKeyInputSchema.safeParse({
      keyCode: "KEY-ABC-123",
      productId: "prod-001",
    }).success).toBe(true);
  });

  it("defaults status to available", () => {
    const result = createLicenseKeyInputSchema.parse({ keyCode: "KEY", productId: "P" });
    expect(result.status).toBe("available");
  });

  it("rejects empty keyCode", () => {
    expect(createLicenseKeyInputSchema.safeParse({ keyCode: "", productId: "P" }).success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    for (const status of ["available", "reserved", "used", "expired", "invalid"]) {
      expect(createLicenseKeyInputSchema.safeParse({
        keyCode: "K", productId: "P", status,
      }).success).toBe(true);
    }
  });
});

// ── createCalendarEventSchema ────────────────────────────────
describe("createCalendarEventSchema", () => {
  it("accepts valid event", () => {
    expect(createCalendarEventSchema.safeParse({ title: "Follow up", date: "2026-03-15" }).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(createCalendarEventSchema.safeParse({ title: "", date: "2026-03-15" }).success).toBe(false);
  });

  it("rejects empty date", () => {
    expect(createCalendarEventSchema.safeParse({ title: "Test", date: "" }).success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const result = createCalendarEventSchema.parse({ title: "Test", date: "2026-06-01" });
    expect(result.type).toBe("follow_up");
    expect(result.is_done).toBe(false);
    expect(result.customerIds).toEqual([]);
    expect(result.hasReminder).toBe(false);
  });
});

// ── addInventoryItemSchema ───────────────────────────────────
describe("addInventoryItemSchema", () => {
  it("accepts valid inventory item", () => {
    expect(addInventoryItemSchema.safeParse({
      productId: "prod-001",
      email: "acc@netflix.com",
      maxSlots: 6,
      expiresAt: "2026-12-01",
    }).success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(addInventoryItemSchema.safeParse({
      productId: "P", email: "not-email", maxSlots: 1, expiresAt: "2026-12-01",
    }).success).toBe(false);
  });

  it("rejects maxSlots > 20", () => {
    expect(addInventoryItemSchema.safeParse({
      productId: "P", email: "a@b.c", maxSlots: 21, expiresAt: "2026-12-01",
    }).success).toBe(false);
  });

  it("rejects maxSlots 0", () => {
    expect(addInventoryItemSchema.safeParse({
      productId: "P", email: "a@b.c", maxSlots: 0, expiresAt: "2026-12-01",
    }).success).toBe(false);
  });
});

// ── allocationRequestSchema ──────────────────────────────────
describe("allocationRequestSchema", () => {
  it("accepts valid allocation request", () => {
    expect(allocationRequestSchema.safeParse({ orderId: "ord-001" }).success).toBe(true);
  });

  it("defaults confirm to false", () => {
    const result = allocationRequestSchema.parse({ orderId: "ord-001" });
    expect(result.confirm).toBe(false);
  });

  it("rejects empty orderId", () => {
    expect(allocationRequestSchema.safeParse({ orderId: "" }).success).toBe(false);
  });
});

// ── updateSystemSettingSchema ────────────────────────────────
describe("updateSystemSettingSchema", () => {
  it("accepts valid setting with string value", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "company_name", value: "ACME Inc" }).success).toBe(true);
  });

  it("accepts numeric value", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "tax_rate", value: 10 }).success).toBe(true);
  });

  it("accepts boolean value", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "enable_notifications", value: true }).success).toBe(true);
  });

  it("rejects key with uppercase letters", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "Company_Name", value: "x" }).success).toBe(false);
  });

  it("rejects key with spaces", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "company name", value: "x" }).success).toBe(false);
  });
});
