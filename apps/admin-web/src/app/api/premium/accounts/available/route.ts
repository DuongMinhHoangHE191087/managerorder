// ============================================
// PREMIUM ACCOUNTS API - AVAILABLE ACCOUNTS
// ============================================
// GET /api/premium/accounts/available - Get accounts with available slots
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  errorResponse,
  paginatedResponse,
  getPaginationParams,
  getSortParams,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import { calculateAvailableSlots } from '@/lib/utils/premium-accounts-helpers';
import type { PremiumAccount } from '@/lib/types/premium';
import {
  loadRowsByIds,
} from "@/app/api/premium/relation-fallback";

// ============================================
// GET - Get available premium accounts
// Accounts that have used_slots < total_slots
// ============================================

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const { searchParams } = new URL(request.url);

    // Get pagination
    const { page, limit, offset } = getPaginationParams(searchParams);
    const { sort, order } = getSortParams(searchParams);

    // Get filters
    const minSlots = searchParams.get('min_slots');

    const { data: baseAccounts, error } = await supabase
      .from('premium_accounts')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[GET /api/premium/accounts/available] Error:', error);
      return errorResponse(error.message);
    }

    const serviceTypeIds = [
      ...new Set(
        (baseAccounts ?? [])
          .map((account) => account.service_type_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const packageIds = [
      ...new Set(
        (baseAccounts ?? [])
          .map((account) => account.package_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [serviceTypeMap, packageMap] = await Promise.all([
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
      loadRowsByIds<{
        id: string;
        name: string;
        slug: string;
        total_slots: number;
      }>(
        supabase,
        "premium_packages",
        accountId,
        packageIds,
        "id, name, slug, total_slots",
      ),
    ]);

    const parsedMinSlots = minSlots ? parseInt(minSlots, 10) : null;
    const availableAccounts = (baseAccounts ?? [])
      .map((account) => ({
        ...account,
        premium_service_types: serviceTypeMap.get(account.service_type_id) ?? null,
        premium_packages: packageMap.get(account.package_id) ?? null,
        available_slots: calculateAvailableSlots(account.total_slots, account.used_slots),
      }))
      .filter((account) =>
        parsedMinSlots && parsedMinSlots > 0
          ? account.available_slots >= parsedMinSlots
          : account.available_slots > 0,
      );

    // Return paginated response
    return paginatedResponse(
      availableAccounts as PremiumAccount[],
      page,
      limit,
      availableAccounts.length
    );
  })
);
