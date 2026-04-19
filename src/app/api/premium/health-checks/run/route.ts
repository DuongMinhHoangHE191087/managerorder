// ============================================
// POST /api/premium/health-checks/run
// Trigger a manual health check for one or all eligible accounts
// Separate from GET/POST on /health-checks for explicit "run" semantics
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';

interface RunBody {
  /** If set, only check this specific premium account */
  premium_account_id?: string;
  /** Optional notes logged with each health check entry */
  notes?: string;
}

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = (await request.json().catch(() => ({}))) as RunBody;
    const checkType = 'manual';
    const checkTimestamp = new Date().toISOString();

    // ── Find eligible accounts ─────────────────────────────────────────────
    const { data: supportedServiceTypes } = await supabase
      .from('premium_service_types')
      .select('id')
      .eq('account_id', accountId)
      .eq('supports_connection_check', true)
      .is('deleted_at', null);

    const supportedIds = (supportedServiceTypes ?? []).map((s) => s.id);

    if (supportedIds.length === 0) {
      return errorResponse(
        'No service types have supports_connection_check = true',
        400
      );
    }

    let accountQuery = supabase
      .from('premium_accounts')
      .select('id, primary_email, status, connection_status, service_type_id')
      .eq('account_id', accountId)
      .eq('status', 'active')
      .in('service_type_id', supportedIds)
      .is('deleted_at', null);

    if (body.premium_account_id) {
      accountQuery = accountQuery.eq('id', body.premium_account_id);
    }

    const { data: accounts, error: accountError } = await accountQuery;

    if (accountError) return serverErrorResponse(accountError.message);
    if (!accounts || accounts.length === 0) {
      return errorResponse('No eligible active accounts found for health check', 404);
    }

    // ── Run check for each account ─────────────────────────────────────────
    type CheckResult = {
      premium_account_id: string;
      email: string;
      status: 'working' | 'error' | 'unknown';
      log_id: string;
      previous_status: string | null;
    };
    const results: CheckResult[] = [];
    const errors: { premium_account_id: string; error: string }[] = [];

    for (const account of accounts) {
      const checkStatus: 'working' | 'error' | 'unknown' =
        account.status === 'active' ? 'working' : 'unknown';

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
          notes: body.notes ?? null,
        })
        .select('id')
        .single();

      if (logError || !logEntry) {
        errors.push({
          premium_account_id: account.id,
          error: logError?.message ?? 'Failed to write log',
        });
        continue;
      }

      // Update connection_status + last_connection_check_at
      await supabase
        .from('premium_accounts')
        .update({
          connection_status: checkStatus === 'working' ? 'working' : null,
          last_connection_check_at: checkTimestamp,
        })
        .eq('id', account.id);

      results.push({
        premium_account_id: account.id,
        email: account.primary_email,
        status: checkStatus,
        log_id: logEntry.id,
        previous_status: account.connection_status ?? null,
      });
    }

    const message =
      results.length > 0
        ? `Health check completed: ${results.length} account(s) checked${errors.length > 0 ? `, ${errors.length} failed` : ''}`
        : 'Health check completed with errors';

    return successResponse(
      {
        checked: results.length,
        failed: errors.length,
        results,
        ...(errors.length > 0 && { errors }),
      },
      message
    );
  })
);
