"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import type { RefundMode } from "@/lib/domain/types";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { RefundRequest } from "@/shared/types/orders";

/**
 * List all refund requests for an order.
 */
export function useRefunds(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.refunds(orderId ?? ""),
    queryFn: () => fetcher<RefundRequest[]>(`/api/orders/${orderId}/refunds`),
    enabled: !!orderId,
  });
}

/**
 * Create a new refund request.
 */
export function useCreateRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      orderId: string;
      refund_mode?: RefundMode;
      consumed_days?: number;
      total_days?: number;
      reason?: string;
    }) =>
      fetcher<RefundRequest>(`/api/orders/${data.orderId}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          refund_mode: data.refund_mode,
          consumed_days: data.consumed_days,
          total_days: data.total_days,
          reason: data.reason,
        }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(variables.orderId) });
    },
  });
}

/**
 * Update refund status (approve, process, complete, reject).
 */
export function useUpdateRefundStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      orderId: string;
      refundId: string;
      status: string;
      admin_note?: string;
    }) =>
      fetcher<RefundRequest>(
        `/api/orders/${data.orderId}/refunds/${data.refundId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: data.status,
            admin_note: data.admin_note,
          }),
        },
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(variables.orderId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.orderStatusHistory(variables.orderId),
      });
    },
  });
}
