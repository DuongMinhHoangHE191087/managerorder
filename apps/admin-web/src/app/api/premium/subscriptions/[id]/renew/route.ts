// ============================================
// PREMIUM SUBSCRIPTIONS API - RENEWAL REQUEST
// ============================================
// PUT /api/premium/subscriptions/[id]/renew - Create renewal request
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  updatedResponse,
  notFoundResponse,
  badRequestResponse,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import { createRenewalRequest } from '@/lib/utils/subscriptions-helpers';
import { ensurePremiumSubscriptionRenewalAllowed } from '@/lib/domain/sales-workflow-guards';
import { getCycleMonths, isPremiumBillingCycle } from "@/lib/domain/premium-renewal-finance";

interface RenewalRequestBody {
  renewal_price?: number;
  new_billing_cycle?: string;
  cost_price?: number;
  collected_amount?: number;
  notes?: string;
  product_id?: string;
}

const RENEWAL_DETAIL_SELECT =
  "id, status, account_id, original_subscription_id, renewal_price, total_price, new_billing_cycle, new_cycle_months, new_product_id, new_product_name_snapshot, new_product_duration_months, new_product_sell_price_vnd, new_product_buy_price_vnd, cost_price, collected_amount, profit_amount, notes";

const LEGACY_RENEWAL_DETAIL_SELECT =
  "id, status, account_id, original_subscription_id, renewal_price, total_price, new_billing_cycle, new_cycle_months, cost_price, collected_amount, profit_amount, notes";

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

// ============================================
// PUT - Create renewal request for subscription
// ============================================

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as RenewalRequestBody;

    // Verify subscription exists and belongs to user
    const { data: subscription, error: findError } = await supabase
      .from('customer_premium_subscriptions')
      .select('id, customer_id, premium_account_id, status, renewal_status, expiry_date, billing_cycle, cycle_months, final_price, original_price')
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (findError || !subscription) {
      return notFoundResponse('Subscription');
    }

    ensurePremiumSubscriptionRenewalAllowed(subscription);

    if (body.renewal_price !== undefined && Number(body.renewal_price) <= 0) {
      return badRequestResponse('renewal_price must be greater than 0');
    }
    if (body.cost_price !== undefined && Number(body.cost_price) < 0) {
      return badRequestResponse('cost_price must be greater than or equal to 0');
    }
    if (body.collected_amount !== undefined && Number(body.collected_amount) < 0) {
      return badRequestResponse('collected_amount must be greater than or equal to 0');
    }
    if (body.new_billing_cycle !== undefined && !isPremiumBillingCycle(body.new_billing_cycle)) {
      return badRequestResponse('new_billing_cycle must be a valid premium billing cycle');
    }

    // Create renewal request
    const renewalData = await createRenewalRequest(
      accountId,
      id,
      subscription.customer_id,
      {
        renewalPrice: body.renewal_price,
        newBillingCycle: body.new_billing_cycle,
        costPrice: body.cost_price,
        collectedAmount: body.collected_amount,
        notes: body.notes,
        productId: body.product_id,
      },
    );

    // Get full renewal details
    let { data: fullRenewal, error: renewalError } = await supabase
      .from('subscription_renewals')
      .select(RENEWAL_DETAIL_SELECT)
      .eq('id', (renewalData as { id: string } | null)?.id ?? id)
      .single();

    if (renewalError && isMissingRenewalProductSnapshotColumn(renewalError)) {
      const legacyResult = await supabase
        .from('subscription_renewals')
        .select(LEGACY_RENEWAL_DETAIL_SELECT)
        .eq('id', (renewalData as { id: string } | null)?.id ?? id)
        .single();
      fullRenewal = legacyResult.data
        ? {
            ...legacyResult.data,
            new_product_id: null,
            new_product_name_snapshot: null,
            new_product_duration_months: null,
            new_product_sell_price_vnd: null,
            new_product_buy_price_vnd: null,
          }
        : null;
      renewalError = legacyResult.error;
    }

    if (renewalError || !fullRenewal) {
      throw renewalError ?? new Error('Failed to load renewal');
    }

    const { data: renewedSubscription, error: subscriptionError } = await supabase
      .from('customer_premium_subscriptions')
      .select('id, billing_cycle, original_price, final_price, start_date, expiry_date')
      .eq('id', fullRenewal.original_subscription_id)
      .single();

    if (subscriptionError || !renewedSubscription) {
      throw subscriptionError ?? new Error('Failed to load subscription');
    }

    const normalizedRenewal = {
      ...fullRenewal,
      customer_premium_subscriptions: renewedSubscription,
      finance_snapshot: {
        cycle_months: Number(
          fullRenewal.new_cycle_months
          ?? getCycleMonths(
            fullRenewal.new_billing_cycle
              ?? body.new_billing_cycle
              ?? String(subscription.billing_cycle ?? '1month'),
          )
        ),
        renewal_price: Number(fullRenewal.renewal_price ?? body.renewal_price ?? subscription.final_price ?? subscription.original_price ?? 0),
        cost_price: Number(fullRenewal.cost_price ?? body.cost_price ?? 0),
        collected_amount: Number(fullRenewal.collected_amount ?? body.collected_amount ?? fullRenewal.renewal_price ?? body.renewal_price ?? subscription.final_price ?? subscription.original_price ?? 0),
        profit_amount: Number(fullRenewal.profit_amount ?? 0),
      },
    };

    return updatedResponse(
      normalizedRenewal as unknown as Record<string, unknown>,
      'Renewal request created successfully'
    );
  })
);
