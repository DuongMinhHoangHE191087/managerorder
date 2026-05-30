import { z } from "zod/v3";
import { LEGACY_PAYMENT_METHOD_VALUES, PAYMENT_TERMS_VALUES } from "@/lib/domain/financial";

const optionalText = (schema: z.ZodString) =>
  z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }
    return value;
  }, schema.optional());

export const orderItemSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(1),
  costPriceVnd: z.number().min(0).optional(),
  sellPriceVnd: z.number().min(0).optional(),
  durationType: z.enum(["days", "months", "years"]).optional(),
  durationValue: z.number().int().min(1).optional(),
  bonusDurationValue: z.number().int().min(0).optional(),
  notes: optionalText(z.string().max(300)),
  assignedSourceAccountId: optionalText(z.string()),
  customerNickUsed: optionalText(z.string().max(200)),
});

export const createOrderInputSchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  items: z.array(orderItemSchema).min(1, "At least one product is required"),
  paymentMethod: z.enum(LEGACY_PAYMENT_METHOD_VALUES).optional(),
  paymentTerms: z.enum(PAYMENT_TERMS_VALUES).optional(),
  paymentSourceId: optionalText(z.string()),
  salesChannelId: optionalText(z.string()),
  proofImageUrls: z.array(z.string()).max(5).optional(),
  salesNote: optionalText(z.string().max(500)),
  contactSnapshot: optionalText(z.string().max(200)),
  registeredAt: optionalText(z.string()),
  orderNotes: optionalText(z.string().max(1000)),
  billingDetails: z.object({
    companyName: optionalText(z.string()),
    taxId: optionalText(z.string()),
    companyAddress: optionalText(z.string()),
    email: optionalText(z.string()),
  }).optional(),
});

// BUG #6 FIX: Zod schema for PUT /api/orders/[id]
export const updateOrderInputSchema = z.object({
  customer_id: z.string().uuid().optional(),
  status: z.enum([
    "draft", "pending_payment", "paid", "provisioning", "active",
    "expired", "refunded", "cancelled", "failed",
  ]).optional(),
  total_paid: z.number().min(0).optional(),
  payment_method: z.string().optional(),
  payment_terms: z.enum(PAYMENT_TERMS_VALUES).optional(),
  payment_source_id: z.string().uuid().nullable().optional(),
  sales_channel_id: z.string().uuid().nullable().optional(),
  sales_note: z.string().max(500).nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
  unit_price_vnd: z.number().min(0).optional(),
  cost_price_vnd: z.number().min(0).optional(),
  proof_image_urls: z.array(z.string().url()).max(10).optional(),
  items: z.array(z.object({
    id: z.string().uuid(),
    notes: z.string().max(300).optional(),
    customer_nick_used: z.string().max(200).optional(),
    assigned_source_account_id: z.string().uuid().nullable().optional(),
  })).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "No fields to update" }
);

export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;

export const allocationRequestSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  confirm: z.boolean().optional().default(false),
});

export const createProductInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên sản phẩm"),
  mode: z.enum(["slot", "key", "hybrid"]).default("slot"),
  buyPriceVnd: z.number().min(0).default(0),
  sellPriceVnd: z.number().min(0, "Giá bán không được âm"),
  durationType: z.enum(["days", "months", "years"]).default("days"),
  durationValue: z.number().int().min(1, "Thời hạn phải từ 1 trở lên"),
  isActive: z.boolean().default(true),
  iconUrl: z.string().nullable().optional(),
});

export const updateProductInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên sản phẩm").optional(),
  mode: z.enum(["slot", "key", "hybrid"]).optional(),
  buyPriceVnd: z.number().min(0).optional(),
  sellPriceVnd: z.number().min(0, "Giá bán không được âm").optional(),
  durationType: z.enum(["days", "months", "years"]).optional(),
  durationValue: z.number().int().min(1, "Thời hạn phải từ 1 trở lên").optional(),
  isActive: z.boolean().optional(),
  iconUrl: z.string().nullable().optional(),
});

export const contactInfoSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["phone", "email", "zalo", "facebook", "telegram", "other"]),
  value: z.string().min(1, "Vui lòng nhập giá trị"),
  isPrimary: z.boolean().optional(),
  facebookId: z.string().optional(),
  facebookName: z.string().optional(),
});

export const createCustomerInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên khách hàng"),
  contacts: z.array(contactInfoSchema).min(1, "Ít nhất 1 thông tin liên hệ"),
  tier: z.enum(["regular", "vip", "agency"]).default("regular"),
  customerType: z.enum(["retail", "wholesale", "agency"]).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  notes: optionalText(z.string().max(1000)),
  avatarUrl: z.string().nullable().optional(),
});

export const updateCustomerInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên khách hàng").optional(),
  contacts: z.array(contactInfoSchema).optional(),
  tier: z.enum(["regular", "vip"]).optional(),
  customerType: z.enum(["retail", "wholesale", "agency"]).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  reliabilityScore: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
  avatarUrl: z.string().nullable().optional(),
});

export const createProviderInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên nhà cung cấp"),
  contacts: z.array(contactInfoSchema).min(1, "Ít nhất 1 thông tin liên hệ"),
  tier: z.enum(["regular", "vip"]).default("regular"),
});

export const createPaymentSourceInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên nguồn thanh toán"),
  icon: z.string().default("💳"),
  bank_name: z.string().nullable().optional(),
  account_number: z.string().nullable().optional(),
});

const shortLinkResolvedDeliveryModeSchema = z.enum(["direct_redirect", "landing_page"]);
const shortLinkDeliveryModeSchema = z.enum(["inherit_channel", "direct_redirect", "landing_page"]);
const shortLinkLandingTemplateKeySchema = z.enum(["owner_intro", "ctv_neutral"]);
const shortLinkFailureTemplateKeySchema = z.enum(["seller_unlock_request", "customer_offer_wall"]);

export const createSalesChannelInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên kênh bán"),
  defaultDeliveryMode: shortLinkResolvedDeliveryModeSchema.optional().default("direct_redirect"),
  defaultLandingTemplateKey: shortLinkLandingTemplateKeySchema.optional().default("owner_intro"),
  defaultFailureTemplateKey: shortLinkFailureTemplateKeySchema.optional().default("customer_offer_wall"),
  sellerContactUrl: optionalText(z.string().url("URL liên hệ người bán không hợp lệ").max(500)),
});

export const updateSalesChannelInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên kênh bán").optional(),
  defaultDeliveryMode: shortLinkResolvedDeliveryModeSchema.optional(),
  defaultLandingTemplateKey: shortLinkLandingTemplateKeySchema.optional(),
  defaultFailureTemplateKey: shortLinkFailureTemplateKeySchema.optional(),
  sellerContactUrl: z.string().url("URL liên hệ người bán không hợp lệ").max(500).nullable().optional(),
});

export const createShortLinkInputSchema = z.object({
  target_url: z.string().url("URL đích không hợp lệ"),
  title: optionalText(z.string().max(200)),
  max_clicks: z.number().int().min(1).max(999).optional().default(999),
  expires_at: optionalText(z.string()),
  order_id: optionalText(z.string().uuid()),
  customer_id: optionalText(z.string().uuid()),
  created_by: optionalText(z.string().max(200)),
  require_token: z.boolean().optional().default(false),
  notify_clicks: z.boolean().optional().default(false),
  sales_channel_id: optionalText(z.string().uuid()),
  delivery_mode: shortLinkDeliveryModeSchema.optional().default("inherit_channel"),
  landing_template_key: shortLinkLandingTemplateKeySchema.nullish(),
  failure_template_key: shortLinkFailureTemplateKeySchema.nullish(),
  seller_contact_url: optionalText(z.string().url("URL liên hệ người bán không hợp lệ").max(500)),
});

export const updateShortLinkInputSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  target_url: z.string().url("URL đích không hợp lệ").optional(),
  max_clicks: z.number().int().min(1).max(999).optional(),
  current_clicks: z.number().int().min(0).max(999).optional(),
  expires_at: z.string().nullable().optional(),
  status: z.enum(["active", "expired", "disabled"]).optional(),
  require_token: z.boolean().optional(),
  locked_ip: z.string().nullable().optional(),
  locked_ipv6: z.string().nullable().optional(),
  notify_clicks: z.boolean().optional(),
  sales_channel_id: z.string().uuid().nullable().optional(),
  delivery_mode: shortLinkDeliveryModeSchema.optional(),
  landing_template_key: shortLinkLandingTemplateKeySchema.nullish(),
  failure_template_key: shortLinkFailureTemplateKeySchema.nullish(),
  seller_contact_url: z.string().url("URL liên hệ người bán không hợp lệ").max(500).nullable().optional(),
});

export const createLicenseKeyInputSchema = z.object({
  keyCode: z.string().min(1, "Vui lòng nhập key mua hàng"),
  productId: z.string().min(1, "Vui lòng chọn sản phẩm"),
  status: z.enum(["available", "reserved", "used", "expired", "invalid"]).optional().default("available"),
});

export const createCalendarEventSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tiêu đề sự kiện"),
  date: z.string().min(1, "Vui lòng chọn ngày"),
  time: z.string().optional(),
  type: z.enum(["renewal", "follow_up", "payment_due", "payment", "reminder", "meeting", "other"]).optional().default("follow_up"),
  is_done: z.boolean().optional().default(false),
  customerIds: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
  hasReminder: z.boolean().optional().default(false),
});

export const updateCalendarEventSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tiêu đề sự kiện").optional(),
  date: z.string().min(1, "Vui lòng chọn ngày").optional(),
  time: z.string().optional(),
  type: z.enum(["renewal", "follow_up", "payment_due", "payment", "reminder", "meeting", "other"]).optional(),
  is_done: z.boolean().optional(),
  customerIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  hasReminder: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;
export type CreateProviderInput = z.infer<typeof createProviderInputSchema>;
// CreateOrderInput is the **output** type (after Zod parses / applies defaults)
export type CreateOrderInput = z.output<typeof createOrderInputSchema>;
// CreateOrderFieldValues is the **input** type used for react-hook-form's field values
export type CreateOrderFieldValues = z.input<typeof createOrderInputSchema>;
export type AllocationRequest = z.infer<typeof allocationRequestSchema>;
export type CreatePaymentSourceInput = z.infer<typeof createPaymentSourceInputSchema>;
export type CreateSalesChannelInput = z.infer<typeof createSalesChannelInputSchema>;
export type UpdateSalesChannelInput = z.infer<typeof updateSalesChannelInputSchema>;
export type CreateShortLinkInput = z.infer<typeof createShortLinkInputSchema>;
export type UpdateShortLinkInput = z.infer<typeof updateShortLinkInputSchema>;

// --- Inventory Schemas ---
export const addInventoryItemSchema = z.object({
  productId: z.string().min(1, "Vui lòng chọn sản phẩm"),
  email: z.string().email("Email không hợp lệ - phải có dạng name@domain.com"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").optional(),
  maxSlots: z.number().int().min(1, "Tối thiểu 1 slot").max(20, "Tối đa 20 slot"),
  usedSlots: z.number().int().min(0).default(0),
  expiresAt: z.string().min(1, "Vui lòng nhập ngày hết hạn"),
  notes: z.string().max(500).optional(),
});

export const updateInventoryItemSchema = addInventoryItemSchema.partial().extend({
  id: z.string().min(1, "id là bắt buộc"),
});

// --- Settings Schemas ---
export const updateSystemSettingSchema = z.object({
  key: z.string().regex(/^[a-z_]+$/, "Key chỉ chứa chữ thường và dấu gạch dưới"),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const batchUpdateSettingsSchema = z.object({
  settings: z.array(updateSystemSettingSchema).min(1, "Cần ít nhất 1 cài đặt"),
});

// Type exports for new schemas
export type AddInventoryItemInput = z.infer<typeof addInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type UpdateSystemSettingInput = z.infer<typeof updateSystemSettingSchema>;
export type BatchUpdateSettingsInput = z.infer<typeof batchUpdateSettingsSchema>;
