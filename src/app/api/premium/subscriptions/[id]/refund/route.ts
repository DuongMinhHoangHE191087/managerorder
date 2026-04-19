// ============================================
// PREMIUM SUBSCRIPTIONS API - REFUND CALCULATION
// ============================================
// POST /api/premium/subscriptions/[id]/refund - Calculate refund for subscription
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  badRequestResponse,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import { calculateProratedRefund, getDaysRemaining } from '@/lib/utils/premium-accounts-helpers';
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";
import { ensurePremiumSubscriptionRefundAllowed } from '@/lib/domain/sales-workflow-guards';


interface RefundBody {
  renewal_id?: string;
  method?: 'prorated' | 'full' | 'partial';
  custom_amount?: number;
}

// ============================================
// POST - Calculate refund for subscription
// ============================================

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body: RefundBody = await request.json();

    // Verify subscription exists and belongs to user
    const { data: subscription, error: findError } = await supabase
      .from('customer_premium_subscriptions')
      .select('id, original_price, start_date, expiry_date, renewal_status, renewal_denied_reason, premium_account_id, package_id, service_type_id')
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (findError || !subscription) {
      return notFoundResponse('Subscription');
    }

    ensurePremiumSubscriptionRefundAllowed(subscription);

    const method = body.method || 'prorated';
    let refundAmount = 0;

    if (method === 'prorated') {
      refundAmount = calculateProratedRefund(
        subscription.original_price,
        subscription.start_date,
        subscription.expiry_date
      );
    } else if (method === 'full') {
      refundAmount = subscription.original_price;
    } else if (method === 'partial') {
      if (!body.custom_amount || body.custom_amount <= 0) {
        return badRequestResponse('Custom amount must be provided for partial refund');
      }
      refundAmount = Math.min(body.custom_amount, subscription.original_price);
    }

    const daysRemaining = getDaysRemaining(subscription.expiry_date);

    // Update subscription with refund amount
    const { error: updateError } = await supabase
      .from('customer_premium_subscriptions')
      .update({
        refund_amount: refundAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[POST refund] Update error:', updateError);
      return errorResponse(updateError.message);
    }

    const [accountsMap, packagesMap, servicesMap] = await Promise.all([
      loadRowsByIds<{
        id: string;
        primary_email: string;
        service_type_id: string;
      }>(
        supabase,
        "premium_accounts",
        accountId,
        [subscription.premium_account_id],
        "id, primary_email, service_type_id",
      ),
      loadRowsByIds<{
        id: string;
        name: string;
      }>(
        supabase,
        "premium_packages",
        accountId,
        [subscription.package_id],
        "id, name",
      ),
      loadRowsByIds<{
        id: string;
        name: string;
      }>(
        supabase,
        "premium_service_types",
        accountId,
        [subscription.service_type_id],
        "id, name",
      ),
    ]);

    const updated = {
      ...subscription,
      refund_amount: refundAmount,
      updated_at: new Date().toISOString(),
    };
    const account = accountsMap.get(subscription.premium_account_id) ?? null;
    const hydratedUpdated = {
      ...updated,
      premium_accounts: account
        ? {
            ...account,
            service: account.service_type_id
              ? servicesMap.get(account.service_type_id) ?? null
              : null,
          }
        : null,
      premium_packages: subscription.package_id
        ? packagesMap.get(subscription.package_id) ?? null
        : null,
      premium_service_types: subscription.service_type_id
        ? servicesMap.get(subscription.service_type_id) ?? null
        : null,
    };

    return successResponse(
      {
        subscription: hydratedUpdated,
        refund_calculation: {
          method,
          refund_amount: refundAmount,
          currency: 'USD',
          original_price: subscription.original_price,
          days_remaining: daysRemaining,
          calculation_date: new Date().toISOString(),
        },
      },
      'Refund calculated successfully'
    );
  })
);
