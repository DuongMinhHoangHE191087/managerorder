// ============================================================
// HOOK: Product Profit Report
// Dashboard aggregate: revenue vs cost vs profit per product
// ============================================================

import { useQuery } from "@tanstack/react-query";

export interface ProductProfitRow {
  productId: string;
  productName: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  roiPercent: number | null;
  orderCount: number;
  totalQuantity: number;
}

export interface ProductProfitSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgRoi: number | null;
}

export interface ProductProfitResponse {
  data: ProductProfitRow[];
  summary: ProductProfitSummary;
}

export function useProductProfit(days: number = 30) {
  return useQuery({
    queryKey: ["product-profit", days],
    queryFn: async (): Promise<ProductProfitResponse> => {
      const res = await fetch(`/api/dashboard/product-profit?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch product profit");
      const json = await res.json();
      // API wraps via createSuccessResponse → { data: { data:[], summary:{} } }
      const payload = json.data ?? json;
      return payload as ProductProfitResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}
