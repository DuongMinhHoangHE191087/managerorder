import { describe, it, expect } from "vitest";
// import { ZodError } from "zod";

import {
  createOrderInputSchema,
  createCustomerInputSchema,
  createProductInputSchema,
  createPaymentSourceInputSchema,
  createSalesChannelInputSchema,
  createShortLinkInputSchema,
  createLicenseKeyInputSchema,
  createCalendarEventSchema,
  addInventoryItemSchema,
  updateSystemSettingSchema,
  batchUpdateSettingsSchema,
  contactInfoSchema,
  orderItemSchema,
  updateShortLinkInputSchema,
} from "../schemas";

// ============================================
// orderItemSchema
// ============================================

describe("orderItemSchema", () => {
  it("validates valid order item", () => {
    const result = orderItemSchema.safeParse({
      productId: "prod-1",
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing productId", () => {
    const result = orderItemSchema.safeParse({ quantity: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects quantity < 1", () => {
    const result = orderItemSchema.safeParse({ productId: "p1", quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer quantity", () => {
    const result = orderItemSchema.safeParse({ productId: "p1", quantity: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts optional notes within limit", () => {
    const result = orderItemSchema.safeParse({
      productId: "p1",
      quantity: 1,
      notes: "test note",
    });
    expect(result.success).toBe(true);
  });

  it("rejects notes exceeding 300 chars", () => {
    const result = orderItemSchema.safeParse({
      productId: "p1",
      quantity: 1,
      notes: "a".repeat(301),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// createOrderInputSchema
// ============================================

describe("createOrderInputSchema", () => {
  const validOrder = {
    customerId: "cust-1",
    items: [{ productId: "prod-1", quantity: 1 }],
  };

  it("validates minimal valid order", () => {
    expect(createOrderInputSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects missing customerId", () => {
    const result = createOrderInputSchema.safeParse({
      items: [{ productId: "p1", quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty items array", () => {
    const result = createOrderInputSchema.safeParse({
      customerId: "c1",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("validates with all optional fields", () => {
    const result = createOrderInputSchema.safeParse({
      ...validOrder,
      paymentMethod: "paid",
      salesNote: "Test note",
      proofImageUrls: ["url1", "url2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid paymentMethod", () => {
    const result = createOrderInputSchema.safeParse({
      ...validOrder,
      paymentMethod: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 proof images", () => {
    const result = createOrderInputSchema.safeParse({
      ...validOrder,
      proofImageUrls: ["1", "2", "3", "4", "5", "6"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects salesNote exceeding 500 chars", () => {
    const result = createOrderInputSchema.safeParse({
      ...validOrder,
      salesNote: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// createCustomerInputSchema
// ============================================

describe("createCustomerInputSchema", () => {
  const validCustomer = {
    name: "Nguyễn Văn A",
    contacts: [{ type: "phone", value: "0123456789" }],
  };

  it("validates minimal valid customer", () => {
    expect(createCustomerInputSchema.safeParse(validCustomer).success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createCustomerInputSchema.safeParse({
      ...validCustomer,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty contacts", () => {
    const result = createCustomerInputSchema.safeParse({
      name: "Test",
      contacts: [],
    });
    expect(result.success).toBe(false);
  });

  it("defaults tier to regular", () => {
    const result = createCustomerInputSchema.parse(validCustomer);
    expect(result.tier).toBe("regular");
  });

  it("accepts vip tier", () => {
    const result = createCustomerInputSchema.safeParse({
      ...validCustomer,
      tier: "vip",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid tier", () => {
    const result = createCustomerInputSchema.safeParse({
      ...validCustomer,
      tier: "platinum",
    });
    expect(result.success).toBe(false);
  });

  it("validates tagIds as UUIDs", () => {
    const result = createCustomerInputSchema.safeParse({
      ...validCustomer,
      tagIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID tagIds", () => {
    const result = createCustomerInputSchema.safeParse({
      ...validCustomer,
      tagIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// createProductInputSchema
// ============================================

describe("createProductInputSchema", () => {
  const validProduct = {
    name: "Netflix Premium",
    sellPriceVnd: 50000,
    durationValue: 30,
  };

  it("validates minimal valid product", () => {
    const result = createProductInputSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("applies defaults", () => {
    const result = createProductInputSchema.parse(validProduct);
    expect(result.mode).toBe("slot");
    expect(result.durationType).toBe("days");
    expect(result.isActive).toBe(true);
    expect(result.buyPriceVnd).toBe(0);
  });

  it("rejects empty name", () => {
    const result = createProductInputSchema.safeParse({
      ...validProduct,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sell price", () => {
    const result = createProductInputSchema.safeParse({
      ...validProduct,
      sellPriceVnd: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero durationValue", () => {
    const result = createProductInputSchema.safeParse({
      ...validProduct,
      durationValue: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid modes", () => {
    for (const mode of ["slot", "key", "hybrid"]) {
      const result = createProductInputSchema.safeParse({
        ...validProduct,
        mode,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid mode", () => {
    const result = createProductInputSchema.safeParse({
      ...validProduct,
      mode: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// contactInfoSchema
// ============================================

describe("contactInfoSchema", () => {
  it("validates all contact types", () => {
    const types = ["phone", "email", "zalo", "facebook", "telegram", "other"];
    types.forEach((type) => {
      const result = contactInfoSchema.safeParse({ type, value: "test" });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid type", () => {
    const result = contactInfoSchema.safeParse({ type: "whatsapp", value: "test" });
    expect(result.success).toBe(false);
  });

  it("rejects empty value", () => {
    const result = contactInfoSchema.safeParse({ type: "phone", value: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing type field entirely", () => {
    const result = contactInfoSchema.safeParse({ value: "0901234567" });
    expect(result.success).toBe(false);
  });

  it("rejects missing value field entirely", () => {
    const result = contactInfoSchema.safeParse({ type: "phone" });
    expect(result.success).toBe(false);
  });

  it("accepts optional isPrimary boolean", () => {
    const result = contactInfoSchema.safeParse({ type: "phone", value: "090", isPrimary: true });
    expect(result.success).toBe(true);
  });
});

// ============================================
// createPaymentSourceInputSchema
// ============================================

describe("createPaymentSourceInputSchema", () => {
  it("validates with name", () => {
    const result = createPaymentSourceInputSchema.safeParse({ name: "MoMo" });
    expect(result.success).toBe(true);
  });

  it("defaults icon to 💳", () => {
    const result = createPaymentSourceInputSchema.parse({ name: "Cash" });
    expect(result.icon).toBe("💳");
  });

  it("rejects empty name", () => {
    const result = createPaymentSourceInputSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("createSalesChannelInputSchema", () => {
  it("applies policy defaults for new sales channels", () => {
    const result = createSalesChannelInputSchema.parse({ name: "CTV" });

    expect(result.defaultDeliveryMode).toBe("direct_redirect");
    expect(result.defaultLandingTemplateKey).toBe("owner_intro");
  });

  it("accepts landing page defaults for sales channels", () => {
    const result = createSalesChannelInputSchema.safeParse({
      name: "TikTok Shop",
      defaultDeliveryMode: "landing_page",
      defaultLandingTemplateKey: "ctv_neutral",
    });

    expect(result.success).toBe(true);
  });
});

describe("createShortLinkInputSchema", () => {
  it("defaults short link delivery mode to inherit channel", () => {
    const result = createShortLinkInputSchema.parse({
      target_url: "https://example.com",
    });

    expect(result.delivery_mode).toBe("inherit_channel");
    expect(result.max_clicks).toBe(999);
  });

  it("accepts landing page template and sales channel id", () => {
    const result = createShortLinkInputSchema.safeParse({
      target_url: "https://example.com",
      sales_channel_id: "550e8400-e29b-41d4-a716-446655440000",
      delivery_mode: "landing_page",
      landing_template_key: "ctv_neutral",
    });

    expect(result.success).toBe(true);
  });
});

describe("updateShortLinkInputSchema", () => {
  it("accepts clearing both IPv4 and IPv6 locks", () => {
    const result = updateShortLinkInputSchema.safeParse({
      locked_ip: null,
      locked_ipv6: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts switching to direct redirect and clearing landing template", () => {
    const result = updateShortLinkInputSchema.safeParse({
      delivery_mode: "direct_redirect",
      landing_template_key: null,
    });

    expect(result.success).toBe(true);
  });
});

// ============================================
// createSalesChannelInputSchema
// ============================================

describe("createSalesChannelInputSchema", () => {
  it("validates with name", () => {
    expect(createSalesChannelInputSchema.safeParse({ name: "Shopee" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createSalesChannelInputSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

// ============================================
// createLicenseKeyInputSchema
// ============================================

describe("createLicenseKeyInputSchema", () => {
  it("validates valid key", () => {
    const result = createLicenseKeyInputSchema.safeParse({
      keyCode: "ABC-123-XYZ",
      productId: "prod-1",
    });
    expect(result.success).toBe(true);
  });

  it("defaults status to available", () => {
    const result = createLicenseKeyInputSchema.parse({
      keyCode: "K1",
      productId: "P1",
    });
    expect(result.status).toBe("available");
  });

  it("accepts all valid statuses", () => {
    const statuses = ["available", "reserved", "used", "expired", "invalid"];
    statuses.forEach((status) => {
      const result = createLicenseKeyInputSchema.safeParse({
        keyCode: "K1",
        productId: "P1",
        status,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// createCalendarEventSchema
// ============================================

describe("createCalendarEventSchema", () => {
  it("validates minimal event", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "Follow up",
      date: "2024-03-15",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults", () => {
    const result = createCalendarEventSchema.parse({
      title: "Test",
      date: "2024-01-01",
    });
    expect(result.type).toBe("follow_up");
    expect(result.is_done).toBe(false);
    expect(result.customerIds).toEqual([]);
    expect(result.hasReminder).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createCalendarEventSchema.safeParse({
      title: "",
      date: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// addInventoryItemSchema
// ============================================

describe("addInventoryItemSchema", () => {
  const validItem = {
    productId: "prod-1",
    email: "test@example.com",
    maxSlots: 5,
    expiresAt: "2025-12-31",
  };

  it("validates valid inventory item", () => {
    expect(addInventoryItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = addInventoryItemSchema.safeParse({
      ...validItem,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxSlots > 20", () => {
    const result = addInventoryItemSchema.safeParse({
      ...validItem,
      maxSlots: 25,
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxSlots < 1", () => {
    const result = addInventoryItemSchema.safeParse({
      ...validItem,
      maxSlots: 0,
    });
    expect(result.success).toBe(false);
  });

  it("defaults usedSlots to 0", () => {
    const result = addInventoryItemSchema.parse(validItem);
    expect(result.usedSlots).toBe(0);
  });
});

// ============================================
// updateSystemSettingSchema
// ============================================

describe("updateSystemSettingSchema", () => {
  it("validates key with lowercase and underscore", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "auto_allocate", value: true }).success).toBe(true);
  });

  it("rejects key with uppercase", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "AutoAllocate", value: true }).success).toBe(false);
  });

  it("accepts string, number, boolean values", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "a", value: "test" }).success).toBe(true);
    expect(updateSystemSettingSchema.safeParse({ key: "a", value: 42 }).success).toBe(true);
    expect(updateSystemSettingSchema.safeParse({ key: "a", value: false }).success).toBe(true);
  });
});

// ============================================
// batchUpdateSettingsSchema
// ============================================

describe("batchUpdateSettingsSchema", () => {
  it("validates batch settings", () => {
    const result = batchUpdateSettingsSchema.safeParse({
      settings: [{ key: "test_key", value: "value" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty settings array", () => {
    const result = batchUpdateSettingsSchema.safeParse({ settings: [] });
    expect(result.success).toBe(false);
  });
});
