// ============================================================
// ORDER SERVICE — Business Logic Layer
// ============================================================
// Handles: product validation, line item building, pricing,
// expiry calculation, invoice snapshots, atomic order creation,
// slot updates, and nicks registry synchronization.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { invalidate } from "@/lib/cache/db-cache";
import { generateOrderCode } from "@/lib/utils/order-code";
import { emitEvent } from "@/lib/services/event-bus.service";
import { createTenantQuery } from "@/lib/supabase/tenant-client";
import type { Database } from "@/lib/supabase/database.types";
import {
  normalizePaymentTerms,
  toLegacyPaymentMethod,
} from "@/lib/domain/financial";
import {
  addOrderDuration,
  resolveOrderDuration,
  type OrderDurationType,
} from "@/lib/domain/order-duration";
import { normalizeSystemSettings } from "@/lib/settings/system-settings";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

// Product fields returned by the batch-fetch query
interface ProductSnapshot {
  id: string;
  name: string;
  buy_price_vnd: number;
  sell_price_vnd: number;
  duration_type: string;
  duration_value: number;
  is_active: boolean;
}

// ─── Types ────────────────────────────────────────────────────

export interface CreateOrderInput {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    costPriceVnd?: number;
    sellPriceVnd?: number;
    durationType?: OrderDurationType;
    durationValue?: number;
    bonusDurationValue?: number;
    notes?: string;
    assignedSourceAccountId?: string;
    customerNickUsed?: string;
  }>;
  paymentMethod?: string;
  paymentTerms?: string;
  paymentSourceId?: string;
  salesChannelId?: string;
  proofImageUrls?: string[];
  salesNote?: string;
  contactSnapshot?: string;
  billingDetails?: {
    companyName?: string;
    taxId?: string;
    companyAddress?: string;
    email?: string;
  };
  registeredAt?: string;
  orderNotes?: string;
  createdBy?: string | null;
}

export interface CreateOrderResult {
  order: OrderRow;
  items: OrderItemRow[];
  warning?: string;
}

// ─── Line Item Builder ────────────────────────────────────────

interface LineItem {
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  price_vnd: number;
  cost_price_vnd: number;
  subtotal_vnd: number;
  notes: string | null;
  assigned_source_account_id: string | null;
  customer_nick_used: string | null;
  duration_type: 'days' | 'months' | 'years';
  duration_value: number;
  bonus_duration_value: number;
  effective_duration_value: number;
}

function createOrderInputError(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function validateCreateOrderInput(input: CreateOrderInput): Date {
  if (!input.customerId?.trim()) {
    throw createOrderInputError("Thiếu khách hàng cho đơn hàng");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw createOrderInputError("Đơn hàng phải có ít nhất 1 sản phẩm");
  }

  for (const [index, item] of input.items.entries()) {
    if (!item.productId?.trim()) {
      throw createOrderInputError(`Thiếu sản phẩm ở dòng ${index + 1}`);
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw createOrderInputError(`Số lượng không hợp lệ cho sản phẩm ${item.productId}`);
    }

    if (item.sellPriceVnd !== undefined && (!Number.isFinite(item.sellPriceVnd) || item.sellPriceVnd < 0)) {
      throw createOrderInputError(`Giá bán không hợp lệ cho sản phẩm ${item.productId}`);
    }

    if (item.costPriceVnd !== undefined && (!Number.isFinite(item.costPriceVnd) || item.costPriceVnd < 0)) {
      throw createOrderInputError(`Giá vốn không hợp lệ cho sản phẩm ${item.productId}`);
    }
  }

  const registeredDate = input.registeredAt ? new Date(input.registeredAt) : new Date();
  if (Number.isNaN(registeredDate.getTime())) {
    throw createOrderInputError("Ngày đăng ký không hợp lệ");
  }

  return registeredDate;
}

function buildLineItems(items: CreateOrderInput['items'], productMap: Map<string, ProductSnapshot>): LineItem[] {
  return items.map(item => {
    const p = productMap.get(item.productId);
    if (!p) throw Object.assign(new Error(`Sản phẩm không tồn tại: ${item.productId}`), { status: 404 });
    const unitPrice = Number(item.sellPriceVnd ?? p.sell_price_vnd);
    const costPrice = Number(item.costPriceVnd ?? p.buy_price_vnd);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw Object.assign(new Error(`Giá bán cấu hình không hợp lệ cho sản phẩm ${p.name}`), { status: 422 });
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw Object.assign(new Error(`Giá vốn cấu hình không hợp lệ cho sản phẩm ${p.name}`), { status: 422 });
    }

    const resolvedDuration = resolveOrderDuration(item, {
      durationType: p.duration_type,
      durationValue: p.duration_value,
    });
    if (!Number.isFinite(resolvedDuration.effectiveDurationValue) || resolvedDuration.effectiveDurationValue <= 0) {
      throw Object.assign(new Error(`Thời hạn cấu hình không hợp lệ cho sản phẩm ${p.name}`), { status: 422 });
    }

    const subtotal = unitPrice * item.quantity;
    return {
      product_id: item.productId,
      product_name_snapshot: p.name,
      quantity: item.quantity,
      price_vnd: unitPrice,
      cost_price_vnd: costPrice,
      subtotal_vnd: subtotal,
      notes: item.notes ?? null,
      assigned_source_account_id: item.assignedSourceAccountId ?? null,
      customer_nick_used: item.customerNickUsed ?? null,
      duration_type: resolvedDuration.durationType,
      duration_value: resolvedDuration.durationValue,
      bonus_duration_value: resolvedDuration.bonusDurationValue,
      effective_duration_value: resolvedDuration.effectiveDurationValue,
    };
  });
}

// ─── Expiry Calculator ────────────────────────────────────────

function calculateExpiryDate(primaryLine: LineItem, registeredAt: Date): string {
  const nextDate = addOrderDuration(
    new Date(registeredAt),
    resolveOrderDuration({
      durationType: primaryLine.duration_type,
      durationValue: primaryLine.duration_value,
      bonusDurationValue: primaryLine.bonus_duration_value,
    }),
  );
  return nextDate.toISOString();
}

// ─── Invoice Snapshot ─────────────────────────────────────────

async function buildInvoiceSnapshot(accountId: string): Promise<Record<string, unknown> | null> {
  try {
    const sysSettings = await createTenantQuery(accountId)
      .from("system_settings")
      .select("*")
      .limit(1) as unknown as { data: Array<Record<string, unknown>> | null };

    if (!sysSettings?.data || sysSettings.data.length === 0) return null;

    const settings = normalizeSystemSettings(sysSettings.data[0] ?? null);

    return {
      company_name: settings.company_name,
      tax_id: settings.tax_id,
      company_address: settings.company_address,
      personal_name: settings.personal_name,
      bank_name: settings.bank_name,
      bank_account: settings.bank_account,
      default_notes: settings.default_notes,
      default_currency: settings.default_currency,
      locale: settings.locale,
      timezone: settings.timezone,
      invoice_prefix: settings.invoice_prefix,
      tax_label: settings.tax_label,
      tax_rate_default: String(settings.tax_rate_default),
      snapshot_time: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ─── Slot Updates (error-propagating) ─────────────────────────

async function updateSourceAccountSlots(accountId: string, lineItems: LineItem[]): Promise<void> {
  const slotMap = new Map<string, number>();
  for (const li of lineItems) {
    if (li.assigned_source_account_id) {
      slotMap.set(
        li.assigned_source_account_id,
        (slotMap.get(li.assigned_source_account_id) ?? 0) + li.quantity
      );
    }
  }
  if (slotMap.size === 0) return;

  const errors: string[] = [];

  const slotUpdates = Array.from(slotMap.entries()).map(async ([saId, qty]) => {
    // Use the existing RPC for atomic increment
    const res = await supabaseAdmin.rpc("increment_source_account_slots" as never, { p_account_id: accountId, p_source_id: saId, p_quantity: qty } as never);
    if (res.error) {
      errors.push(`Source ${saId}: ${res.error.message}`);
    }
  });

  await Promise.allSettled(slotUpdates);

  // Propagate errors instead of swallowing them
  if (errors.length > 0) {
    console.error("[Slot Update Errors]", errors);
    throw new Error(`Cập nhật slot thất bại: ${errors.join('; ')}`);
  }
}

// ─── Nicks Registry Sync ──────────────────────────────────────

async function syncNicksRegistry(
  customerId: string,
  lineItems: LineItem[],
  currentNicksRegistry: Record<string, unknown>[]
): Promise<void> {
  const newNicks = [...currentNicksRegistry];
  let hasChanges = false;

  for (const li of lineItems) {
    if (li.customer_nick_used) {
      const exists = newNicks.find(n => n.nick === li.customer_nick_used && n.type === li.product_name_snapshot);
      if (!exists) {
        hasChanges = true;
        newNicks.push({
          nick: li.customer_nick_used,
          type: li.product_name_snapshot,
          notes: li.notes || "",
          matched_source_id: li.assigned_source_account_id
        });
      }
    }
  }

  if (hasChanges) {
    await supabaseAdmin.from("customers").update({ nicks_registry: newNicks }).eq("id", customerId);
  }
}

// ─── Main Service Function ────────────────────────────────────

/**
 * Create a new order with full business logic:
 * 1. Validate products (exist + active)
 * 2. Build line items with price snapshots
 * 3. Calculate expiry, totals, invoice snapshot
 * 4. Persist order + items ATOMICALLY via RPC (single DB transaction)
 * 5. Update source account slots
 * 6. Sync customer nicks registry
 * 7. Log activity
 */
export async function createOrderWithItems(
  accountId: string,
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  const registeredDate = validateCreateOrderInput(input);
  const {
    customerId, items, paymentMethod, paymentTerms, paymentSourceId,
    salesChannelId, proofImageUrls, salesNote,
    contactSnapshot, billingDetails, registeredAt, orderNotes, createdBy
  } = input;

  const resolvedPaymentTerms = normalizePaymentTerms(paymentTerms ?? paymentMethod);
  const legacyPaymentMethod = toLegacyPaymentMethod(resolvedPaymentTerms);

  // 1. Batch-fetch products AND customer name AND invoice snapshot in parallel
  const productIds = [...new Set(items.map(i => i.productId))];
  const [productsResult, customerResult, invoiceSnapshot] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, buy_price_vnd, sell_price_vnd, duration_type, duration_value, is_active")
      .in("id", productIds)
      .eq("account_id", accountId),
    supabaseAdmin
      .from("customers")
      .select("full_name, nicks_registry")
      .eq("id", customerId)
      .eq("account_id", accountId)
      .single(),
    buildInvoiceSnapshot(accountId)
  ]);

  if (productsResult.error) throw new Error(productsResult.error.message);
  const products = productsResult.data;
  const customerFullName = customerResult.data?.full_name ?? null;
  const currentNicksRegistry = (customerResult.data?.nicks_registry as Record<string, unknown>[]) || [];

  const productMap = new Map((products ?? []).map(p => [p.id, p]));

  // 2. Validate every item
  for (const item of items) {
    const p = productMap.get(item.productId);
    if (!p) throw Object.assign(new Error(`Sản phẩm không tồn tại: ${item.productId}`), { status: 404 });
    if (!p.is_active) throw Object.assign(new Error(`Sản phẩm đã ngừng bán: ${p.name}`), { status: 422 });
  }

  // 3. Build line items with frozen price snapshots
  const lineItems = buildLineItems(items, productMap);
  const totalAmountVnd = lineItems.reduce((sum, li) => sum + li.subtotal_vnd, 0);
  const totalCostVnd = lineItems.reduce((sum, li) => sum + ((li.cost_price_vnd ?? 0) * li.quantity), 0);
  const totalQuantity = lineItems.reduce((sum, li) => sum + li.quantity, 0);

  // 4. Calculate expiry + build invoice snapshot
  const primaryLine = lineItems[0];
  const expiresAt = calculateExpiryDate(primaryLine, registeredDate);
  const isMultiProduct = productIds.length > 1;
  const initialStatus = resolvedPaymentTerms === "prepaid" ? "paid" : "pending_payment";

  // 5. ATOMIC: Persist order + items in a single DB transaction via RPC
  const buildOrderPayload = (orderCode: string) => ({
    account_id: accountId,
    order_code: orderCode,
    customer_id: customerId,
    product_id: primaryLine.product_id,
    product_name_snapshot: isMultiProduct ? null : primaryLine.product_name_snapshot,
    unit_price_vnd: isMultiProduct ? null : primaryLine.price_vnd,
    quantity: totalQuantity,
    total_amount_vnd: totalAmountVnd,
    total_paid: resolvedPaymentTerms === "prepaid" ? totalAmountVnd : 0,
    payment_method: legacyPaymentMethod,
    payment_terms: resolvedPaymentTerms,
    payment_source_id: paymentSourceId ?? null,
    sales_channel_id: salesChannelId ?? null,
    status: initialStatus,
    contact_snapshot: contactSnapshot ?? null,
    proof_image_urls: proofImageUrls?.length ? proofImageUrls : null,
    sales_note: [salesNote, orderNotes].filter(Boolean).join(' | ') || null,
    expires_at: expiresAt,
    created_at: registeredAt ? registeredDate.toISOString() : undefined,
    cost_price_vnd: isMultiProduct ? null : primaryLine.cost_price_vnd,
    total_cost_vnd: totalCostVnd,
    invoice_snapshot: {
      ...(invoiceSnapshot ?? {}),
      sales_context: {
        registered_at: registeredDate.toISOString(),
        created_by: createdBy ?? null,
        primary_duration: {
          duration_type: primaryLine.duration_type,
          duration_value: primaryLine.duration_value,
          bonus_duration_value: primaryLine.bonus_duration_value,
          effective_duration_value: primaryLine.effective_duration_value,
        },
        item_breakdown: lineItems.map((lineItem) => ({
          product_id: lineItem.product_id,
          product_name: lineItem.product_name_snapshot,
          quantity: lineItem.quantity,
          unit_price_vnd: lineItem.price_vnd,
          cost_price_vnd: lineItem.cost_price_vnd,
          subtotal_vnd: lineItem.subtotal_vnd,
          duration_type: lineItem.duration_type,
          duration_value: lineItem.duration_value,
          bonus_duration_value: lineItem.bonus_duration_value,
          effective_duration_value: lineItem.effective_duration_value,
          assigned_source_account_id: lineItem.assigned_source_account_id,
          customer_nick_used: lineItem.customer_nick_used,
        })),
      },
    },
    billing_details: billingDetails ? {
      company_name: billingDetails.companyName ?? null,
      tax_id: billingDetails.taxId ?? null,
      company_address: billingDetails.companyAddress ?? null,
      email: billingDetails.email ?? null,
      customer_name_snapshot: customerFullName,
    } : null,
  });

  const itemsPayload = lineItems.map(li => ({
    product_id: li.product_id,
    product_name_snapshot: li.product_name_snapshot,
    quantity: li.quantity,
    price_vnd: li.price_vnd,
    cost_price_vnd: li.cost_price_vnd,
    subtotal_vnd: li.subtotal_vnd,
    notes: li.notes,
    assigned_source_account_id: li.assigned_source_account_id,
    customer_nick_used: li.customer_nick_used,
  }));

  const maxAttempts = 3;
  let rpcResult: unknown = null;
  let rpcError: { message: string } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const orderCode = generateOrderCode(expiresAt);
    const orderPayload = buildOrderPayload(orderCode);
    const response = await supabaseAdmin.rpc(
      "create_order_with_items" as never,
      { p_order: orderPayload, p_items: itemsPayload } as never
    );

    if (!response.error) {
      rpcResult = response.data;
      rpcError = null;
      break;
    }

    rpcError = response.error as unknown as { message: string };
    const lowerMsg = (rpcError.message || "").toLowerCase();
    const isOrderCodeConflict =
      lowerMsg.includes("order_code") &&
      (lowerMsg.includes("duplicate") || lowerMsg.includes("unique"));

    if (!isOrderCodeConflict || attempt === maxAttempts) {
      break;
    }

    const backoffMs = 25 + Math.floor(Math.random() * 50 * attempt);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
  }

  if (rpcError) {
    throw new Error(`Tạo đơn hàng thất bại (transaction rolled back): ${rpcError.message}`);
  }

  // Parse RPC result
  const result = rpcResult as { order: OrderRow; items: OrderItemRow[] };
  const order = result.order;
  const insertedItems = result.items ?? [];

  // Cache invalidation is synchronous (in-memory)
  invalidate(`orders:list:${accountId}`);

  // Run post-create effects explicitly so failures are visible to callers.
  const warning = await runPostCreateEffects(accountId, order, customerId, lineItems, currentNicksRegistry, {
    totalAmountVnd,
    paymentMethod: paymentMethod ?? null,
    paymentTerms: resolvedPaymentTerms,
    itemsCount: items.length,
    initialStatus,
    createdBy: createdBy ?? null,
    totalCostVnd,
  });

  return warning ? { order, items: insertedItems, warning } : { order, items: insertedItems };
}

// ─── Post-create Effects ─────────────────────────────────────
async function runPostCreateEffects(
  accountId: string,
  order: OrderRow,
  customerId: string,
  lineItems: LineItem[],
  currentNicksRegistry: Record<string, unknown>[],
  meta: {
    totalAmountVnd: number;
    paymentMethod: string | null;
    paymentTerms: string | null;
    itemsCount: number;
    initialStatus: string;
    createdBy: string | null;
    totalCostVnd: number;
  }
): Promise<string | undefined> {
  const jobs = [
    {
      label: "slot update",
      promise: updateSourceAccountSlots(accountId, lineItems),
    },
    {
      label: "nicks registry sync",
      promise: syncNicksRegistry(customerId, lineItems, currentNicksRegistry),
    },
    {
      label: "activity log",
      promise: createActivityLog({
        account_id: accountId,
        action_type: "ORDER_CREATED",
        customer_id: customerId,
        order_id: order.id,
        created_by: meta.createdBy,
        details: {
          total_amount_vnd: meta.totalAmountVnd,
          total_cost_vnd: meta.totalCostVnd,
          payment_method: meta.paymentMethod,
          payment_terms: meta.paymentTerms,
          items_count: meta.itemsCount,
          expires_at: order.expires_at,
          order_snapshot: {
            status: order.status,
            total_paid: order.total_paid,
            quantity: order.quantity,
            sales_note: order.sales_note,
          },
          item_breakdown: lineItems.map((lineItem) => ({
            product_name: lineItem.product_name_snapshot,
            quantity: lineItem.quantity,
            unit_price_vnd: lineItem.price_vnd,
            cost_price_vnd: lineItem.cost_price_vnd,
            subtotal_vnd: lineItem.subtotal_vnd,
            duration_type: lineItem.duration_type,
            duration_value: lineItem.duration_value,
            bonus_duration_value: lineItem.bonus_duration_value,
            effective_duration_value: lineItem.effective_duration_value,
            assigned_source_account_id: lineItem.assigned_source_account_id,
            customer_nick_used: lineItem.customer_nick_used,
          })),
        },
      }),
    },
    {
      label: "event bus",
      promise: emitEvent(accountId, 'order.created', {
        order_id: order.id,
        order_code: order.order_code,
        customer_id: customerId,
        total_amount_vnd: meta.totalAmountVnd,
        status: meta.initialStatus,
        items_count: meta.itemsCount,
      }),
    },
  ];

  const results = await Promise.allSettled(jobs.map((job) => job.promise));
  const failures = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return [`${jobs[index]?.label ?? "unknown"}: ${reason}`];
  });

  if (failures.length > 0) {
    console.error("[PostCreate] Side effect failures:", failures);
    return `Đơn hàng đã tạo thành công nhưng một số tác vụ hậu tạo thất bại: ${failures.join("; ")}`;
  }

  return undefined;
}
