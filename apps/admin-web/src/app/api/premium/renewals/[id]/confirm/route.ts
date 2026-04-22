// ============================================
// POST /api/premium/renewals/[id]/confirm
// Confirm a pending renewal request → extend subscription expiry
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
import {
  confirmRenewalRequest,
  calculateExpiryDate,
  getCycleMonths,
} from '@/lib/utils/subscriptions-helpers';

interface ConfirmBody {
  renewal_price?: number;
  new_billing_cycle?: '1month' | '3months' | '6months' | '1year';
}

type RenewalSubscriptionRow = {
  id: string;
  expiry_date: string;
  billing_cycle: string;
  status: string;
};

type RenewalWithSubscription = {
  status: string;
  customer_premium_subscriptions: RenewalSubscriptionRow | RenewalSubscriptionRow[] | null;
  [key: string]: unknown;
};

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = (await request.json()) as ConfirmBody;

    // Verify the renewal belongs to this account and is still pending
    const { data: renewal, error: findError } = await supabase
      .from('subscription_renewals')
      .select('id, status, account_id, original_subscription_id')
      .eq('id', id)
      .eq('account_id', accountId)
      .single();

    if (findError || !renewal) return notFoundResponse('Renewal request');

    const { data: subscription, error: subscriptionError } = await supabase
      .from('customer_premium_subscriptions')
      .select('id, expiry_date, billing_cycle, status')
      .eq('id', renewal.original_subscription_id)
      .single();

    if (subscriptionError || !subscription) return notFoundResponse('Renewal request');

    const normalizedRenewal = {
      ...renewal,
      customer_premium_subscriptions: subscription as RenewalSubscriptionRow,
    } as RenewalWithSubscription;

    if (normalizedRenewal.status !== 'pending') {
      return badRequestResponse(
        `Cannot confirm a renewal that is already "${normalizedRenewal.status}"`
      );
    }

    // Confirm via helper (updates renewal + subscription renewal_status)
    const updated = await confirmRenewalRequest(
      id,
      accountId,
      body.renewal_price,
      body.new_billing_cycle
    );

    // Extend subscription expiry date
    const sub = normalizedRenewal.customer_premium_subscriptions;
    const subscriptionRow = Array.isArray(sub) ? sub[0] ?? null : sub;

    if (subscriptionRow) {
      const billingCycle =
        body.new_billing_cycle ?? (subscriptionRow.billing_cycle as '1month' | '3months' | '6months' | '1year');
      const newExpiry = calculateExpiryDate(subscriptionRow.expiry_date, billingCycle);
      const cycleMonths = getCycleMonths(billingCycle);

      await supabase
        .from('customer_premium_subscriptions')
        .update({
          expiry_date: newExpiry,
          billing_cycle: billingCycle,
          cycle_months: cycleMonths,
          status: 'active',
        })
        .eq('id', subscriptionRow.id);
    }

    return updatedResponse(updated, 'Renewal confirmed and subscription extended');
  })
);
