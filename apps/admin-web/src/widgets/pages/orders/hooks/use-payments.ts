// ============================================================
// usePayments - React Query hook for order payment history
// ============================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { PaymentRecord } from "@/shared/types/orders";

/**
 * Fetch all individual payment records for an order.
 */
export function usePayments(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.payments(orderId ?? ""),
    queryFn: () => fetcher<PaymentRecord[]>(`/api/orders/${orderId}/payments`),
    enabled: !!orderId,
    staleTime: 30_000,
  });
}
