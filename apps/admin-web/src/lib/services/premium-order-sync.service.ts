import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { getCycleMonths, type PremiumBillingCycle } from "@/lib/domain/premium-renewal-finance";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { encryptPremiumPassword } from "@/lib/utils/premium-account-credentials";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type SourceAccountRow = Database["public"]["Tables"]["source_accounts"]["Row"];
type PremiumServiceTypeRow = Database["public"]["Tables"]["premium_service_types"]["Row"];
type PremiumPackageRow = Database["public"]["Tables"]["premium_packages"]["Row"];
type PremiumAccountRow = Database["public"]["Tables"]["premium_accounts"]["Row"];
type CustomerPremiumSubscriptionRow = Database["public"]["Tables"]["customer_premium_subscriptions"]["Row"];

type OrderSyncContext = {
  order: Pick<
    OrderRow,
    | "id"
    | "account_id"
    | "customer_id"
    | "order_code"
    | "product_id"
    | "product_name_snapshot"
    | "quantity"
    | "total_amount_vnd"
    | "total_paid"
    | "sales_note"
    | "contact_snapshot"
    | "status"
    | "expires_at"
    | "created_at"
    | "updated_at"
    | "proof_image_urls"
  >;
  orderItem: Pick<
    OrderItemRow,
    | "id"
    | "product_id"
    | "product_name_snapshot"
    | "quantity"
    | "assigned_source_account_id"
    | "customer_nick_used"
  >;
  customer: Pick<CustomerRow, "id" | "full_name"> | null;
  product: Pick<
    ProductRow,
    | "id"
    | "name"
    | "duration_type"
    | "duration_value"
    | "sell_price_vnd"
    | "buy_price_vnd"
  >;
};

export type SyncOrderToPremiumResult = {
  orderId: string;
  orderCode: string | null;
  subscriptionId: string | null;
  premiumAccountId: string | null;
  status: "created" | "updated" | "skipped";
  reason?: string;
  sourceAccountId: string | null;
  placeholderAccount: boolean;
};

export type SyncPremiumOrdersResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ orderId: string; orderCode: string | null; message: string }>;
  results: SyncOrderToPremiumResult[];
};

function slugify(input: string) {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "item";
}

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function deriveServiceName(productName: string) {
  const withoutParens = productName.replace(/\([^)]*\)/g, " ");
  const withoutDuration = withoutParens.replace(
    /\b\d+\s*(month|months|year|years|tháng|thang|năm|nam)\b/gi,
    " ",
  );
  const withoutSuffixes = withoutDuration.replace(
    /\b(dùng chung|nick cấp|nâng trên mail chính chủ)\b/gi,
    " ",
  );

  return normalizeWhitespace(withoutSuffixes) || normalizeWhitespace(productName);
}

function resolveBillingCycle(durationType: string | null, durationValue: number | null): PremiumBillingCycle {
  const normalizedType = String(durationType ?? "").toLowerCase();
  const value = Number(durationValue ?? 0);

  if (normalizedType === "years" && value >= 1) {
    return "1year";
  }
  if (normalizedType === "months" && value >= 6) {
    return "6months";
  }
  if (normalizedType === "months" && value >= 3) {
    return "3months";
  }
  if (normalizedType === "days" && value >= 365) {
    return "1year";
  }
  if (normalizedType === "days" && value >= 180) {
    return "6months";
  }
  if (normalizedType === "days" && value >= 90) {
    return "3months";
  }

  return "1month";
}

function normalizePackageSlots(value: number) {
  return Math.min(100, Math.max(1, Number(value || 1)));
}

function getOrderDerivedStatus(order: Pick<OrderRow, "status" | "expires_at">) {
  if (order.status === "refunded") {
    return {
      subscriptionStatus: "refunded",
      premiumAccountStatus: "cancelled" as PremiumAccountRow["status"],
    };
  }

  const expiry = new Date(order.expires_at);
  const expired = Number.isNaN(expiry.getTime()) ? false : expiry.getTime() < Date.now();

  if (expired) {
    return {
      subscriptionStatus: "expired",
      premiumAccountStatus: "expired" as PremiumAccountRow["status"],
    };
  }

  return {
    subscriptionStatus: "active",
    premiumAccountStatus: "active" as PremiumAccountRow["status"],
  };
}

function extractUrls(value?: string | null) {
  return String(value ?? "").match(/https?:\/\/[^\s|]+/gi) ?? [];
}

function getSourceCredentialUrls(sourceAccount: Pick<SourceAccountRow, "notes">) {
  const notes = sourceAccount.notes;
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    return [];
  }

  const credentials = Array.isArray((notes as { credentials?: unknown }).credentials)
    ? (notes as { credentials: Array<{ value?: unknown }> }).credentials
    : [];

  return credentials
    .map((item) => (typeof item?.value === "string" ? item.value.trim() : ""))
    .filter(Boolean);
}

function getSourcePassword(sourceAccount: Pick<SourceAccountRow, "notes">) {
  const notes = sourceAccount.notes;
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    return null;
  }

  const password = (notes as { password?: unknown }).password;
  return typeof password === "string" && password.trim() ? password.trim() : null;
}

function buildPremiumAccountNotes(args: {
  order: Pick<OrderRow, "id" | "order_code" | "product_name_snapshot" | "sales_note" | "contact_snapshot">;
  sourceAccountId: string | null;
  placeholderAccount: boolean;
}) {
  return JSON.stringify({
    sync_source: "legacy_order_sync",
    order_id: args.order.id,
    order_code: args.order.order_code,
    product_name: args.order.product_name_snapshot,
    source_account_id: args.sourceAccountId,
    placeholder_account: args.placeholderAccount,
    sales_note: args.order.sales_note ?? null,
    contact_snapshot: args.order.contact_snapshot ?? null,
  });
}

async function loadOrderContext(accountId: string, orderId: string): Promise<OrderSyncContext | null> {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, account_id, customer_id, order_code, product_id, product_name_snapshot, quantity, total_amount_vnd, total_paid, sales_note, contact_snapshot, status, expires_at, created_at, updated_at, proof_image_urls",
    )
    .eq("id", orderId)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!order) {
    return null;
  }

  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select("id, product_id, product_name_snapshot, quantity, assigned_source_account_id, customer_nick_used")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  if (!orderItems || orderItems.length === 0) {
    return null;
  }

  if (orderItems.length !== 1) {
    return {
      order,
      orderItem: orderItems[0],
      customer: null,
      product: {
        id: order.product_id ?? orderItems[0].product_id,
        name: order.product_name_snapshot ?? orderItems[0].product_name_snapshot ?? "Unknown product",
        duration_type: "months",
        duration_value: 1,
        sell_price_vnd: order.total_amount_vnd,
        buy_price_vnd: 0,
      },
    };
  }

  const orderItem = orderItems[0];
  const productId = orderItem.product_id ?? order.product_id;

  if (!productId) {
    return null;
  }

  const [{ data: customer, error: customerError }, { data: product, error: productError }] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select("id, full_name")
      .eq("id", order.customer_id)
      .eq("account_id", accountId)
      .maybeSingle(),
    supabaseAdmin
      .from("products")
      .select("id, name, duration_type, duration_value, sell_price_vnd, buy_price_vnd")
      .eq("id", productId)
      .eq("account_id", accountId)
      .maybeSingle(),
  ]);

  if (customerError) {
    throw customerError;
  }
  if (productError) {
    throw productError;
  }

  if (!product) {
    return null;
  }

  return {
    order,
    orderItem,
    customer,
    product,
  };
}

async function ensurePremiumServiceType(
  accountId: string,
  productName: string,
): Promise<PremiumServiceTypeRow> {
  const serviceName = deriveServiceName(productName);
  const slug = `legacy-svc-${slugify(serviceName)}`;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("premium_service_types")
    .select("*")
    .eq("account_id", accountId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("premium_service_types")
    .insert({
      account_id: accountId,
      name: serviceName,
      slug,
      category: "Legacy order sync",
      supports_connection_check: false,
      is_active: true,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw insertError ?? new Error("Failed to create premium service type");
  }

  return inserted;
}

async function ensurePremiumPackage(
  accountId: string,
  serviceTypeId: string,
  product: Pick<ProductRow, "name" | "sell_price_vnd">,
  billingCycle: PremiumBillingCycle,
  totalSlots: number,
): Promise<PremiumPackageRow> {
  const slug = `legacy-pkg-${slugify(product.name)}`;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("premium_packages")
    .select("*")
    .eq("account_id", accountId)
    .eq("service_type_id", serviceTypeId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const basePayload = {
    name: product.name,
    default_price: Number(product.sell_price_vnd ?? 0),
    total_slots: normalizePackageSlots(totalSlots),
    billing_cycles: [billingCycle],
    allow_flexible_renewal_pricing: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("premium_packages")
      .update(basePayload)
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError || !updated) {
      throw updateError ?? new Error("Failed to update premium package");
    }

    return updated;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("premium_packages")
    .insert({
      account_id: accountId,
      service_type_id: serviceTypeId,
      slug,
      ...basePayload,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw insertError ?? new Error("Failed to create premium package");
  }

  return inserted;
}

async function resolveSourceAccount(
  accountId: string,
  context: OrderSyncContext,
): Promise<Pick<
  SourceAccountRow,
  "id" | "email" | "max_slots" | "used_slots" | "expires_at" | "status" | "product_ids" | "notes"
> | null> {
  const assignedSourceAccountId = context.orderItem.assigned_source_account_id;

  if (assignedSourceAccountId) {
    const { data, error } = await supabaseAdmin
      .from("source_accounts")
      .select("id, email, max_slots, used_slots, expires_at, status, product_ids, notes")
      .eq("account_id", accountId)
      .eq("id", assignedSourceAccountId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  }

  const { data: candidates, error } = await supabaseAdmin
    .from("source_accounts")
    .select("id, email, max_slots, used_slots, expires_at, status, product_ids, notes")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .overlaps("product_ids", [context.product.id]);

  if (error) {
    throw error;
  }

  const viableCandidates = (candidates ?? []).filter((candidate) =>
    (candidate.product_ids ?? []).includes(context.product.id),
  );

  if (viableCandidates.length === 0) {
    return null;
  }

  const orderUrls = [...extractUrls(context.order.sales_note), ...extractUrls(context.order.contact_snapshot)];
  if (orderUrls.length > 0) {
    const matchedByUrl = viableCandidates.filter((candidate) =>
      getSourceCredentialUrls(candidate).some((url) => orderUrls.includes(url)),
    );

    if (matchedByUrl.length === 1) {
      return matchedByUrl[0];
    }
  }

  if (viableCandidates.length === 1) {
    return viableCandidates[0];
  }

  return null;
}

async function findExistingSubscription(
  accountId: string,
  orderId: string,
): Promise<CustomerPremiumSubscriptionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("customer_premium_subscriptions")
    .select("*")
    .eq("account_id", accountId)
    .eq("order_id", orderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

async function getPremiumAccountById(accountId: string, premiumAccountId: string) {
  const { data, error } = await supabaseAdmin
    .from("premium_accounts")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", premiumAccountId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findPremiumAccountByIdentity(
  accountId: string,
  serviceTypeId: string,
  primaryEmail: string,
) {
  const { data, error } = await supabaseAdmin
    .from("premium_accounts")
    .select("*")
    .eq("account_id", accountId)
    .eq("service_type_id", serviceTypeId)
    .eq("primary_email", primaryEmail)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertPremiumAccount(args: {
  accountId: string;
  order: OrderSyncContext["order"];
  serviceTypeId: string;
  packageId: string;
  sourceAccount: Pick<
    SourceAccountRow,
    "id" | "email" | "max_slots" | "used_slots" | "expires_at" | "status" | "notes"
  > | null;
  existingSubscription: CustomerPremiumSubscriptionRow | null;
  totalSlots: number;
}) {
  const placeholderEmail = `order+${args.order.id}@orders.managerorder.local`;
  const primaryEmail = args.sourceAccount?.email?.trim() || placeholderEmail;
  const placeholderAccount = !args.sourceAccount?.id;
  const matchedByIdentity = await findPremiumAccountByIdentity(args.accountId, args.serviceTypeId, primaryEmail);
  const currentLinkedAccount = args.existingSubscription?.premium_account_id
    ? await getPremiumAccountById(args.accountId, args.existingSubscription.premium_account_id)
    : null;

  const targetAccount = matchedByIdentity ?? currentLinkedAccount ?? null;
  const derivedStatus = getOrderDerivedStatus(args.order);
  const passwordSeed =
    getSourcePassword(args.sourceAccount ?? { notes: null }) ??
    `managed-order-sync:${args.order.id}`;
  const now = new Date().toISOString();

  const payload = {
    account_id: args.accountId,
    service_type_id: args.serviceTypeId,
    package_id: args.packageId,
    primary_email: primaryEmail,
    primary_password_encrypted: encryptPremiumPassword(passwordSeed),
    total_slots: Math.max(1, Number(args.sourceAccount?.max_slots ?? args.totalSlots)),
    used_slots: Math.max(0, Number(args.sourceAccount?.used_slots ?? args.order.quantity ?? 1)),
    subscription_start_date: targetAccount?.subscription_start_date ?? args.order.created_at,
    subscription_expiry_date: args.sourceAccount?.expires_at ?? args.order.expires_at,
    status: derivedStatus.premiumAccountStatus,
    connection_status: args.sourceAccount?.status === "active" ? "working" : "manual_check_needed",
    purchase_invoice_url: args.order.proof_image_urls?.[0] ?? null,
    notes: buildPremiumAccountNotes({
      order: args.order,
      sourceAccountId: args.sourceAccount?.id ?? null,
      placeholderAccount,
    }),
    updated_at: now,
  } satisfies Database["public"]["Tables"]["premium_accounts"]["Update"];

  if (targetAccount) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("premium_accounts")
      .update(payload)
      .eq("id", targetAccount.id)
      .select()
      .single();

    if (updateError || !updated) {
      throw updateError ?? new Error("Failed to update premium account");
    }

    return {
      premiumAccount: updated,
      placeholderAccount,
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("premium_accounts")
    .insert({
      ...payload,
      account_id: args.accountId,
      service_type_id: args.serviceTypeId,
      package_id: args.packageId,
      primary_email: primaryEmail,
      primary_password_encrypted: encryptPremiumPassword(passwordSeed),
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw insertError ?? new Error("Failed to create premium account");
  }

  return {
    premiumAccount: inserted,
    placeholderAccount,
  };
}

async function upsertSubscription(args: {
  context: OrderSyncContext;
  premiumAccountId: string;
  packageId: string;
  serviceTypeId: string;
  billingCycle: PremiumBillingCycle;
  existingSubscription: CustomerPremiumSubscriptionRow | null;
}) {
  const derivedStatus = getOrderDerivedStatus(args.context.order);
  const cycleMonths = getCycleMonths(args.billingCycle);
  const basePayload = {
    premium_account_id: args.premiumAccountId,
    service_type_id: args.serviceTypeId,
    package_id: args.packageId,
    billing_cycle: args.billingCycle,
    cycle_months: cycleMonths,
    start_date: args.existingSubscription?.start_date ?? args.context.order.created_at,
    expiry_date: args.context.order.expires_at,
    original_price: Number(args.context.order.total_amount_vnd ?? 0),
    discount: 0,
    final_price: Number(args.context.order.total_amount_vnd ?? 0),
    status: derivedStatus.subscriptionStatus,
    notes: `Synced from order ${args.context.order.order_code ?? args.context.order.id}`,
    updated_at: new Date().toISOString(),
  } satisfies Database["public"]["Tables"]["customer_premium_subscriptions"]["Update"];

  if (args.existingSubscription) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("customer_premium_subscriptions")
      .update(basePayload)
      .eq("id", args.existingSubscription.id)
      .select()
      .single();

    if (updateError || !updated) {
      throw updateError ?? new Error("Failed to update premium subscription");
    }

    return {
      row: updated,
      created: false,
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("customer_premium_subscriptions")
    .insert({
      account_id: args.context.order.account_id,
      customer_id: args.context.order.customer_id,
      order_id: args.context.order.id,
      premium_account_id: args.premiumAccountId,
      premium_account_user_id: null,
      service_type_id: args.serviceTypeId,
      package_id: args.packageId,
      billing_cycle: args.billingCycle,
      cycle_months: cycleMonths,
      start_date: args.context.order.created_at,
      expiry_date: args.context.order.expires_at,
      original_price: Number(args.context.order.total_amount_vnd ?? 0),
      discount: 0,
      final_price: Number(args.context.order.total_amount_vnd ?? 0),
      renewal_status: "none",
      status: derivedStatus.subscriptionStatus,
      notes: `Synced from order ${args.context.order.order_code ?? args.context.order.id}`,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw insertError ?? new Error("Failed to create premium subscription");
  }

  return {
    row: inserted,
    created: true,
  };
}

export async function syncOrderToPremium(
  accountId: string,
  orderId: string,
  options?: { syncedBy?: string | null },
): Promise<SyncOrderToPremiumResult> {
  const context = await loadOrderContext(accountId, orderId);

  if (!context) {
    return {
      orderId,
      orderCode: null,
      subscriptionId: null,
      premiumAccountId: null,
      status: "skipped",
      reason: "ORDER_NOT_FOUND_OR_INVALID",
      sourceAccountId: null,
      placeholderAccount: true,
    };
  }

  if (context.orderItem.product_id !== context.product.id || context.order.quantity !== context.orderItem.quantity) {
    return {
      orderId,
      orderCode: context.order.order_code ?? null,
      subscriptionId: null,
      premiumAccountId: null,
      status: "skipped",
      reason: "MULTI_ITEM_OR_UNSUPPORTED_ORDER",
      sourceAccountId: null,
      placeholderAccount: true,
    };
  }

  const existingSubscription = await findExistingSubscription(accountId, orderId);
  const sourceAccount = await resolveSourceAccount(accountId, context);
  const billingCycle = resolveBillingCycle(context.product.duration_type, context.product.duration_value);
  const serviceType = await ensurePremiumServiceType(accountId, context.product.name);
  const premiumPackage = await ensurePremiumPackage(
    accountId,
    serviceType.id,
    context.product,
    billingCycle,
    Number(sourceAccount?.max_slots ?? context.order.quantity ?? 1),
  );
  const { premiumAccount, placeholderAccount } = await upsertPremiumAccount({
    accountId,
    order: context.order,
    serviceTypeId: serviceType.id,
    packageId: premiumPackage.id,
    sourceAccount,
    existingSubscription,
    totalSlots: Number(context.order.quantity ?? 1),
  });
  const subscription = await upsertSubscription({
    context,
    premiumAccountId: premiumAccount.id,
    packageId: premiumPackage.id,
    serviceTypeId: serviceType.id,
    billingCycle,
    existingSubscription,
  });

  await createActivityLog({
    account_id: accountId,
    action_type: subscription.created
      ? "PREMIUM_SUBSCRIPTION_SYNC_CREATED"
      : "PREMIUM_SUBSCRIPTION_SYNC_UPDATED",
    customer_id: context.order.customer_id,
    order_id: context.order.id,
    created_by: options?.syncedBy ?? null,
    details: {
      premium_account_id: premiumAccount.id,
      premium_subscription_id: subscription.row.id,
      order_code: context.order.order_code,
      service_name: serviceType.name,
      package_name: premiumPackage.name,
      source_account_id: sourceAccount?.id ?? null,
      placeholder_account: placeholderAccount,
    },
  });

  return {
    orderId: context.order.id,
    orderCode: context.order.order_code ?? null,
    subscriptionId: subscription.row.id,
    premiumAccountId: premiumAccount.id,
    status: subscription.created ? "created" : "updated",
    sourceAccountId: sourceAccount?.id ?? null,
    placeholderAccount,
  };
}

export async function syncOrdersToPremium(accountId: string): Promise<SyncPremiumOrdersResult> {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_code")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .in("status", ["paid", "active", "provisioning", "expired"])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const results: SyncOrderToPremiumResult[] = [];
  const errors: SyncPremiumOrdersResult["errors"] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const order of orders ?? []) {
    try {
      const result = await syncOrderToPremium(accountId, order.id);
      results.push(result);
      if (result.status === "created") {
        created += 1;
      } else if (result.status === "updated") {
        updated += 1;
      } else {
        skipped += 1;
      }
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : String(syncError);
      errors.push({
        orderId: order.id,
        orderCode: order.order_code ?? null,
        message,
      });
    }
  }

  return {
    total: (orders ?? []).length,
    created,
    updated,
    skipped,
    errors,
    results,
  };
}
