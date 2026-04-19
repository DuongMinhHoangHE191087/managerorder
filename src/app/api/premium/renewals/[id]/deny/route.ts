// ============================================
// POST /api/premium/renewals/[id]/deny
// Deny a pending renewal request → compute prorated refund
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
  denyRenewalRequest,
  calculateRefundForRenewal,
} from '@/lib/utils/subscriptions-helpers';

interface DenyBody {
  reason?: string;
  refund_method?: 'prorated' | 'full' | 'partial';
  custom_refund_amount?: number;
}

export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = (await request.json()) as DenyBody;

    // Verify the renewal belongs to this account and is still pending
    const { data: renewal, error: findError } = await supabase
      .from('subscription_renewals')
      .select('id, status, account_id')
      .eq('id', id)
      .eq('account_id', accountId)
      .single();

    if (findError || !renewal) return notFoundResponse('Renewal request');

    if (renewal.status !== 'pending') {
      return badRequestResponse(
        `Cannot deny a renewal that is already "${renewal.status}"`
      );
    }

    // Deny via helper (updates renewal + subscription renewal_status)
    const denied = await denyRenewalRequest(id, accountId, body.reason);

    // Calculate prorated refund automatically
    const refundMethod = body.refund_method ?? 'prorated';
    let refundAmount = 0;
    try {
      refundAmount = await calculateRefundForRenewal(
        id,
        accountId,
        refundMethod,
        body.custom_refund_amount
      );
    } catch {
      // Non-fatal: refund calc may fail if subscription already expired
      refundAmount = 0;
    }

    return updatedResponse(
      { ...denied, refund_amount: refundAmount, refund_method: refundMethod },
      'Renewal denied and refund calculated'
    );
  })
);
