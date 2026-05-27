// ============================================
// HEALTH CHECKS API
// POST /api/premium/health-checks  → run health check(s)
// GET  /api/premium/health-checks  → list health check logs
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  successResponse,
  serverErrorResponse,
  getPaginationParams,
  getSortParams,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import type { RunHealthCheck } from '@/lib/types/premium';
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";
import {
  buildLocalPremiumHealthCheckRun,
  shouldPreferLocalPremiumFixtures,
  shouldUseLocalPremiumFallback,
} from "@/app/api/premium/local-fixtures";
import { runPremiumHealthChecksForAccount } from "@/lib/services/premium-health-checks.service";

type HealthCheckSummaryCounts = {
  workingCount: number;
  errorCount: number;
  unknownCount: number;
  manualCount: number;
};

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

    const loadSummaryCounts = async (): Promise<HealthCheckSummaryCounts> => {
      const buildSummaryQuery = (selectClause: string, includeCount = false) => {
        let query = supabase
          .from('premium_account_health_logs')
          .select(selectClause, includeCount ? { count: 'exact' } : undefined)
          .eq('account_id', accountId);

        if (premiumAccountId) query = query.eq('premium_account_id', premiumAccountId);
        if (serviceTypeId) query = query.eq('service_type_id', serviceTypeId);
        if (fromDate) query = query.gte('check_timestamp', fromDate);
        if (toDate) query = query.lte('check_timestamp', toDate);

        return query;
      };

      const [workingResult, errorResult, unknownResult, manualResult] = await Promise.all([
        buildSummaryQuery("id", true).eq("current_status", "working").range(0, 0),
        buildSummaryQuery("id", true).eq("current_status", "error").range(0, 0),
        buildSummaryQuery("id", true).eq("current_status", "unknown").range(0, 0),
        buildSummaryQuery("id", true).eq("check_type", "manual").range(0, 0),
      ]);

      return {
        workingCount: Number(workingResult.count ?? 0),
        errorCount: Number(errorResult.count ?? 0),
        unknownCount: Number(unknownResult.count ?? 0),
        manualCount: Number(manualResult.count ?? 0),
      };
    };

    const [pageResult, summaryCounts] = await Promise.all([
      buildQuery('*', true)
        .order(safeSort, { ascending: order === 'asc' })
        .range(offset, offset + limit - 1),
      loadSummaryCounts(),
    ]);

    const { data, error: dbError, count } = pageResult;

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
      connection_status: string | null;
    }>(
      supabase,
      "premium_accounts",
      accountId,
      baseRows.map((row) => row.premium_account_id),
      "id, primary_email, status, connection_status",
    );

    const hydrated = baseRows.map((row) => ({
      ...row,
      premium_accounts: accountMap.get(row.premium_account_id) ?? null,
    }));

    const total = count ?? 0;

    return NextResponse.json(
      {
        success: true,
        data: hydrated,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          summary: summaryCounts,
        },
        summary: summaryCounts,
      },
      { status: 200 },
    );
  })
);

// ============================================
// POST /api/premium/health-checks — run check(s)
// ============================================
export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = (await request.json().catch(() => ({}))) as RunHealthCheck;

    if (shouldPreferLocalPremiumFixtures()) {
      const fallback = buildLocalPremiumHealthCheckRun(accountId, {
        premiumAccountId: body.premium_account_id,
        checkType: body.check_type ?? "manual",
        notes: body.notes ?? null,
      });

      return successResponse(
        {
          checked: fallback.checked,
          results: fallback.results,
        },
        `Health check completed for ${fallback.checked} account(s)`,
      );
    }

    try {
      const result = await runPremiumHealthChecksForAccount(supabase, accountId, {
        premium_account_id: body.premium_account_id,
        check_type: body.check_type ?? "manual",
        notes: body.notes ?? null,
        noServiceTypesMessage: "No service types support connection checking",
        noEligibleAccountsMessage: "No eligible premium accounts found for health check",
        updateOnLogFailure: true,
      });

      return successResponse(
        {
          checked: result.checked,
          results: result.results,
        },
        `Health check completed for ${result.checked} account(s)`,
      );
    } catch (error) {
      if (shouldUseLocalPremiumFallback(error)) {
        const fallback = buildLocalPremiumHealthCheckRun(accountId, {
          premiumAccountId: body.premium_account_id,
          checkType: body.check_type ?? "manual",
          notes: body.notes ?? null,
        });

        return successResponse(
          {
            checked: fallback.checked,
            results: fallback.results,
          },
          `Health check completed for ${fallback.checked} account(s)`,
        );
      }

      throw error;
    }
  })
);
