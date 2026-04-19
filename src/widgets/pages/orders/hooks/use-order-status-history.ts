"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

export interface StatusHistoryEntry {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  change_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Fetch the full status transition history for a specific order.
 * Returns an array of entries ordered chronologically (oldest first).
 */
export function useOrderStatusHistory(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.orderStatusHistory(orderId ?? ""),
    queryFn: () =>
      fetcher<StatusHistoryEntry[]>(`/api/orders/${orderId}/status-history`),
    enabled: !!orderId,
  });
}

/**
 * Invalidate status history after a status change.
 */
export function useInvalidateOrderStatusHistory() {
  const queryClient = useQueryClient();
  return (orderId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.orderStatusHistory(orderId),
    });
  };
}
