export type Role =
  | "admin_owner"
  | "sales_staff"
  | "inventory_staff"
  | "customer_support"
  | "accountant";

export interface SystemSettings {
  id?: string;
  company_name: string;
  tax_id: string;
  company_address: string;
  personal_name: string;
  bank_name: string;
  bank_account: string;
  default_notes: string;
  qr_transfer_content?: string;
  default_currency: string;
  locale: string;
  timezone: string;
  invoice_prefix: string;
  tax_label: string;
  tax_rate_default: number;
  payment_instruction_template: string;
  sales_landing_config: SalesLandingConfig;
}

export interface SalesLandingOfferConfig {
  product_id: string | null;
  href: string;
  label: string;
  price: string;
  desc: string;
}

export interface SalesLandingConfig {
  offers: SalesLandingOfferConfig[];
}

export type ReminderChannel = "telegram" | "zalo" | "email" | "both";

export interface ReminderConfig {
  id?: string;
  t7_enabled: boolean;
  t3_enabled: boolean;
  t1_enabled: boolean;
  channel: ReminderChannel;
  template_renewal: string;
  template_debt: string;
  template_renewal_internal: string;
  template_renewal_zalo: string;
  template_expired_zalo: string;
  auto_send: boolean;
}

export type BotUserContactChannel = "telegram" | "zalo";

export interface BotUserContact {
  id: string;
  accountId: string;
  channel: BotUserContactChannel;
  externalUserId: string;
  chatId?: string | null;
  displayName?: string | null;
  username?: string | null;
  phone?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  autoReminderEnabled: boolean;
  lastInteractionAt?: string | null;
  lastMessageText?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface BotCustomerMatchCandidate {
  id: string;
  name: string;
  contacts: Array<Pick<ContactInfo, "type" | "value">>;
}

export interface BotManagerStatus {
  telegram: {
    tokenConfigured: boolean;
    adminChatConfigured: boolean;
    webhookSecretConfigured: boolean;
    accountConfigured: boolean;
    accountMatchesCurrentTenant: boolean;
    accountResolutionSource: string | null;
    warnings: string[];
    runtime: {
      configuredMode: "webhook" | "polling" | "disabled";
      actualTransport: "webhook" | "polling" | "inactive";
      healthy: boolean;
      webhookUrl: string | null;
      pendingUpdateCount: number | null;
      lastHeartbeatAt: string | null;
      lastInboundAt: string | null;
      lastReplyAt: string | null;
      lastErrorAt: string | null;
      lastErrorMessage: string | null;
    };
  };
  zalo: {
    tokenConfigured: boolean;
    accountBound: boolean;
    adminConfigured: boolean;
    runtime: {
      configuredMode: "polling" | "disabled";
      actualTransport: "polling" | "inactive";
      healthy: boolean;
      lastHeartbeatAt: string | null;
      lastInboundAt: string | null;
      lastReplyAt: string | null;
      lastErrorAt: string | null;
      lastErrorMessage: string | null;
    };
  };
  contacts: {
    total: number;
    zalo: number;
    telegram: number;
    matched: number;
    autoReminderEnabled: number;
  };
  operational: {
    runtimeMode: "webhook-first" | "polling-fallback" | "inactive";
    runtimeHealthy: boolean;
    broadcastReady: boolean;
    tenantAligned: boolean;
    matchedCoveragePercent: number;
    autoReminderCoveragePercent: number;
  };
}

export type WebhookEvent =
  | "order.created"
  | "order.updated"
  | "order.paid"
  | "order.expired"
  | "customer.created"
  | "inventory.allocated"
  | "payment.received";

export type WebhookStatus = "active" | "inactive" | "failed";

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  status: WebhookStatus;
  secret?: string;
  created_at: string;
  last_triggered_at?: string;
  failure_count: number;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event: WebhookEvent;
  status_code: number;
  response_time_ms: number;
  created_at: string;
  success: boolean;
}

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "provisioning"
  | "active"
  | "expired"
  | "refunded";

export type ProductMode = "slot" | "key" | "hybrid";
export type KeyStatus = "available" | "reserved" | "used" | "expired" | "invalid";
export type ReminderType = "renewal" | "debt" | "follow_up";
export type RefundMode = "pro_rata" | "full";
export type PaymentTerms = "prepaid" | "credit" | "cod";
export type PaymentState = "unpaid" | "partial" | "paid" | "overpaid";
// Legacy order-level field kept for backward compatibility while payment_terms rolls out.
export type PaymentMethod = "paid" | "debt" | "cod";

export interface PaymentSource {
  id: string;
  name: string;
  icon: string; // emoji or short label
}

export type ShortLinkDeliveryMode = "inherit_channel" | "direct_redirect" | "landing_page";
export type ShortLinkResolvedDeliveryMode = Exclude<ShortLinkDeliveryMode, "inherit_channel">;
export type ShortLinkLandingTemplateKey = "owner_intro" | "ctv_neutral";
export type ShortLinkClickEventType = "bot_preview" | "landing_view" | "redirect_click" | "blocked";

export interface SalesChannelRuntimeSummary {
  linkedOrderCount: number;
  shortLinkCount: number;
  landingLinkCount: number;
  directLinkCount: number;
  inheritedLinkCount: number;
  overrideLinkCount: number;
}

export interface SalesChannel {
  id: string;
  name: string;
  defaultDeliveryMode: ShortLinkResolvedDeliveryMode;
  defaultLandingTemplateKey: ShortLinkLandingTemplateKey;
  runtime?: SalesChannelRuntimeSummary;
}

export interface ContactInfo {
  id: string;
  type: "phone" | "email" | "zalo" | "facebook" | "telegram" | "other";
  value: string;
  isPrimary?: boolean;
  // Facebook auto-resolved fields
  facebookId?: string;
  facebookName?: string;
}

export type WarehouseCredentialType = "link_join" | "2fa" | "2fa_backup" | "duolingo_id" | "other";

export interface WarehouseCredential {
  id: string;
  type: WarehouseCredentialType;
  label?: string; // custom label for "other"
  value: string;
}

export interface CustomerNick {
  nick: string;
  type: string;
  notes?: string;
  matched_source_id?: string | null;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
}

export type CustomerSegment = "vip" | "loyal" | "regular" | "at_risk" | "churned" | "new";

export interface Customer {
  id: string;
  name: string;
  contacts: ContactInfo[];
  tier: "vip" | "regular";
  customerType: "retail" | "wholesale" | "agency";
  group_id?: string;
  tags?: CustomerTag[];
  debtAmountVnd: number;
  debtOverdueDays: number;
  totalSpentVnd?: number;
  balanceVnd?: number;
  reliabilityScore: number;
  notes?: string;
  createdAt: string;
  nicksRegistry?: CustomerNick[];
  // RFM Segmentation fields
  segment?: CustomerSegment;
  rfmScore?: number;
  rfmRecency?: number;
  rfmFrequency?: number;
  rfmMonetary?: number;
  lastRfmCalculatedAt?: string;
}

export interface Provider {
  id: string;
  name: string;
  code?: string;
  status?: string;
  contacts: ContactInfo[];
  tier: "vip" | "regular";
  reliabilityScore: number;
  notes?: string;
  debtAmountVnd?: number;
  totalImportAmountVnd?: number;
  purchaseOrderCount?: number;
  createdAt: string;
}

export type PurchaseOrderStatus = "pending" | "received" | "cancelled" | "partial";

export interface PurchaseOrderItem {
  productId: string;
  productName?: string;
  quantity: number;
  priceVnd: number;
}

export interface PurchaseOrder {
  id: string;
  providerId: string;
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  totalAmountVnd: number;
  totalPaidVnd: number;
  paymentMethod?: string;
  notes?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductService {
  id: string;
  name: string;
  mode: ProductMode;
  buyPriceVnd: number;
  sellPriceVnd: number;
  durationType: 'days' | 'months' | 'years';
  durationValue: number;
  isActive: boolean;
}

export interface SourceAccount {
  id: string;
  email: string;
  provider: string;
  productIds: string[];
  maxSlots: number;
  usedSlots: number;
  notes?: Record<string, string>;
  reservedNicks?: string[];
  credentials?: WarehouseCredential[];
  expiresAt: string;
  purchaseCostVnd?: number;
  purchaseDate?: string;
  purchaseSource?: string;
}

export interface LicenseKey {
  id: string;
  keyCode: string;
  productId: string;
  status: KeyStatus;
}

export interface OrderItem {
  id: string; // Add an internal ID for the item
  productId: string;
  quantity: number;
  priceVnd: number; // Snapshot of the price at order time
  costPriceVnd?: number; // Snapshot of the cost price at order time
  notes?: string;
  assignedSourceAccountId?: string;
  assignedLicenseKeyId?: string;
  customerNickUsed?: string | null;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmountVnd: number;
  costPriceVnd?: number;
  totalCostVnd?: number;
  paymentMethod?: PaymentMethod;
  paymentTerms?: PaymentTerms;
  paymentState?: PaymentState;
  paymentSourceId?: string;
  salesChannelId?: string;
  contactSnapshot?: string; // Tên hiển thị loại contact và giá trị (VD: "Zalo: 090123")
  proofImageUrls?: string[];
  totalPaidVnd?: number;
  balanceDueVnd?: number;
  isFullyPaid?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderEvent {
  id: string;
  customerId: string;
  orderId: string;
  type: ReminderType;
  title: string;
  dueAt: string;
  isDone: boolean;
}

export interface DebtPolicyResult {
  allowCreateOrder: boolean;
  severity: "none" | "warning" | "critical";
  shouldAutoLockService: boolean;
  reminderRequired: boolean;
  message: string;
}

export interface AllocationSuggestion {
  orderId: string;
  sourceAccountId?: string;
  licenseKeyId?: string;
  isValid: boolean;
  warnings: string[];
}

export interface CalendarEventCustomer {
  id: string;
  name: string;
  contact?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  customerIds: string[];
  customers: CalendarEventCustomer[];
  date: string;
  time?: string;
  type: string;
  notes?: string;
  hasReminder: boolean;
  isDone: boolean;
  gcalEventId?: string;
}

// ─── Enriched Connection Types ────────────────────────────

export interface EnrichedConnection {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  customerNickUsed: string | null;
  orderId: string;
  orderStatus: string;
  orderCreatedAt: string;
  customerId: string;
  customerName: string;
  customerContact?: string | null;
}

export interface SlotBreakdown {
  connectedCount: number;
  reservedCount: number;
  availableCount: number;
  total: number;
  connectedItems: EnrichedConnection[];
  reservedNicks: string[];
}

