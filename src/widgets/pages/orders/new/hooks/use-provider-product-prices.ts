// ============================================================
// HOOK: Provider Product Prices
// Fetch NCC prices for a specific product (for dropdown in form)
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";

export interface ProviderPrice {
  id: string;
  provider_id: string;
  product_id: string;
  cost_vnd: number;
  updated_at: string;
  provider_name: string;
}

/**
 * Fetch provider prices for a product.
 * Disabled when no productId is given.
 */
export function useProviderPrices(productId: string | undefined) {
  return useQuery({
    queryKey: ["provider-product-prices", productId],
    queryFn: () =>
      fetcher<ProviderPrice[]>(
        `/api/provider-product-prices?productId=${productId}`
      ),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}
