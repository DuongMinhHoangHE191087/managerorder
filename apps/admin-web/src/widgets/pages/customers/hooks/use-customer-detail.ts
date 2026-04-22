// ============================================================
// CUSTOMER DETAIL HOOKS - React Query for Customer 360 page
// Replaces raw fetch for proper cache invalidation and UX
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { buildFinancialSummary } from "@/lib/domain/financial";
import type { Customer } from "@/lib/domain/types";
import type { CustomerOrder } from "@/shared/types/customers";

interface OrdersApiResponse {
  data: Record<string, unknown>[];
}

/**
 * Fetch single customer by ID with React Query caching.
 */
export function useCustomerDetail(customerId: string, enabled = true) {
  return useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const res = await fetcher<Customer>(`/api/customers/${customerId}`);
      return res;
    },
    enabled: enabled && !!customerId,
    staleTime: 30_000,
  });
}

/**
 * Fetch orders for a specific customer.
 */
export function useCustomerOrders(customerId: string, enabled = true) {
  return useQuery({
    queryKey: ["customer-orders", customerId],
    queryFn: async () => {
      const res = await fetcher<OrdersApiResponse>(
        `/api/orders?customer_id=${customerId}`,
      );
      return ((res.data ?? []) as Record<string, unknown>[]).map(mapToCustomerOrder);
    },
    enabled: enabled && !!customerId,
    staleTime: 30_000,
  });
}

/**
 * Record payment for an order, then invalidate relevant caches.
 */
export function useOrderPayment(customerId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
    }: {
      orderId: string;
      amount: number;
    }) => {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const payload = await res.json();

      if (!res.ok) {
        const serverMsg =
      payload?.error?.message ?? payload?.error ?? "Lỗi ghi nhận thanh toán";
        throw new Error(serverMsg);
      }

      return payload;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      qc.invalidateQueries({ queryKey: ["customer-orders", customerId] });
      qc.invalidateQueries({ queryKey: ["payments", variables.orderId] });
    },
  });
}

function mapToCustomerOrder(o: Record<string, unknown>): CustomerOrder {
  const financial = buildFinancialSummary({
    total_amount_vnd: Number(o.total_amount_vnd ?? o.total_amount ?? 0),
    total_paid: Number(o.total_paid ?? 0),
    payment_terms: String(o.payment_terms ?? o.payment_method ?? ""),
    payment_method: String(o.payment_method ?? ""),
    created_at: String(o.created_at ?? ""),
  });

  return {
    id: String(o.id),
    status: String(o.status ?? "pending_payment"),
    payment_method: String(o.payment_method ?? ""),
    payment_terms: financial.payment_terms,
    payment_state: financial.payment_state,
    balance_due_vnd: financial.balance_due_vnd,
    is_fully_paid: financial.is_fully_paid,
    total_amount: Number(o.total_amount_vnd ?? o.total_amount ?? 0),
    total_paid: Number(o.total_paid ?? 0),
    items: Array.isArray(o.items)
      ? (o.items as CustomerOrder["items"])
      : [
          {
            productName: String(o.product_id ?? ""),
            quantity: Number(o.quantity ?? 1),
          },
        ],
    created_at: String(o.created_at ?? ""),
    sales_note: o.sales_note ? String(o.sales_note) : undefined,
  };
}
