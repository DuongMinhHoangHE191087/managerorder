// ============================================
// API route for /api/premium/renewals/[id]
// Supports soft-deleting a renewal request
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  successResponse,
  notFoundResponse,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    const { data: renewal, error: findError } = await supabase
      .from('subscription_renewals')
      .select('id')
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (findError || !renewal) return notFoundResponse('Renewal request');

    const { error: updateError } = await supabase
      .from('subscription_renewals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('account_id', accountId);

    if (updateError) throw updateError;

    return successResponse({ deleted: true }, 'Renewal request soft-deleted successfully');
  })
);

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    const { data, error } = await supabase
      .from('subscription_renewals')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (error || !data) return notFoundResponse('Renewal request');

    return successResponse(data);
  })
);
