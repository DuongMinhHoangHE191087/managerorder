// ============================================================
// PURCHASE ORDERS REPOSITORY — Supabase
// CRUD for purchase_orders table (Provider inbound orders)
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';
import { upsertProviderProductPrice } from './provider-product-prices.repo';
import type { Database } from '@/lib/supabase/database.types';
import {
  assertPurchaseOrderDeletable,
  resolvePurchaseOrderStatus,
} from '@/lib/domain/purchase-orders';

type PurchaseOrderRow = Database['public']['Tables']['purchase_orders']['Row'];

const key = {
  list: (accountId: string) => `purchase-orders:list:${accountId}`,
  byProvider: (providerId: string) => `purchase-orders:provider:${providerId}`,
};

export async function listPurchaseOrders(
  accountId: string,
  providerId?: string,
): Promise<PurchaseOrderRow[]> {
  const cacheKey = providerId ? key.byProvider(providerId) : key.list(accountId);
  return cached(
    cacheKey,
    async () => {
      let query = supabase
        .from('purchase_orders')
        .select('*')
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (providerId) {
        query = query.eq('provider_id', providerId);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as PurchaseOrderRow[];
    },
    TTL.LIST,
  );
}

export async function getPurchaseOrderById(
  id: string,
  accountId: string,
): Promise<PurchaseOrderRow> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Purchase order not found');
  return data as PurchaseOrderRow;
}

export async function createPurchaseOrder(
  accountId: string,
  input: {
    provider_id: string;
    items: Record<string, unknown>[];
    status?: string;
    total_amount_vnd: number;
    total_paid_vnd?: number;
    payment_method?: string;
    notes?: string;
    received_at?: string;
  },
): Promise<PurchaseOrderRow> {
  const normalizedStatus = resolvePurchaseOrderStatus({
    total_amount_vnd: input.total_amount_vnd,
    total_paid_vnd: input.total_paid_vnd ?? 0,
    requested_status: input.status ?? null,
    received_at: input.received_at ?? null,
  });

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({
      account_id: accountId,
      provider_id: input.provider_id,
      items: input.items,
      status: normalizedStatus,
      total_amount_vnd: input.total_amount_vnd,
      total_paid_vnd: input.total_paid_vnd ?? 0,
      payment_method: input.payment_method ?? null,
      notes: input.notes ?? null,
      received_at: input.received_at ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  invalidate(key.byProvider(input.provider_id));
  
  // Invalidate provider list so stats (total import/count) are refreshed
  invalidate(`providers:list:${accountId}`);

  // Auto-sync prices to provider_product_prices
  try {
    for (const item of input.items) {
      const productId = (item as Record<string, unknown>).product_id as string | undefined;
      const unitPrice = (item as Record<string, unknown>).unit_price_vnd as number | undefined;
      if (productId && unitPrice != null) {
        await upsertProviderProductPrice(
          accountId,
          input.provider_id,
          productId,
          unitPrice,
        );
      }
    }
  } catch {
    // Non-critical — don't fail PO creation if price sync fails
    console.warn('[PurchaseOrders] Price sync failed, skipping');
  }

  return data as PurchaseOrderRow;
}

export async function updatePurchaseOrder(
  id: string,
  accountId: string,
  input: Partial<{
    items: Record<string, unknown>[];
    status: string;
    total_amount_vnd: number;
    total_paid_vnd: number;
    payment_method: string;
    notes: string;
    received_at: string;
  }>,
): Promise<PurchaseOrderRow> {
  const current = await getPurchaseOrderById(id, accountId);
  const totalAmount = Number(input.total_amount_vnd ?? current.total_amount_vnd ?? 0);
  const totalPaid = Number(input.total_paid_vnd ?? current.total_paid_vnd ?? 0);
  const receivedAt = (input.received_at ?? current.received_at) ?? null;
  const normalizedStatus = resolvePurchaseOrderStatus({
    total_amount_vnd: totalAmount,
    total_paid_vnd: totalPaid,
    requested_status: input.status ?? current.status ?? null,
    received_at: receivedAt,
  });

  const { data, error } = await supabase
    .from('purchase_orders')
    .update({
      ...input,
      total_amount_vnd: totalAmount,
      total_paid_vnd: totalPaid,
      received_at: receivedAt,
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Purchase order not found');
  // Invalidate all related caches
  invalidate(key.list(accountId));
  invalidate(key.byProvider(data.provider_id));
  invalidate(`providers:list:${accountId}`);
  return data as PurchaseOrderRow;
}

export async function deletePurchaseOrder(
  id: string,
  accountId: string,
): Promise<void> {
  // Fetch first to get provider_id for cache invalidation
  const existing = await getPurchaseOrderById(id, accountId);
  assertPurchaseOrderDeletable(existing);
  const { error } = await supabase
    .from('purchase_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  invalidate(key.byProvider(existing.provider_id));
  invalidate(`providers:list:${accountId}`);
}
