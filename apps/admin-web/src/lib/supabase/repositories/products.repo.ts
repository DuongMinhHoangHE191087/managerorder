// ============================================================
// PRODUCTS REPOSITORY — Supabase
// Replaces in-memory: listProducts, createProduct,
//                     updateProduct, deleteProduct
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export type { ProductRow };

export interface TelegramProductSummary {
  id: string;
  name: string;
  sell_price_vnd: number | null;
  is_active: boolean | null;
  created_at: string | null;
}

const key = {
  list: (accountId: string) => `products:list:${accountId}`,
  item: (id: string, accountId: string) => `products:item:${id}:${accountId}`,
};

export async function listProducts(accountId: string): Promise<ProductRow[]> {
  return cached(
    key.list(accountId),
    async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    TTL.REFERENCE,
  );
}

export async function getProductById(
  id: string,
  accountId: string
): Promise<ProductRow | null> {
  return cached(
    key.item(id, accountId),
    async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .single();
      if (error) return null;
      return data;
    },
    TTL.ITEM,
  );
}

export async function createProduct(
  accountId: string,
  input: Omit<ProductInsert, 'account_id' | 'id' | 'created_at' | 'updated_at'>
): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, account_id: accountId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  return data;
}

export async function updateProduct(
  id: string,
  accountId: string,
  input: ProductUpdate
): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Product not found');
  invalidate(key.list(accountId));
  invalidate(key.item(id, accountId));
  return data;
}

export async function deleteProduct(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  invalidate(key.item(id, accountId));
}

export async function searchProductsForTelegram(
  query: string,
  accountId: string,
  limit = 5
): Promise<TelegramProductSummary[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  const { data, error } = await supabase
    .from('products')
    .select('id, name, sell_price_vnd, is_active, created_at')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .ilike('name', `%${keyword}%`)
    .order('is_active', { ascending: false })
    .order('name')
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as TelegramProductSummary[];
}

export async function listProductsForTelegram(
  accountId: string,
  page = 0,
  pageSize = 10,
  search?: string
): Promise<{ items: TelegramProductSummary[]; total: number }> {
  let query = supabase
    .from('products')
    .select('id, name, sell_price_vnd, is_active, created_at', { count: 'exact' })
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
    .order('name');

  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }

  const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw new Error(error.message);

  return {
    items: (data ?? []) as TelegramProductSummary[],
    total: count ?? data?.length ?? 0,
  };
}
