import { z } from "zod";
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
  tier: z.enum(["regular", "vip"]).default("regular"),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const updateCustomerInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên khách hàng").optional(),
  contacts: z.array(contactInfoSchema).optional(),
  tier: z.enum(["regular", "vip"]).optional(),
  customerType: z.enum(["retail", "wholesale", "agency"]).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  reliabilityScore: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const createProviderInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên nhà cung cấp"),
  contacts: z.array(contactInfoSchema).min(1, "Ít nhất 1 thông tin liên hệ"),
  tier: z.enum(["regular", "vip"]).default("regular"),
});

export const createPaymentSourceInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên nguồn thanh toán"),
  icon: z.string().default("💳"),
});

export const createSalesChannelInputSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên kênh bán"),
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
