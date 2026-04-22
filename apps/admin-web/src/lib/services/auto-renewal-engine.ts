import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";
import { getDaysRemaining, isExpiringSoon } from "@/lib/utils/premium-accounts-helpers";
import { ensurePremiumSubscriptionRenewalAllowed } from "@/lib/domain/sales-workflow-guards";
import { createRenewalRequest } from "@/lib/utils/subscriptions-helpers";

type SubscriptionCandidate = {
  id: string;
  account_id: string;
  customer_id: string;
  expiry_date: string;
  status: string;
  renewal_status: string | null;
  original_price: number | null;
  final_price: number | null;
  billing_cycle: string;
};

type CustomerRiskRow = {
  id: string;
  full_name: string;
  debt_amount_vnd: number | null;
  debt_overdue_days: number | null;
  reliability_score: number | null;
  segment: string | null;
};

export interface AutoRenewalEngineOptions {
  accountId?: string;
  daysThreshold?: number;
  maxCreated?: number;
  minReliabilityScore?: number;
}

export interface AutoRenewalEngineOutcome {
  scannedCount: number;
  eligibleCount: number;
  createdCount: number;
  skippedCount: number;
  skippedReasons: Record<string, number>;
  created: Array<{
    accountId: string;
    subscriptionId: string;
    renewalId: string;
    customerId: string;
    customerName: string;
    daysRemaining: number;
  }>;
}

const DEFAULT_DAYS_THRESHOLD = 7;
const DEFAULT_MAX_CREATED = 20;
const DEFAULT_MIN_RELIABILITY_SCORE = 70;

function normalizeLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function bumpReason(outcome: AutoRenewalEngineOutcome, reason: string) {
  outcome.skippedReasons[reason] = (outcome.skippedReasons[reason] ?? 0) + 1;
  outcome.skippedCount += 1;
}

export async function runAutoRenewalEngine(options: AutoRenewalEngineOptions = {}): Promise<AutoRenewalEngineOutcome> {
  const accountId = options.accountId?.trim() || null;
  const daysThreshold = normalizeLimit(options.daysThreshold, DEFAULT_DAYS_THRESHOLD, 1, 30);
  const maxCreated = normalizeLimit(options.maxCreated, DEFAULT_MAX_CREATED, 1, 100);
  const minReliabilityScore = normalizeLimit(options.minReliabilityScore, DEFAULT_MIN_RELIABILITY_SCORE, 0, 100);

  const report: AutoRenewalEngineOutcome = {
    scannedCount: 0,
    eligibleCount: 0,
    createdCount: 0,
    skippedCount: 0,
    skippedReasons: {},
    created: [],
  };

  let subscriptionsQuery = supabaseAdmin
    .from("customer_premium_subscriptions")
    .select(
      "id, account_id, customer_id, expiry_date, status, renewal_status, original_price, final_price, billing_cycle",
    )
    .eq("status", "active")
    .eq("renewal_status", "none")
    .is("deleted_at", null);

  if (accountId) {
    subscriptionsQuery = subscriptionsQuery.eq("account_id", accountId);
  }

  const { data: subscriptions, error } = await subscriptionsQuery.order("expiry_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const expiringSubscriptions = ((subscriptions ?? []) as SubscriptionCandidate[])
    .filter((subscription) => isExpiringSoon(subscription.expiry_date, daysThreshold))
    .sort((left, right) => getDaysRemaining(left.expiry_date) - getDaysRemaining(right.expiry_date));

  report.scannedCount = expiringSubscriptions.length;

  const subscriptionsByAccount = new Map<string, SubscriptionCandidate[]>();
  for (const subscription of expiringSubscriptions) {
    const list = subscriptionsByAccount.get(subscription.account_id) ?? [];
    list.push(subscription);
    subscriptionsByAccount.set(subscription.account_id, list);
  }

  for (const [accountId, accountSubscriptions] of subscriptionsByAccount.entries()) {
    if (report.createdCount >= maxCreated) {
      break;
    }

    const customerIds = [...new Set(accountSubscriptions.map((subscription) => subscription.customer_id))];
    const customers = await loadRowsByIds<CustomerRiskRow>(
      supabaseAdmin,
      "customers",
      accountId,
      customerIds,
      "id, full_name, debt_amount_vnd, debt_overdue_days, reliability_score, segment",
    );

    for (const subscription of accountSubscriptions) {
      if (report.createdCount >= maxCreated) {
        break;
      }

      const customer = customers.get(subscription.customer_id) ?? null;
      const daysRemaining = getDaysRemaining(subscription.expiry_date);

      if (!customer) {
        bumpReason(report, "customer_missing");
        continue;
      }

      const debtAmount = Number(customer.debt_amount_vnd ?? 0);
      const overdueDays = Number(customer.debt_overdue_days ?? 0);
      const reliabilityScore = Number(customer.reliability_score ?? 100);

      if (debtAmount > 0) {
        bumpReason(report, "customer_has_debt");
        continue;
      }

      if (overdueDays > 0) {
        bumpReason(report, "customer_overdue");
        continue;
      }

      if (reliabilityScore < minReliabilityScore) {
        bumpReason(report, "low_reliability");
        continue;
      }

      try {
        ensurePremiumSubscriptionRenewalAllowed({
          status: subscription.status,
          renewal_status: subscription.renewal_status,
        });
      } catch (error) {
        bumpReason(report, error instanceof Error ? error.message : "renewal_not_allowed");
        continue;
      }

      try {
        const renewal = await createRenewalRequest(accountId, subscription.id, subscription.customer_id);
        report.created.push({
          accountId,
          subscriptionId: subscription.id,
          renewalId: (renewal as { id?: string } | null)?.id ?? subscription.id,
          customerId: subscription.customer_id,
          customerName: customer.full_name,
          daysRemaining,
        });
        report.createdCount += 1;
        report.eligibleCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "renewal_creation_failed";
        if (message.toLowerCase().includes("pending")) {
          bumpReason(report, "renewal_pending");
          continue;
        }

        throw error;
      }
    }
  }

  return report;
}
