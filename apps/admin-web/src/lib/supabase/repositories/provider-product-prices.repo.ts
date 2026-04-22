// ============================================================
// PROVIDER PRODUCT PRICES REPOSITORY
// Stores last-known cost per provider-product pair
// Auto-updated when creating Purchase Orders or Sales Orders
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';

export interface ProviderProductPriceRow {
  id: string;
  account_id: string;
  provider_id: string;
  product_id: string;
  cost_vnd: number;
  updated_at: string;
}

/** Extended row with provider name for dropdown display */
export interface ProviderPriceWithName extends ProviderProductPriceRow {
  provider_name: string;
}

const cacheKey = {
  byProduct: (accountId: string, productId: string) =>
    `ppp:product:${accountId}:${productId}`,
};

/**
 * Get all provider prices for a specific product.
 * Returns provider name alongside cost for UI dropdown.
 */
export async function getProviderPricesForProduct(
  accountId: string,
  productId: string,
): Promise<ProviderPriceWithName[]> {
  return cached(
    cacheKey.byProduct(accountId, productId),
    async () => {
      const { data, error } = await supabase
        .from('provider_product_prices')
        .select('*')
        .eq('account_id', accountId)
        .eq('product_id', productId)
        .order('updated_at', { ascending: false });

      if (error) throw new Error(error.message);

      const providerIds = [...new Set((data ?? []).map((row) => row.provider_id).filter(Boolean))];
      const providerMap = await loadRowsByIds<{ id: string; name: string }>(
        supabase,
        'providers',
        accountId,
        providerIds,
        'id, name',
      );

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        account_id: row.account_id as string,
        provider_id: row.provider_id as string,
        product_id: row.product_id as string,
        cost_vnd: Number(row.cost_vnd),
        updated_at: row.updated_at as string,
        provider_name: providerMap.get(row.provider_id as string)?.name ?? 'Unknown',
      }));
    },
    TTL.LIST,
  );
}

/**
 * Upsert a provider-product price (insert or update on conflict).
 * Called automatically when Purchase Orders or Sales Orders are created.
 */
export async function upsertProviderProductPrice(
  accountId: string,
  providerId: string,
  productId: string,
  costVnd: number,
): Promise<void> {
  const { error } = await supabase
    .from('provider_product_prices')
    .upsert(
      {
        account_id: accountId,
        provider_id: providerId,
        product_id: productId,
        cost_vnd: costVnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,provider_id,product_id' },
    );

  if (error) throw new Error(error.message);
  invalidate(cacheKey.byProduct(accountId, productId));
}
