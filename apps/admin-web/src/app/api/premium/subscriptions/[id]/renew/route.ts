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
import { getCycleMonths } from "@/lib/domain/premium-renewal-finance";

interface RenewalRequestBody {
  renewal_price?: number;
  new_billing_cycle?: '1month' | '3months' | '6months' | '1year';
  cost_price?: number;
  collected_amount?: number;
  notes?: string;
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

    // Create renewal request
    const renewalData = await createRenewalRequest(
      accountId,
      id,
      subscription.customer_id,
      {
        renewalPrice: body.renewal_price ?? Number(subscription.final_price ?? subscription.original_price ?? 0),
        newBillingCycle: body.new_billing_cycle ?? String(subscription.billing_cycle ?? '1month'),
        costPrice: body.cost_price ?? 0,
        collectedAmount: body.collected_amount ?? 0,
        notes: body.notes,
      },
    );

    // Get full renewal details
    const { data: fullRenewal, error: renewalError } = await supabase
      .from('subscription_renewals')
      .select('id, status, account_id, original_subscription_id')
      .eq('id', (renewalData as { id: string } | null)?.id ?? id)
      .single();

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
        cycle_months: getCycleMonths(
          body.new_billing_cycle ?? String(subscription.billing_cycle ?? '1month'),
        ),
        renewal_price: Number(body.renewal_price ?? subscription.final_price ?? subscription.original_price ?? 0),
        cost_price: Number(body.cost_price ?? 0),
        collected_amount: Number(body.collected_amount ?? 0),
      },
    };

    return updatedResponse(
      normalizedRenewal as unknown as Record<string, unknown>,
      'Renewal request created successfully'
    );
  })
);
