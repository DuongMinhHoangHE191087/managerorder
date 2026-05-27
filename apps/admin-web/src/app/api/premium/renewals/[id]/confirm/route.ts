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
} from '@/lib/utils/subscriptions-helpers';
import { isPremiumBillingCycle } from "@/lib/domain/premium-renewal-finance";

interface ConfirmBody {
  renewal_price?: number;
  new_billing_cycle?: string;
  cost_price?: number;
  collected_amount?: number;
  notes?: string;
  product_id?: string;
}

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

    if (renewal.status !== 'pending') {
      return badRequestResponse(
        `Cannot confirm a renewal that is already "${renewal.status}"`
      );
    }

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

    const updated = await confirmRenewalRequest(id, accountId, {
      renewalPrice: body.renewal_price,
      newBillingCycle: body.new_billing_cycle,
      costPrice: body.cost_price,
      collectedAmount: body.collected_amount,
      notes: body.notes,
      productId: body.product_id,
    });

    return updatedResponse(updated, 'Renewal confirmed and subscription extended');
  })
);
