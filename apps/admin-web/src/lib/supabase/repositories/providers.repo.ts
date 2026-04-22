// ============================================================
// PROVIDERS REPOSITORY — Supabase
// CRUD for providers table
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';
import type { Database } from '@/lib/supabase/database.types';
import { isMissingRelationError } from '@/lib/supabase/schema-errors';

type ProviderTableRow = Omit<
  Database['public']['Tables']['providers']['Row'],
  'notes'
> & {
  notes: string | Record<string, unknown> | null;
};

type ProviderStatsRow = Pick<
  Database['public']['Tables']['purchase_orders']['Row'],
  'provider_id' | 'total_amount_vnd'
>;

interface ProviderRow extends ProviderTableRow {
  total_import_amount_vnd: number;
  purchase_order_count: number;
  code?: string | null;
  status?: string | null;
  debt_amount_vnd?: number | null;
}


const key = {
  list: (accountId: string) => `providers:list:${accountId}`,
};

async function listProviderBaseRows(accountId: string): Promise<ProviderTableRow[]> {
  const { data, error } = await supabase
    .from('providers')
    .select('id, account_id, name, contacts, tier, reliability_score, notes, deleted_at, created_at, updated_at')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProviderTableRow[];
}

async function getProviderBaseRow(id: string, accountId: string): Promise<ProviderTableRow> {
  const { data, error } = await supabase
    .from('providers')
    .select('id, account_id, name, contacts, tier, reliability_score, notes, deleted_at, created_at, updated_at')
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Provider not found');
  return data as unknown as ProviderTableRow;
}

async function getProviderStats(
  accountId: string,
  providerIds: string[],
): Promise<Map<string, Pick<ProviderRow, 'total_import_amount_vnd' | 'purchase_order_count'>>> {
  const stats = new Map<string, Pick<ProviderRow, 'total_import_amount_vnd' | 'purchase_order_count'>>();

  if (providerIds.length === 0) {
    return stats;
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .select('provider_id, total_amount_vnd')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .in('provider_id', providerIds);

  if (error) {
    if (isMissingRelationError(error, 'purchase_orders')) {
      return stats;
    }
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as ProviderStatsRow[]) {
    const current = stats.get(row.provider_id) ?? {
      total_import_amount_vnd: 0,
      purchase_order_count: 0,
    };

    current.total_import_amount_vnd += Number(row.total_amount_vnd ?? 0);
    current.purchase_order_count += 1;
    stats.set(row.provider_id, current);
  }

  return stats;
}

function withStats(
  provider: ProviderTableRow,
  stats: Pick<ProviderRow, 'total_import_amount_vnd' | 'purchase_order_count'> | undefined,
): ProviderRow {
  return {
    ...provider,
    total_import_amount_vnd: stats?.total_import_amount_vnd ?? 0,
    purchase_order_count: stats?.purchase_order_count ?? 0,
  };
}

export async function listProviders(accountId: string): Promise<ProviderRow[]> {
  return cached(
    key.list(accountId),
    async () => {
      const providers = await listProviderBaseRows(accountId);
      const stats = await getProviderStats(
        accountId,
        providers.map((provider) => provider.id),
      );

      return providers.map((provider) => withStats(provider, stats.get(provider.id)));
    },
    TTL.LIST,
  );
}

export async function getProviderById(id: string, accountId: string): Promise<ProviderRow> {
  const provider = await getProviderBaseRow(id, accountId);
  const stats = await getProviderStats(accountId, [id]);
  return withStats(provider, stats.get(id));
}

export async function createProvider(
  accountId: string,
  input: {
    name: string;
    contacts?: Record<string, unknown>[];
    tier?: string;
    reliability_score?: number;
    notes?: string | Record<string, unknown> | null;
  }
): Promise<ProviderRow> {
  const { data, error } = await supabase
    .from('providers')
    .insert({
      account_id: accountId,
      name: input.name,
      contacts: input.contacts ?? [],
      tier: input.tier ?? 'regular',
      reliability_score: input.reliability_score ?? 100,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  return withStats((data as unknown as ProviderTableRow), undefined);
}

export async function updateProvider(
  id: string,
  accountId: string,
  input: Partial<{
    name: string;
    contacts: Record<string, unknown>[];
    tier: string;
    reliability_score: number;
    notes: string | Record<string, unknown> | null;
    created_at: string;
  }>
): Promise<ProviderRow> {
  const updatePayload: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('providers')
    .update(updatePayload)
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Provider not found');
  invalidate(key.list(accountId));
  const stats = await getProviderStats(accountId, [id]);
  return withStats((data as unknown as ProviderTableRow), stats.get(id));
}

export async function deleteProvider(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('providers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
}
