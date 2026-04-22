// ============================================================
// SUBSCRIPTIONS REPOSITORY — Supabase
// ============================================================
// DB operations for customer_premium_subscriptions and
// subscription_renewals tables.
// Extracted from subscriptions-helpers.ts for SRP compliance.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';
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
  premium_account_id: string;
  package_id: string;
  service_type_id: string;
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
      'id, name, slug, total_slots, default_price',
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
  customerId: string
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

  const { data, error } = await supabaseAdmin
    .from('subscription_renewals')
    .insert([
      {
        account_id: accountId,
        original_subscription_id: subscriptionId,
        customer_id: customerId,
        renewal_requested_date: new Date().toISOString(),
        status: 'pending',
        refund_calculated: false,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  await supabaseAdmin
    .from('customer_premium_subscriptions')
    .update({
      renewal_status: 'pending',
      renewal_asked_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  return data;
}

/**
 * Confirm renewal request
 */
export async function confirmRenewalRequest(
  renewalId: string,
  accountId: string,
  renewalPrice?: number,
  newBillingCycle?: string
) {
  const renewal = await getRenewalRequest(renewalId, accountId);

  if (!renewal) {
    throw new Error('Renewal request not found');
  }

  const totalPrice = renewalPrice ?? renewal.original_price ?? 0;

  const { data: updatedRenewal, error: renewalError } = await supabaseAdmin
    .from('subscription_renewals')
    .update({
      status: 'confirmed',
      renewal_confirmed_date: new Date().toISOString(),
      renewal_price: renewalPrice,
      total_price: totalPrice,
      new_billing_cycle: newBillingCycle,
    })
    .eq('id', renewalId)
    .select()
    .single();

  if (renewalError) throw renewalError;

  const originalSub = renewal.customer_premium_subscriptions;
  if (originalSub) {
    await supabaseAdmin
      .from('customer_premium_subscriptions')
      .update({
        renewal_status: 'confirmed',
        renewal_confirmed_at: new Date().toISOString(),
      })
      .eq('id', originalSub.id);
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
    await supabaseAdmin
      .from('customer_premium_subscriptions')
      .update({
        renewal_status: 'denied',
        renewal_denied_at: new Date().toISOString(),
        renewal_denied_reason: reason,
      })
      .eq('id', originalSub.id);
  }

  return updatedRenewal;
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
