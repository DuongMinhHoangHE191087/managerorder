// ============================================================
// SETTINGS REPOSITORY — Supabase
// Replaces in-memory: listPaymentSources, createPaymentSource,
//                     updatePaymentSource, deletePaymentSource,
//                     listSalesChannels, createSalesChannel,
//                     updateSalesChannel, deleteSalesChannel
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';

type PaymentSourceRow = Database['public']['Tables']['payment_sources']['Row'];
type SalesChannelRow = Database['public']['Tables']['sales_channels']['Row'];

const key = {
  paymentSources: (accountId: string) => `payment_sources:list:${accountId}`,
  salesChannels: (accountId: string) => `sales_channels:list:${accountId}`,
};

// ── Payment Sources ──────────────────────────────────────────────────────────

export async function listPaymentSources(accountId: string): Promise<PaymentSourceRow[]> {
  return cached(
    key.paymentSources(accountId),
    async () => {
      const { data, error } = await supabase
        .from('payment_sources')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    TTL.REFERENCE,
  );
}

export async function createPaymentSource(
  accountId: string,
  input: { name: string; icon?: string }
): Promise<PaymentSourceRow> {
  const { data, error } = await supabase
    .from('payment_sources')
    .insert({ name: input.name, icon: input.icon ?? null, account_id: accountId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.paymentSources(accountId));
  return data;
}

export async function updatePaymentSource(
  id: string,
  accountId: string,
  input: { name?: string; icon?: string }
): Promise<PaymentSourceRow> {
  const { data, error } = await supabase
    .from('payment_sources')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('PaymentSource not found');
  invalidate(key.paymentSources(accountId));
  return data;
}

export async function deletePaymentSource(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('payment_sources')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.paymentSources(accountId));
}

// ── Sales Channels ───────────────────────────────────────────────────────────

export async function listSalesChannels(accountId: string): Promise<SalesChannelRow[]> {
  return cached(
    key.salesChannels(accountId),
    async () => {
      const { data, error } = await supabase
        .from('sales_channels')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    TTL.REFERENCE,
  );
}

export async function createSalesChannel(
  accountId: string,
  input: { name: string }
): Promise<SalesChannelRow> {
  const { data, error } = await supabase
    .from('sales_channels')
    .insert({ name: input.name, account_id: accountId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.salesChannels(accountId));
  return data;
}

export async function updateSalesChannel(
  id: string,
  accountId: string,
  input: { name?: string }
): Promise<SalesChannelRow> {
  const { data, error } = await supabase
    .from('sales_channels')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('SalesChannel not found');
  invalidate(key.salesChannels(accountId));
  return data;
}

export async function deleteSalesChannel(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('sales_channels')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.salesChannels(accountId));
}
