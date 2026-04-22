// ============================================
// PREMIUM ACCOUNT USERS API
// GET  /api/premium/accounts/[id]/users  → list sub-users
// POST /api/premium/accounts/[id]/users  → add sub-user
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  createdResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  validationErrorResponse,
  getPaginationParams,
  paginatedResponse,
  validateEmail,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import type { CreatePremiumAccountUser } from '@/lib/types/premium';

// ============================================
// GET /api/premium/accounts/[id]/users
// ============================================
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id: premiumAccountId } = await params;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const statusFilter = searchParams.get('status') as 'active' | 'removed' | 'suspended' | null;

    // Verify the premium account belongs to this account_id
    const { data: account, error: accountError } = await supabase
      .from('premium_accounts')
      .select('id')
      .eq('id', premiumAccountId)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (accountError || !account) {
      return notFoundResponse('Premium account');
    }

    let query = supabase
      .from('premium_account_users')
      .select('*', { count: 'exact' })
      .eq('premium_account_id', premiumAccountId)
      .eq('account_id', accountId)
      .is('deleted_at', null);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error: dbError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dbError) return serverErrorResponse(dbError.message);

    return paginatedResponse(data ?? [], page, limit, count ?? 0);
  })
);

// ============================================
// POST /api/premium/accounts/[id]/users
// ============================================
export const POST = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id: premiumAccountId } = await params;

    const body = (await request.json()) as Partial<CreatePremiumAccountUser>;

    // Validate required fields
    if (!body.user_email) {
      return validationErrorResponse({ user_email: ['user_email is required'] });
    }
    if (!validateEmail(body.user_email)) {
      return validationErrorResponse({ user_email: ['Invalid email format'] });
    }

    // Verify premium account exists and has available slots
    const { data: premiumAccount, error: accountError } = await supabase
      .from('premium_accounts')
      .select('id, total_slots, used_slots, status')
      .eq('id', premiumAccountId)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (accountError || !premiumAccount) {
      return notFoundResponse('Premium account');
    }
    if (premiumAccount.status !== 'active') {
      return errorResponse('Premium account is not active', 400);
    }
    if (premiumAccount.used_slots >= premiumAccount.total_slots) {
      return errorResponse('No available slots in this premium account', 400);
    }

    // Check email not already active in this premium account
    const { data: existing } = await supabase
      .from('premium_account_users')
      .select('id')
      .eq('premium_account_id', premiumAccountId)
      .eq('user_email', body.user_email)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return errorResponse('This email is already an active user in this premium account', 409);
    }

    const { data: rawNewUser, error: insertError } = await supabase
      .from('premium_account_users')
      .insert({
        account_id: accountId,
        premium_account_id: premiumAccountId,
        user_email: body.user_email,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) return serverErrorResponse(insertError.message);
    const newUser = rawNewUser as unknown as { id: string; [key: string]: unknown };

    // Increment used_slots
    await supabase
      .from('premium_accounts')
      .update({ used_slots: premiumAccount.used_slots + 1 })
      .eq('id', premiumAccountId);

    // Log history
    await supabase.from('premium_account_user_history').insert({
      account_user_id: newUser.id,
      premium_account_id: premiumAccountId,
      account_id: accountId,
      change_type: 'added',
      new_email: body.user_email,
      notes: body.notes,
    });

    return createdResponse(newUser, 'Sub-user added successfully');
  })
);
