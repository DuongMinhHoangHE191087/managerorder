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
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import { createRenewalRequest } from '@/lib/utils/subscriptions-helpers';
import { ensurePremiumSubscriptionRenewalAllowed } from '@/lib/domain/sales-workflow-guards';

// ============================================
// PUT - Create renewal request for subscription
// ============================================

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    // Verify subscription exists and belongs to user
    const { data: subscription, error: findError } = await supabase
      .from('customer_premium_subscriptions')
      .select('id, customer_id, premium_account_id, status, renewal_status, expiry_date')
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (findError || !subscription) {
      return notFoundResponse('Subscription');
    }

    ensurePremiumSubscriptionRenewalAllowed(subscription);

    // Create renewal request
    const renewalData = await createRenewalRequest(
      accountId,
      id,
      subscription.customer_id
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
    };

    return updatedResponse(
      normalizedRenewal as unknown as Record<string, unknown>,
      'Renewal request created successfully'
    );
  })
);
