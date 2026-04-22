"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";
import type { RenewalItem } from "@/shared/types/premium";

// Fetch renewals from API (30-day window)
async function fetchRenewals(): Promise<RenewalItem[]> {
  const res = await fetch(
    `/api/premium/subscriptions/expiring?days_threshold=30&limit=100`
  );

  if (!res.ok) {
    throw new Error("Không tải được dữ liệu gia hạn");
  }

  const json = await res.json();
  const rows = (json.data ?? []) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id ?? ""),
    customer_name:
      (row.customers as Record<string, unknown> | null)?.name as string | undefined ??
      (row.customer_id as string | undefined),
    customer_email:
      (row.customers as Record<string, unknown> | null)?.email as string | undefined,
    service_name:
      (row.premium_service_types as Record<string, unknown> | null)?.name as string | undefined,
    package_name:
      (row.premium_packages as Record<string, unknown> | null)?.name as string | undefined,
    expiry_date: String(row.expiry_date ?? ""),
    days_remaining: typeof row.days_remaining === "number" ? row.days_remaining : 0,
    billing_cycle: row.billing_cycle as string | undefined,
    final_price: typeof row.final_price === "number" ? row.final_price : undefined,
    renewal_status: row.renewal_status as string | undefined,
  }));
}

/**
 * React Query hook for renewal subscriptions data.
 * Replaces the imperative fetch in calendar/page.tsx.
 */
export function useRenewals() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["renewals"],
    queryFn: fetchRenewals,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const requestRenewalMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await fetch(`/api/premium/subscriptions/${subscriptionId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Không gửi được yêu cầu gia hạn");
      return subscriptionId;
    },
    onSuccess: (subscriptionId) => {
      appToast.success("Đã gửi yêu cầu gia hạn!");
      // Optimistic update
      queryClient.setQueryData<RenewalItem[]>(["renewals"], (old) =>
        old?.map(i => i.id === subscriptionId ? { ...i, renewal_status: "pending" } : i) ?? []
      );
    },
    onError: () => {
      appToast.error("Không gửi được yêu cầu gia hạn");
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      // Optimistic: remove from list
      return subscriptionId;
    },
    onSuccess: (subscriptionId) => {
      appToast.success("Đã đánh dấu đã thanh toán thành công!");
      queryClient.setQueryData<RenewalItem[]>(["renewals"], (old) =>
        old?.filter(i => i.id !== subscriptionId) ?? []
      );
    },
  });

  return {
    renewals: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    requestRenewal: requestRenewalMutation.mutateAsync,
    markAsPaid: markAsPaidMutation.mutateAsync,
  };
}
