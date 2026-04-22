// ============================================
// MIGRATION DETAIL API
// GET /api/premium/migrations/[id]  → get migration with steps
// ============================================

import { NextRequest } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  successResponse,
  notFoundResponse,
} from '@/lib/utils/api-helpers';
import { withAccount } from '@/lib/api/with-account';
import { withErrorHandler } from '@/lib/api/with-error-handler';
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    const { data: baseMigration, error: dbError } = await supabase
      .from('account_migrations')
      .select('*')
      .eq('id', id)
      .eq('account_id', accountId)
      .single();

    if (dbError || !baseMigration) return notFoundResponse('Migration');

    const [sourceAccountMap, targetAccountMap] = await Promise.all([
      loadRowsByIds<{
        id: string;
        primary_email: string;
        status: string;
      }>(
        supabase,
        "premium_accounts",
        accountId,
        [baseMigration.source_account_id],
        "id, primary_email, status",
      ),
      loadRowsByIds<{
        id: string;
        primary_email: string;
        status: string;
      }>(
        supabase,
        "premium_accounts",
        accountId,
        [baseMigration.target_account_id],
        "id, primary_email, status",
      ),
    ]);

    const { data: customerRows } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('account_id', accountId)
      .in('id', [baseMigration.customer_id]);

    const customerName = customerRows?.[0]?.full_name ?? "N/A";

    const normalizedMigration = {
      ...baseMigration,
      customer_name: customerName,
      source_account: sourceAccountMap.get(baseMigration.source_account_id) ?? null,
      target_account: targetAccountMap.get(baseMigration.target_account_id) ?? null,
    };

    // Fetch migration steps
    const { data: steps } = await supabase
      .from('account_migration_history')
      .select('*')
      .eq('migration_id', id)
      .order('step_number', { ascending: true });

    return successResponse({ ...normalizedMigration, steps: steps ?? [] });
  })
);
