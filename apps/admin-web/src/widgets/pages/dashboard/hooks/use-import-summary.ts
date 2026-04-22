// ============================================================
// HOOK: Import Summary (Purchase Orders by month)
// ============================================================

import { useQuery } from "@tanstack/react-query";

export interface ImportSummaryMonth {
  month: string;
  label: string;
  orderCount: number;
  totalAmountVnd: number;
  avgPerOrder: number;
}

export interface ImportSummaryResponse {
  data: ImportSummaryMonth[];
  summary: {
    totalOrders: number;
    totalAmountVnd: number;
    avgPerOrder: number;
  };
}

export function useImportSummary(months: number = 6) {
  return useQuery({
    queryKey: ["import-summary", months],
    queryFn: async (): Promise<ImportSummaryResponse> => {
      const res = await fetch(`/api/dashboard/import-summary?months=${months}`);
      if (!res.ok) throw new Error("Failed to fetch import summary");
      const json = await res.json();
      // API wraps via createSuccessResponse → { data: { data:[], summary:{} } }
      const payload = json.data ?? json;
      return payload as ImportSummaryResponse;
    },
    staleTime: 5 * 60 * 1000,
  });
}
