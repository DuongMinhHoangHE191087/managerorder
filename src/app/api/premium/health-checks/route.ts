// ============================================
// HEALTH CHECKS API
// POST /api/premium/health-checks  → run health check(s)
// GET  /api/premium/health-checks  → list health check logs
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  paginatedResponse,
  getPaginationParams,
  getSortParams,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import type { RunHealthCheck } from '@/lib/types/premium';
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";

// ============================================
// GET /api/premium/health-checks — list logs
// ============================================
export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const { sort, order } = getSortParams(searchParams);

    const premiumAccountId = searchParams.get('premium_account_id');
    const serviceTypeId = searchParams.get('service_type_id');
    const currentStatus = searchParams.get('current_status') as 'working' | 'error' | 'unknown' | null;
    const checkType = searchParams.get('check_type') as 'api' | 'manual' | 'scheduled' | null;
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    const allowedSort = ['check_timestamp', 'created_at', 'current_status', 'response_time_ms'];
    const safeSort = allowedSort.includes(sort) ? sort : 'check_timestamp';

    const buildQuery = (selectClause: string, includeCount = false) => {
      let query = supabase
        .from('premium_account_health_logs')
        .select(selectClause, includeCount ? { count: 'exact' } : undefined)
        .eq('account_id', accountId);

      if (premiumAccountId) query = query.eq('premium_account_id', premiumAccountId);
      if (serviceTypeId) query = query.eq('service_type_id', serviceTypeId);
      if (currentStatus) query = query.eq('current_status', currentStatus);
      if (checkType) query = query.eq('check_type', checkType);
      if (fromDate) query = query.gte('check_timestamp', fromDate);
      if (toDate) query = query.lte('check_timestamp', toDate);

      return query;
    };

    const { data, error: dbError, count } = await buildQuery(
      '*',
      true,
    )
      .order(safeSort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (dbError) {
      return serverErrorResponse(dbError.message);
    }

    type HealthLogRow = {
      premium_account_id: string;
      [key: string]: unknown;
    };
    const baseRows = (data ?? []) as unknown as HealthLogRow[];

    const accountMap = await loadRowsByIds<{
      id: string;
      primary_email: string;
      status: string;
    }>(
      supabase,
      "premium_accounts",
      accountId,
      baseRows.map((row) => row.premium_account_id),
      "id, primary_email, status",
    );

    const hydrated = baseRows.map((row) => ({
      ...row,
      premium_accounts: accountMap.get(row.premium_account_id) ?? null,
    }));

    return paginatedResponse(hydrated, page, limit, count ?? 0);
  })
);

// ============================================
// POST /api/premium/health-checks — run check(s)
// ============================================
export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = (await request.json()) as RunHealthCheck;

    // Find premium accounts eligible for health check
    let accountQuery = supabase
      .from('premium_accounts')
      .select('id, account_id, service_type_id, primary_email, status, connection_status')
      .eq('account_id', accountId)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (body.premium_account_id) {
      accountQuery = accountQuery.eq('id', body.premium_account_id);
    } else {
      // Only check accounts with supports_connection_check = true
      const { data: serviceTypes } = await supabase
        .from('premium_service_types')
        .select('id')
        .eq('account_id', accountId)
        .eq('supports_connection_check', true)
        .is('deleted_at', null);

      if (!serviceTypes || serviceTypes.length === 0) {
        return errorResponse('No service types support connection checking', 400);
      }

      const serviceTypeIds = serviceTypes.map((st: { id: string }) => st.id);
      accountQuery = accountQuery.in('service_type_id', serviceTypeIds);
    }

    const { data: accounts, error: accountError } = await accountQuery;

    if (accountError) return serverErrorResponse(accountError.message);
    if (!accounts || accounts.length === 0) {
      return errorResponse('No eligible premium accounts found for health check', 404);
    }

    const checkType = body.check_type ?? 'manual';
    const checkTimestamp = new Date().toISOString();
    const results: {
      premium_account_id: string;
      email: string;
      status: 'working' | 'error' | 'unknown';
      log_id: string;
    }[] = [];

    for (const account of accounts) {
      // Simulate health check — in production this would call the actual service API
      const checkStatus: 'working' | 'error' | 'unknown' =
        account.status === 'active' ? 'working' : 'unknown';

      // Map health log status to premium_accounts.connection_status
      const connectionStatus: 'working' | 'error' | 'manual_check_needed' | null =
        checkStatus === 'working' ? 'working' : null;

      const { data: logEntry, error: logError } = await supabase
        .from('premium_account_health_logs')
        .insert({
          premium_account_id: account.id,
          account_id: accountId,
          service_type_id: account.service_type_id,
          check_timestamp: checkTimestamp,
          check_type: checkType,
          current_status: checkStatus,
          previous_status: account.connection_status ?? null,
          notes: body.notes,
        })
        .select('id')
        .single();

      if (!logError && logEntry) {
        results.push({
          premium_account_id: account.id,
          email: account.primary_email,
          status: checkStatus,
          log_id: logEntry.id,
        });
      }

      // Update connection_status and last_connection_check_at on the account
      await supabase
        .from('premium_accounts')
        .update({
          connection_status: connectionStatus,
          last_connection_check_at: checkTimestamp,
        })
        .eq('id', account.id);
    }

    return successResponse(
      { checked: results.length, results },
      `Health check completed for ${results.length} account(s)`
    );
  })
);
