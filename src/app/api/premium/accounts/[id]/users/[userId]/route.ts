// ============================================
// PREMIUM ACCOUNT USER DETAIL API
// PATCH  /api/premium/accounts/[id]/users/[userId]  → update sub-user
// DELETE /api/premium/accounts/[id]/users/[userId]  → remove sub-user
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  errorResponse,
  validateEmail,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import type { UpdatePremiumAccountUser } from '@/lib/types/premium';

// ============================================
// PATCH /api/premium/accounts/[id]/users/[userId]
// ============================================
export const PATCH = withErrorHandler(
  withAccount<{ id: string; userId: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id: premiumAccountId, userId } = await params;

    const body = (await request.json()) as UpdatePremiumAccountUser;

    const { data: rawExisting, error: findError } = await supabase
      .from('premium_account_users')
      .select('*')
      .eq('id', userId)
      .eq('premium_account_id', premiumAccountId)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (findError || !rawExisting) return notFoundResponse('Account user');
    type UserRow = Database['public']['Tables']['premium_account_users']['Row'];
    const existing = rawExisting as unknown as UserRow;

    if (body.user_email && !validateEmail(body.user_email)) {
      return errorResponse('Invalid email format', 400);
    }

    type DbUpdate = Database['public']['Tables']['premium_account_users']['Update'];
    const dbUpdates: DbUpdate = {};
    if (body.user_email !== undefined) dbUpdates.user_email = body.user_email;
    if (body.status !== undefined) dbUpdates.status = body.status;
    dbUpdates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('premium_account_users')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) return serverErrorResponse(updateError.message);

    // Log history for email changes
    if (body.user_email && body.user_email !== existing.user_email) {
      await supabase.from('premium_account_user_history').insert({
        account_user_id: userId,
        premium_account_id: premiumAccountId,
        account_id: accountId,
        change_type: 'email_change',
        old_email: existing.user_email,
        new_email: body.user_email,
      });
    }
    // Log status changes
    if (body.status && body.status !== existing.status) {
      await supabase.from('premium_account_user_history').insert({
        account_user_id: userId,
        premium_account_id: premiumAccountId,
        account_id: accountId,
        change_type: 'status_change',
        old_value: existing.status,
        new_value: body.status,
      });
    }

    return successResponse(updated, 'Account user updated');
  })
);

// ============================================
// DELETE /api/premium/accounts/[id]/users/[userId]
// Removes sub-user (soft-delete) and decrements used_slots
// ============================================
export const DELETE = withErrorHandler(
  withAccount<{ id: string; userId: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id: premiumAccountId, userId } = await params;

    const { data: rawUser, error: findError } = await supabase
      .from('premium_account_users')
      .select('id, status')
      .eq('id', userId)
      .eq('premium_account_id', premiumAccountId)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (findError || !rawUser) return notFoundResponse('Account user');
    const existing = rawUser as unknown as { id: string; status: string };

    const now = new Date().toISOString();

    // Soft-delete and mark as removed
    const { error: deleteError } = await supabase
      .from('premium_account_users')
      .update({ status: 'removed', deleted_at: now })
      .eq('id', userId);

    if (deleteError) return serverErrorResponse(deleteError.message);

    // Decrement used_slots only if user was active
    if (existing.status === 'active') {
      const { data: account } = await supabase
        .from('premium_accounts')
        .select('used_slots')
        .eq('id', premiumAccountId)
        .single();

      if (account && account.used_slots > 0) {
        await supabase
          .from('premium_accounts')
          .update({ used_slots: account.used_slots - 1 })
          .eq('id', premiumAccountId);
      }
    }

    // Log history
    await supabase.from('premium_account_user_history').insert({
      account_user_id: userId,
      premium_account_id: premiumAccountId,
      account_id: accountId,
      change_type: 'removed',
      old_value: existing.status,
      new_value: 'removed',
    });

    return successResponse(null, 'Account user removed successfully');
  })
);
