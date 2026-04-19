// ============================================
// PREMIUM SUBSCRIPTIONS API - GET/DELETE SINGLE
// ============================================
// GET    /api/premium/subscriptions/[id] - Get specific subscription
// DELETE /api/premium/subscriptions/[id] - Soft delete subscription
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  successResponse,
  deletedResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import type { CustomerPremiumSubscription } from '@/lib/types/premium';
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";

// ============================================
// GET - Get specific subscription
// ============================================

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    // Fetch subscription
    const { data: baseSubscription, error } = await supabase
      .from('customer_premium_subscriptions')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (error || !baseSubscription) {
      console.error('[GET /api/premium/subscriptions/[id]] Error:', error);
      return notFoundResponse('Subscription');
    }

    const premiumAccountIds = [
      ...new Set(
        [baseSubscription.premium_account_id].filter(
          (accountId): accountId is string => Boolean(accountId),
        ),
      ),
    ];
    const premiumAccountUserIds = [
      ...new Set(
        [baseSubscription.premium_account_user_id].filter(
          (userId): userId is string => Boolean(userId),
        ),
      ),
    ];
    const packageIds = [
      ...new Set(
        [baseSubscription.package_id].filter(
          (packageId): packageId is string => Boolean(packageId),
        ),
      ),
    ];
    const serviceTypeIds = [
      ...new Set(
        [baseSubscription.service_type_id].filter(
          (serviceTypeId): serviceTypeId is string => Boolean(serviceTypeId),
        ),
      ),
    ];

    const [accountsMap, packagesMap, servicesMap, usersMap] = await Promise.all([
      loadRowsByIds<{
        id: string;
        primary_email: string;
        total_slots: number;
        used_slots: number;
        status: string;
        service_type_id: string;
      }>(
        supabase,
        "premium_accounts",
        accountId,
        premiumAccountIds,
        "id, primary_email, total_slots, used_slots, status, service_type_id",
      ),
      loadRowsByIds<{
        id: string;
        name: string;
        slug: string;
        total_slots: number;
        default_price: number | null;
      }>(
        supabase,
        "premium_packages",
        accountId,
        packageIds,
        "id, name, slug, total_slots, default_price",
      ),
      loadRowsByIds<{
        id: string;
        name: string;
        slug: string;
        category: string | null;
        supports_connection_check: boolean;
      }>(
        supabase,
        "premium_service_types",
        accountId,
        serviceTypeIds,
        "id, name, slug, category, supports_connection_check",
      ),
      loadRowsByIds<{
        id: string;
        user_email: string;
        status: string;
      }>(
        supabase,
        "premium_account_users",
        accountId,
        premiumAccountUserIds,
        "id, user_email, status",
      ),
    ]);

    const account = accountsMap.get(baseSubscription.premium_account_id) ?? null;
    const responseData = {
      ...baseSubscription,
      premium_accounts: account
        ? {
            ...account,
            service: account.service_type_id
              ? servicesMap.get(account.service_type_id) ?? null
              : null,
          }
        : null,
      premium_packages: baseSubscription.package_id
        ? packagesMap.get(baseSubscription.package_id) ?? null
        : null,
      premium_service_types: baseSubscription.service_type_id
        ? servicesMap.get(baseSubscription.service_type_id) ?? null
        : null,
      premium_account_users: baseSubscription.premium_account_user_id
        ? usersMap.get(baseSubscription.premium_account_user_id) ?? null
        : null,
    };

    type SubRow = { expiry_date: string; [key: string]: unknown };
    const typedData = responseData as unknown as SubRow;
    const msRemaining = new Date(typedData.expiry_date).getTime() - new Date().getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    // Add computed fields
    return successResponse({
      ...responseData,
      days_remaining: Math.max(0, daysRemaining),
      is_expiring_soon: daysRemaining <= 7,
    } as unknown as CustomerPremiumSubscription);
  })
);

// ============================================
// DELETE - Soft delete subscription
// ============================================

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    // Verify subscription exists and belongs to user
    const { data: existing, error: findError } = await supabase
      .from('customer_premium_subscriptions')
      .select('id, premium_account_id')
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return notFoundResponse('Subscription');
    }

    // Perform soft delete on subscription
    const { error: deleteError } = await supabase
      .from('customer_premium_subscriptions')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (deleteError) {
      console.error('[DELETE /api/premium/subscriptions/[id]] Error:', deleteError);
      return errorResponse(deleteError.message);
    }

    // Decrement used_slots in premium_account
    const { data: premiumAccount } = await supabase
      .from('premium_accounts')
      .select('used_slots')
      .eq('id', existing.premium_account_id)
      .single();

    if (premiumAccount && premiumAccount.used_slots > 0) {
      await supabase
        .from('premium_accounts')
        .update({
          used_slots: premiumAccount.used_slots - 1,
        })
        .eq('id', existing.premium_account_id);
    }

    return deletedResponse();
  })
);
