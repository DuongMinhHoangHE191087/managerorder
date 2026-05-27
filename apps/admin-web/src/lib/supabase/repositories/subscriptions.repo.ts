// ============================================================
// SUBSCRIPTIONS REPOSITORY — Supabase
// ============================================================
// DB operations for customer_premium_subscriptions and
// subscription_renewals tables.
// Extracted from subscriptions-helpers.ts for SRP compliance.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';
import {
  billingCycleFromMonths,
  calculateRenewalFinanceSnapshot,
  calculateExpiryDate,
  durationToMonths,
  getCycleMonths,
  normalizeRenewalCurrency,
  resolvePremiumBillingCycle,
  scaleAmountByCycle,
} from "@/lib/domain/premium-renewal-finance";
import {
  isExpiringSoon,
  getDaysRemaining,
} from '@/lib/utils/premium-accounts-helpers';

// ─── Types ────────────────────────────────────────────────────

export interface RenewalDetail {
  id: string;
  account_id: string;
  original_subscription_id: string;
  customer_id: string;
  status: string;
  original_price: number | null;
  renewal_price: number | null;
  total_price: number | null;
  new_billing_cycle: string | null;
  new_cycle_months: number | null;
  cost_price: number | null;
  collected_amount: number | null;
  profit_amount: number | null;
  new_product_id: string | null;
  new_product_name_snapshot: string | null;
  new_product_duration_months: number | null;
  new_product_sell_price_vnd: number | null;
  new_product_buy_price_vnd: number | null;
  notes: string | null;
  refund_calculated: boolean;
  refund_amount: number | null;
  customer_premium_subscriptions: {
    id: string;
    customer_id: string;
    premium_account_id: string;
    start_date: string;
    expiry_date: string;
    original_price: number;
    final_price: number;
    billing_cycle: string;
  } | null;
}

type PremiumAccountRow = {
  id: string;
  primary_email: string;
  total_slots: number;
  used_slots: number;
  status: string | null;
};

type PremiumPackageRow = {
  id: string;
  name: string;
  slug: string;
  total_slots: number;
  default_price: number | null;
  renewal_price_factor: number | null;
};

type PremiumServiceTypeRow = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  supports_connection_check: boolean;
};

type SubscriptionHydrationRow = {
  id: string;
  customer_id: string;
  premium_account_id: string;
  package_id: string;
  service_type_id: string;
  billing_cycle: string;
  cycle_months: number;
  original_price: number;
  final_price: number;
  premium_accounts: PremiumAccountRow | null;
  premium_packages: PremiumPackageRow | null;
  premium_service_types: PremiumServiceTypeRow | null;
};

type RenewalSubscriptionRow = {
  id: string;
  customer_id: string;
  premium_account_id: string;
  start_date: string;
  expiry_date: string;
  original_price: number;
  final_price: number;
  billing_cycle: string;
};

type RenewalSubscriptionSnapshotRow = RenewalSubscriptionRow & {
  cycle_months: number;
  status: string;
  renewal_status: string;
  renewal_asked_at: string | null;
  renewal_confirmed_at: string | null;
  renewal_denied_at: string | null;
  renewal_denied_reason: string | null;
};

type RenewalProductSnapshot = {
  productId: string | null;
  productName: string | null;
  durationMonths: number | null;
  sellPriceVnd: number | null;
  buyPriceVnd: number | null;
};

function isMissingRenewalProductSnapshotColumn(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error ?? "");

  return message.includes("new_product_") && (
    message.includes("column")
    || message.includes("schema cache")
    || message.includes("Could not find")
  );
}

function omitRenewalProductSnapshotColumns<T extends Record<string, unknown>>(payload: T) {
  const {
    new_product_id: _newProductId,
    new_product_name_snapshot: _newProductNameSnapshot,
    new_product_duration_months: _newProductDurationMonths,
    new_product_sell_price_vnd: _newProductSellPrice,
    new_product_buy_price_vnd: _newProductBuyPrice,
    ...legacyPayload
  } = payload;

  return legacyPayload;
}

async function loadRenewalProductSnapshot(
  accountId: string,
  productId?: string | null,
): Promise<RenewalProductSnapshot | null> {
  if (!productId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, duration_type, duration_value, sell_price_vnd, buy_price_vnd, is_active")
    .eq("id", productId)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Product not found");
  }

  if (data.is_active === false) {
    throw new Error("Product is inactive");
  }

  return {
    productId: data.id,
    productName: data.name,
    durationMonths: durationToMonths(data.duration_type, data.duration_value),
    sellPriceVnd: Number(data.sell_price_vnd ?? 0),
    buyPriceVnd: Number(data.buy_price_vnd ?? 0),
  };
}

async function hydrateSubscriptionRows<T extends SubscriptionHydrationRow>(
  rows: T[],
  accountId: string,
): Promise<T[]> {
  if (rows.length === 0) {
    return rows;
  }

  const premiumAccountIds = [...new Set(rows.map((row) => row.premium_account_id).filter(Boolean))];
  const packageIds = [...new Set(rows.map((row) => row.package_id).filter(Boolean))];
  const serviceTypeIds = [...new Set(rows.map((row) => row.service_type_id).filter(Boolean))];

  const [premiumAccounts, premiumPackages, premiumServiceTypes] = await Promise.all([
    loadRowsByIds<PremiumAccountRow>(
      supabaseAdmin,
      'premium_accounts',
      accountId,
      premiumAccountIds,
      'id, primary_email, total_slots, used_slots, status',
    ),
    loadRowsByIds<PremiumPackageRow>(
      supabaseAdmin,
      'premium_packages',
      accountId,
      packageIds,
      'id, name, slug, total_slots, default_price, renewal_price_factor',
    ),
    loadRowsByIds<PremiumServiceTypeRow>(
      supabaseAdmin,
      'premium_service_types',
      accountId,
      serviceTypeIds,
      'id, name, slug, category, supports_connection_check',
    ),
  ]);

  return rows.map((row) => ({
    ...row,
    premium_accounts: premiumAccounts.get(row.premium_account_id) ?? null,
    premium_packages: premiumPackages.get(row.package_id) ?? null,
    premium_service_types: premiumServiceTypes.get(row.service_type_id) ?? null,
  }));
}

// ─── Subscription Queries ─────────────────────────────────────

/**
 * Get all active subscriptions
 */
export async function getActiveSubscriptions(
  accountId: string,
  limit = 20,
  offset = 0
) {
  const { data, error, count } = await supabaseAdmin
    .from('customer_premium_subscriptions')
    .select('*', { count: 'exact' })
    .eq('account_id', accountId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { data: await hydrateSubscriptionRows((data ?? []) as SubscriptionHydrationRow[], accountId), total: count };
}

/**
 * Get expiring subscriptions (within N days)
 */
export async function getExpiringSubscriptions(
  accountId: string,
  daysThreshold = 7,
  limit = 20,
  offset = 0
) {
  const { data: allSubscriptions, error: fetchError } = await supabaseAdmin
    .from('customer_premium_subscriptions')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (fetchError) throw fetchError;

  type SubWithExpiry = { expiry_date: string; days_remaining?: number; [key: string]: unknown };
  const allRows = (allSubscriptions as unknown as SubWithExpiry[]) ?? [];

  const expiringSubscriptions = allRows
    .filter((sub) => isExpiringSoon(sub.expiry_date, daysThreshold))
    .map((sub) => ({
      ...sub,
      days_remaining: getDaysRemaining(sub.expiry_date),
    }))
    .sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0))
    .slice(offset, offset + limit);

  const count = allRows.filter((sub) => isExpiringSoon(sub.expiry_date, daysThreshold)).length;

  return { data: await hydrateSubscriptionRows(expiringSubscriptions as unknown as SubscriptionHydrationRow[], accountId), total: count };
}

/**
 * Find subscription by ID
 */
export async function getSubscriptionById(
  subscriptionId: string,
  accountId: string
) {
  const { data, error } = await supabaseAdmin
    .from('customer_premium_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  const hydrated = await hydrateSubscriptionRows([data as SubscriptionHydrationRow], accountId);
  return hydrated[0] ?? null;
}

// ─── Renewal Operations ───────────────────────────────────────

/**
 * Get renewal request details
 */
export async function getRenewalRequest(renewalId: string, accountId: string): Promise<RenewalDetail | null> {
  const { data, error } = await supabaseAdmin
    .from('subscription_renewals')
    .select('*')
    .eq('id', renewalId)
    .eq('account_id', accountId)
    .single();

  if (error) throw error;
  if (!data) return null;

  const subscriptions = await loadRowsByIds<RenewalSubscriptionRow>(
    supabaseAdmin,
    'customer_premium_subscriptions',
    accountId,
    data.original_subscription_id ? [data.original_subscription_id] : [],
    'id, customer_id, premium_account_id, start_date, expiry_date, original_price, final_price, billing_cycle',
  );

  return {
    ...data,
    customer_premium_subscriptions: subscriptions.get(data.original_subscription_id) ?? null,
  } as RenewalDetail;
}

/**
 * Create renewal request
 */
export async function createRenewalRequest(
  accountId: string,
  subscriptionId: string,
  customerId: string,
  options?: {
    renewalPrice?: number | null;
    newBillingCycle?: string | null;
    costPrice?: number | null;
    collectedAmount?: number | null;
    notes?: string | null;
    productId?: string | null;
  },
) {
  const sub = await getSubscriptionById(subscriptionId, accountId);

  if (!sub) {
    throw new Error('Subscription not found');
  }

  const { data: existingRenewal } = await supabaseAdmin
    .from('subscription_renewals')
    .select('id')
    .eq('original_subscription_id', subscriptionId)
    .eq('status', 'pending')
    .single();

  if (existingRenewal) {
    throw new Error('Renewal already pending for this subscription');
  }

  const productSnapshot = await loadRenewalProductSnapshot(accountId, options?.productId);
  const currentBillingCycle = resolvePremiumBillingCycle(sub.billing_cycle ?? null, "1month");
  const normalizedBillingCycle = productSnapshot?.durationMonths
    ? billingCycleFromMonths(productSnapshot.durationMonths)
    : resolvePremiumBillingCycle(options?.newBillingCycle ?? null, currentBillingCycle);
  const normalizedRenewalPrice = normalizeRenewalCurrency(
    options?.renewalPrice ?? productSnapshot?.sellPriceVnd ?? sub.final_price ?? sub.original_price ?? 0,
  );
  const packageId = String((sub as { package_id?: string | null }).package_id ?? "");
  const packageRows = packageId
    ? await loadRowsByIds<{
      id: string;
      default_price: number | null;
      renewal_price_factor: number | null;
    }>(
      supabaseAdmin,
      "premium_packages",
      accountId,
      [packageId],
      "id, default_price, renewal_price_factor",
    )
    : new Map<string, { id: string; default_price: number | null; renewal_price_factor: number | null }>();
  const packageDefaultPrice = Number(packageRows.get(packageId)?.default_price ?? 0);
  const normalizedCollectedAmount =
    options?.collectedAmount === undefined || options?.collectedAmount === null
      ? normalizedRenewalPrice
      : normalizeRenewalCurrency(options.collectedAmount, normalizedRenewalPrice);
  const normalizedCostPrice =
    options?.costPrice === undefined || options?.costPrice === null
      ? productSnapshot?.buyPriceVnd ?? scaleAmountByCycle(packageDefaultPrice, getCycleMonths(currentBillingCycle), normalizedBillingCycle)
      : normalizeRenewalCurrency(options.costPrice);
  const finance = calculateRenewalFinanceSnapshot({
    renewalPrice: normalizedRenewalPrice,
    collectedAmount: normalizedCollectedAmount,
    costPrice: normalizedCostPrice,
  });

  const renewalInsertPayload = {
    account_id: accountId,
    original_subscription_id: subscriptionId,
    customer_id: customerId,
    renewal_requested_date: new Date().toISOString(),
    status: 'pending',
    original_price: Number(sub.final_price ?? sub.original_price ?? 0),
    renewal_price: finance.renewalPrice,
    total_price: finance.renewalPrice,
    new_billing_cycle: normalizedBillingCycle,
    new_cycle_months: getCycleMonths(normalizedBillingCycle),
    new_product_id: productSnapshot?.productId ?? null,
    new_product_name_snapshot: productSnapshot?.productName ?? null,
    new_product_duration_months: productSnapshot?.durationMonths ?? null,
    new_product_sell_price_vnd: productSnapshot?.sellPriceVnd ?? null,
    new_product_buy_price_vnd: productSnapshot?.buyPriceVnd ?? null,
    cost_price: finance.costPrice,
    collected_amount: finance.collectedAmount,
    profit_amount: finance.profitAmount,
    notes: options?.notes?.trim() ? options.notes.trim() : null,
    refund_calculated: false,
  };

  let { data, error } = await supabaseAdmin
    .from('subscription_renewals')
    .insert([renewalInsertPayload])
    .select()
    .single();

  if (error && isMissingRenewalProductSnapshotColumn(error)) {
    const legacyResult = await supabaseAdmin
      .from('subscription_renewals')
      .insert([omitRenewalProductSnapshotColumns(renewalInsertPayload)])
      .select()
      .single();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) throw error;

  const { error: subscriptionUpdateError } = await supabaseAdmin
    .from('customer_premium_subscriptions')
    .update({
      renewal_status: 'pending',
      renewal_asked_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  if (subscriptionUpdateError) {
    const { error: rollbackError } = await supabaseAdmin
      .from('subscription_renewals')
      .delete()
      .eq('id', data.id);

    if (rollbackError) {
      throw new Error(
        `Failed to update subscription renewal state and rollback renewal insert: ${subscriptionUpdateError.message}; rollback failed: ${rollbackError.message}`,
      );
    }

    throw subscriptionUpdateError;
  }

  return data;
}

/**
 * Confirm renewal request
 */
export async function confirmRenewalRequest(
  renewalId: string,
  accountId: string,
  options?: {
    renewalPrice?: number | null;
    newBillingCycle?: string | null;
    costPrice?: number | null;
    collectedAmount?: number | null;
    notes?: string | null;
    productId?: string | null;
  },
) {
  const renewal = await getRenewalRequest(renewalId, accountId);

  if (!renewal) {
    throw new Error('Renewal request not found');
  }

  if (renewal.status !== 'pending') {
    throw new Error(`Cannot confirm a renewal that is already "${renewal.status}"`);
  }

  const { data: originalSub, error: subscriptionReadError } = await supabaseAdmin
    .from('customer_premium_subscriptions')
    .select(
      'id, expiry_date, billing_cycle, cycle_months, original_price, final_price, status, renewal_status, renewal_asked_at, renewal_confirmed_at, renewal_denied_at, renewal_denied_reason',
    )
    .eq('id', renewal.original_subscription_id)
    .single();

  if (subscriptionReadError || !originalSub) {
    throw subscriptionReadError ?? new Error('Original subscription not found');
  }

  const subscriptionSnapshot = originalSub as RenewalSubscriptionSnapshotRow;
  const productSnapshot = await loadRenewalProductSnapshot(accountId, options?.productId);
  const currentBillingCycle = resolvePremiumBillingCycle(subscriptionSnapshot.billing_cycle ?? null, "1month");

  const totalPrice = Number(options?.renewalPrice ?? productSnapshot?.sellPriceVnd ?? renewal.renewal_price ?? renewal.total_price ?? renewal.original_price ?? 0);
  const normalizedBillingCycle = productSnapshot?.durationMonths
    ? billingCycleFromMonths(productSnapshot.durationMonths)
    : resolvePremiumBillingCycle(
        options?.newBillingCycle ?? renewal.new_billing_cycle ?? renewal.customer_premium_subscriptions?.billing_cycle ?? null,
        currentBillingCycle,
      );
  const costPrice = Number(options?.costPrice ?? productSnapshot?.buyPriceVnd ?? renewal.cost_price ?? 0);
  const collectedAmount = Number(options?.collectedAmount ?? renewal.collected_amount ?? totalPrice);
  const finance = calculateRenewalFinanceSnapshot({
    renewalPrice: totalPrice,
    collectedAmount,
    costPrice,
  });

  const confirmedAt = new Date().toISOString();
  const nextExpiryDate = calculateExpiryDate(subscriptionSnapshot.expiry_date, normalizedBillingCycle);
  const nextCycleMonths = getCycleMonths(normalizedBillingCycle);

  const { error: subscriptionUpdateError } = await supabaseAdmin
    .from('customer_premium_subscriptions')
    .update({
      expiry_date: nextExpiryDate,
      billing_cycle: normalizedBillingCycle,
      cycle_months: nextCycleMonths,
      original_price: finance.renewalPrice,
      final_price: finance.renewalPrice,
      status: 'active',
      renewal_status: 'confirmed',
      renewal_confirmed_at: confirmedAt,
      renewal_denied_at: null,
      renewal_denied_reason: null,
      updated_at: confirmedAt,
    })
    .eq('id', subscriptionSnapshot.id);

  if (subscriptionUpdateError) {
    throw subscriptionUpdateError;
  }

  const renewalUpdatePayload = {
    status: 'confirmed',
    renewal_confirmed_date: confirmedAt,
    renewal_price: finance.renewalPrice,
    total_price: finance.renewalPrice,
    new_billing_cycle: normalizedBillingCycle,
    new_cycle_months: nextCycleMonths,
    new_product_id: productSnapshot?.productId ?? renewal.new_product_id ?? null,
    new_product_name_snapshot: productSnapshot?.productName ?? renewal.new_product_name_snapshot ?? null,
    new_product_duration_months: productSnapshot?.durationMonths ?? renewal.new_product_duration_months ?? null,
    new_product_sell_price_vnd: productSnapshot?.sellPriceVnd ?? renewal.new_product_sell_price_vnd ?? null,
    new_product_buy_price_vnd: productSnapshot?.buyPriceVnd ?? renewal.new_product_buy_price_vnd ?? null,
    cost_price: finance.costPrice,
    collected_amount: finance.collectedAmount,
    profit_amount: finance.profitAmount,
    notes: options?.notes?.trim() ? options.notes.trim() : renewal.notes,
    updated_at: confirmedAt,
  };

  let { data: updatedRenewal, error: renewalError } = await supabaseAdmin
    .from('subscription_renewals')
    .update(renewalUpdatePayload)
    .eq('id', renewalId)
    .select()
    .single();

  if (renewalError && isMissingRenewalProductSnapshotColumn(renewalError)) {
    const legacyResult = await supabaseAdmin
      .from('subscription_renewals')
      .update(omitRenewalProductSnapshotColumns(renewalUpdatePayload))
      .eq('id', renewalId)
      .select()
      .single();
    updatedRenewal = legacyResult.data;
    renewalError = legacyResult.error;
  }

  if (renewalError) {
    const { error: rollbackError } = await supabaseAdmin
      .from('customer_premium_subscriptions')
      .update({
        expiry_date: subscriptionSnapshot.expiry_date,
        billing_cycle: subscriptionSnapshot.billing_cycle,
        cycle_months: subscriptionSnapshot.cycle_months,
        original_price: subscriptionSnapshot.original_price,
        final_price: subscriptionSnapshot.final_price,
        status: subscriptionSnapshot.status,
        renewal_status: subscriptionSnapshot.renewal_status,
        renewal_asked_at: subscriptionSnapshot.renewal_asked_at,
        renewal_confirmed_at: subscriptionSnapshot.renewal_confirmed_at,
        renewal_denied_at: subscriptionSnapshot.renewal_denied_at,
        renewal_denied_reason: subscriptionSnapshot.renewal_denied_reason,
        updated_at: confirmedAt,
      })
      .eq('id', subscriptionSnapshot.id);

    if (rollbackError) {
      throw new Error(
        `Failed to confirm renewal and rollback subscription update: ${renewalError.message}; rollback failed: ${rollbackError.message}`,
      );
    }

    throw renewalError;
  }

  return updatedRenewal;
}

/**
 * Deny renewal request
 */
export async function denyRenewalRequest(
  renewalId: string,
  accountId: string,
  reason?: string
) {
  const renewal = await getRenewalRequest(renewalId, accountId);

  if (!renewal) {
    throw new Error('Renewal request not found');
  }

  if (renewal.status !== 'pending') {
    throw new Error(`Cannot deny a renewal that is already "${renewal.status}"`);
  }

  const { data: updatedRenewal, error: renewalError } = await supabaseAdmin
    .from('subscription_renewals')
    .update({
      status: 'denied',
      customer_response_date: new Date().toISOString(),
      customer_response: 'decline',
      decline_reason: reason,
    })
    .eq('id', renewalId)
    .select()
    .single();

  if (renewalError) throw renewalError;

  const originalSub = renewal.customer_premium_subscriptions;
  if (originalSub) {
    const { error: subscriptionUpdateError } = await supabaseAdmin
      .from('customer_premium_subscriptions')
      .update({
        renewal_status: 'denied',
        renewal_denied_at: new Date().toISOString(),
        renewal_denied_reason: reason,
      })
      .eq('id', originalSub.id);

    if (subscriptionUpdateError) {
      const { error: rollbackError } = await supabaseAdmin
        .from('subscription_renewals')
        .update({
          status: 'pending',
          customer_response_date: null,
          customer_response: null,
          decline_reason: null,
        })
        .eq('id', renewalId);

      if (rollbackError) {
        throw new Error(
          `Failed to deny renewal and rollback renewal status: ${subscriptionUpdateError.message}; rollback failed: ${rollbackError.message}`,
        );
      }

      throw subscriptionUpdateError;
    }
  }

  return updatedRenewal;
}

export async function markSubscriptionNotRenewing(
  accountId: string,
  subscriptionId: string,
  reason?: string | null,
) {
  const sub = await getSubscriptionById(subscriptionId, accountId);

  if (!sub) {
    throw new Error("Subscription not found");
  }

  const now = new Date().toISOString();
  const cleanReason = reason?.trim() || null;
  const { data: pendingRenewal, error: pendingError } = await supabaseAdmin
    .from("subscription_renewals")
    .select("id")
    .eq("account_id", accountId)
    .eq("original_subscription_id", subscriptionId)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingError) {
    throw pendingError;
  }

  const renewalMutation = {
    status: "not_renewing",
    customer_response: "decline",
    customer_response_date: now,
    decline_reason: cleanReason,
    notes: cleanReason,
    updated_at: now,
  };

  const renewalResult = pendingRenewal?.id
    ? await supabaseAdmin
        .from("subscription_renewals")
        .update(renewalMutation)
        .eq("id", pendingRenewal.id)
        .eq("account_id", accountId)
        .select()
        .single()
    : await supabaseAdmin
        .from("subscription_renewals")
        .insert([
          {
            account_id: accountId,
            original_subscription_id: subscriptionId,
            customer_id: String((sub as { customer_id: string }).customer_id),
            status: "not_renewing",
            renewal_requested_date: now,
            customer_response: "decline",
            customer_response_date: now,
            decline_reason: cleanReason,
            original_price: Number((sub as { final_price?: number; original_price?: number }).final_price ?? (sub as { original_price?: number }).original_price ?? 0),
            renewal_price: 0,
            total_price: 0,
            cost_price: 0,
            collected_amount: 0,
            profit_amount: 0,
            notes: cleanReason,
            refund_calculated: false,
          },
        ])
        .select()
        .single();

  if (renewalResult.error) {
    throw renewalResult.error;
  }

  const { error: subscriptionUpdateError } = await supabaseAdmin
    .from("customer_premium_subscriptions")
    .update({
      renewal_status: "not_renewing",
      renewal_denied_at: now,
      renewal_denied_reason: cleanReason,
      updated_at: now,
    })
    .eq("id", subscriptionId)
    .eq("account_id", accountId);

  if (subscriptionUpdateError) {
    throw subscriptionUpdateError;
  }

  return renewalResult.data;
}

/**
 * Calculate and persist refund for a renewal
 */
export async function persistRefund(
  renewalId: string,
  subscriptionId: string,
  refundAmount: number,
  method: string
) {
  await supabaseAdmin
    .from('subscription_renewals')
    .update({
      refund_calculated: true,
      refund_amount: refundAmount,
      refund_calculation_method: method,
      refund_approved_at: new Date().toISOString(),
    })
    .eq('id', renewalId);

  await supabaseAdmin
    .from('customer_premium_subscriptions')
    .update({
      refund_amount: refundAmount,
    })
    .eq('id', subscriptionId);
}
