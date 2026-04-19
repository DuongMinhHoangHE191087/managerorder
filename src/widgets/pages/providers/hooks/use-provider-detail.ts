// ============================================================
// PROVIDER DETAIL HOOKS - React Query for Provider 360 page
// Mirrors use-customer-detail.ts pattern
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import type { Provider } from "@/lib/domain/types";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { ProviderPurchaseOrder } from "@/shared/types/providers";

/**
 * Fetch single provider by ID.
 */
export function useProviderDetail(providerId: string) {
  return useQuery({
    queryKey: queryKeys.provider(providerId),
    queryFn: async () => {
      const res = await fetcher<Provider>(`/api/providers/${providerId}`);
      return res;
    },
    enabled: !!providerId,
    staleTime: 30_000,
  });
}

/**
 * Fetch purchase orders for a specific provider.
 */
export function useProviderPurchaseOrders(providerId: string) {
  return useQuery({
    queryKey: queryKeys.providerPurchaseOrders(providerId),
    queryFn: async () => {
      const rows = await fetcher<Record<string, unknown>[]>(
        `/api/purchase-orders?provider_id=${providerId}`,
      );
      return (rows ?? []).map(mapToProviderPO);
    },
    enabled: !!providerId,
    staleTime: 30_000,
  });
}

/**
 * Create a new purchase order.
 */
export function useCreatePurchaseOrder(providerId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      items: { productId: string; productName?: string; quantity: number; priceVnd: number }[];
      totalAmountVnd: number;
      paymentMethod?: string;
      notes?: string;
      importDate?: string;
    }) => {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          items: input.items,
          total_amount_vnd: input.totalAmountVnd,
          payment_method: input.paymentMethod,
          notes: input.notes,
          import_date: input.importDate,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to create purchase order");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.providerPurchaseOrders(providerId) });
      qc.invalidateQueries({ queryKey: queryKeys.provider(providerId) });
      qc.invalidateQueries({ queryKey: queryKeys.purchaseOrders });
    },
  });
}

/**
 * Record payment for a purchase order.
 */
export function usePurchaseOrderPayment(providerId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      amount,
    }: {
      purchaseOrderId: string;
      amount: number;
    }) => {
      const getRes = await fetch(`/api/purchase-orders/${purchaseOrderId}`);
      if (!getRes.ok) {
        throw new Error("Failed to fetch purchase order");
      }

      const { data: currentPO } = await getRes.json();
      const newTotalPaid =
        Number(currentPO.totalPaidVnd ?? currentPO.total_paid_vnd ?? 0) + amount;
      const totalAmount = Number(
        currentPO.totalAmountVnd ?? currentPO.total_amount_vnd ?? 0,
      );

      const updateRes = await fetch(`/api/purchase-orders/${purchaseOrderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_paid_vnd: newTotalPaid,
          status: newTotalPaid > 0 ? "partial" : "pending",
        }),
      });
      if (!updateRes.ok) {
        throw new Error("Payment failed");
      }

      return {
        ...(await updateRes.json()),
        fully_paid: newTotalPaid >= totalAmount,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.providerPurchaseOrders(providerId) });
      qc.invalidateQueries({ queryKey: queryKeys.provider(providerId) });
    },
  });
}

function mapToProviderPO(o: Record<string, unknown>): ProviderPurchaseOrder {
  return {
    id: String(o.id),
    status: String(o.status ?? "pending"),
    payment_method: String(o.paymentMethod ?? o.payment_method ?? ""),
    total_amount: Number(o.totalAmountVnd ?? o.total_amount_vnd ?? 0),
    total_paid: Number(o.totalPaidVnd ?? o.total_paid_vnd ?? 0),
    items: Array.isArray(o.items) ? (o.items as ProviderPurchaseOrder["items"]) : [],
    created_at: String(o.createdAt ?? o.created_at ?? ""),
    received_at: o.receivedAt
      ? String(o.receivedAt)
      : o.received_at
        ? String(o.received_at)
        : undefined,
    notes: o.notes ? String(o.notes) : undefined,
  };
}
