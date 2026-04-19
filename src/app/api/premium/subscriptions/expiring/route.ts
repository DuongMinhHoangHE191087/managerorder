// ============================================
// PREMIUM SUBSCRIPTIONS API - EXPIRING SUBSCRIPTIONS
// ============================================
// GET /api/premium/subscriptions/expiring - Get subscriptions expiring soon
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  errorResponse,
  paginatedResponse,
  getPaginationParams,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import { isExpiringSoon, getDaysRemaining } from '@/lib/utils/premium-accounts-helpers';
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";

// ============================================
// GET - List subscriptions expiring soon
// ============================================

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);

    // Get pagination
    const { page, limit, offset } = getPaginationParams(searchParams);

    // Get threshold (default 7 days)
    const daysThreshold = Math.min(
      parseInt(searchParams.get('days_threshold') || '7'),
      30
    );

    // Fetch all active subscriptions
    const { data: baseSubscriptions, error } = await supabase
      .from('customer_premium_subscriptions')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('expiry_date', { ascending: true });

    if (error) {
      console.error('[GET /api/premium/subscriptions/expiring] Error:', error);
      return errorResponse(error.message);
    }

    const premiumAccountIds = [
      ...new Set(
        (baseSubscriptions ?? [])
          .map((item) => item.premium_account_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const packageIds = [
      ...new Set(
        (baseSubscriptions ?? [])
          .map((item) => item.package_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const serviceTypeIds = [
      ...new Set(
        (baseSubscriptions ?? [])
          .map((item) => item.service_type_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [accountsMap, packagesMap, servicesMap] = await Promise.all([
      loadRowsByIds<{
        id: string;
        primary_email: string;
        total_slots: number;
        used_slots: number;
      }>(
        supabase,
        "premium_accounts",
        accountId,
        premiumAccountIds,
        "id, primary_email, total_slots, used_slots",
      ),
      loadRowsByIds<{
        id: string;
        name: string;
        slug: string;
      }>(
        supabase,
        "premium_packages",
        accountId,
        packageIds,
        "id, name, slug",
      ),
      loadRowsByIds<{
        id: string;
        name: string;
        slug: string;
      }>(
        supabase,
        "premium_service_types",
        accountId,
        serviceTypeIds,
        "id, name, slug",
      ),
    ]);

    const expiringSubscriptions = (baseSubscriptions ?? [])
      .filter((sub) => isExpiringSoon(sub.expiry_date, daysThreshold))
      .map((sub) => ({
        ...sub,
        premium_accounts: accountsMap.get(sub.premium_account_id) ?? null,
        premium_packages: packagesMap.get(sub.package_id) ?? null,
        premium_service_types: servicesMap.get(sub.service_type_id) ?? null,
        days_remaining: getDaysRemaining(sub.expiry_date),
      }))
      .sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0));

    // Apply pagination on filtered results
    const paginatedData = expiringSubscriptions.slice(offset, offset + limit);
    const total = expiringSubscriptions.length;

    // Return paginated response
    return paginatedResponse(paginatedData, page, limit, total);
  })
);
