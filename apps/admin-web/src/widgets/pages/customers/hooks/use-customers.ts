import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { Customer } from "@/lib/domain/types";

export function useCustomers() {
  return useQuery({
    queryKey: queryKeys.customers,
    queryFn: () => fetcher<Customer[]>("/api/customers"),
    staleTime: 30_000,        // 30s — avoid refetch on page revisit
    gcTime: 5 * 60_000,       // 5min — keep in cache after unmount
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      fetcher<Customer>("/api/customers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetcher<Customer>(`/api/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher<{ message: string }>(`/api/customers/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
}

// ── Batch Operations ──────────────────────────────────────

interface BatchDeleteResult {
  deletedCount: number;
}

interface BatchUpdateResult {
  updatedCount: number;
}

interface DependencyCheckResult {
  customersWithOrders: number;
  totalOrders: number;
}

export function useBatchDeleteCustomers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerIds: string[]) =>
      fetcher<BatchDeleteResult>("/api/customers/batch", {
        method: "POST",
        body: JSON.stringify({ action: "delete", customerIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
}

export function useBatchUpdateTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerIds,
      customerType,
    }: {
      customerIds: string[];
      customerType: "retail" | "wholesale" | "agency";
    }) =>
      fetcher<BatchUpdateResult>("/api/customers/batch", {
        method: "POST",
        body: JSON.stringify({
          action: "update_tier",
          customerIds,
          data: { customerType },
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
}

export function useCheckCustomerDependencies() {
  return useMutation({
    mutationFn: (customerIds: string[]) =>
      fetcher<DependencyCheckResult>("/api/customers/batch", {
        method: "POST",
        body: JSON.stringify({ action: "check_dependencies", customerIds }),
      }),
  });
}

// ── Customer 360° Stats ──────────────────────────────────

export interface Customer360Stats {
  customerId: string;
  totalOrders: number;
  totalSpentVnd: number;
  avgOrderValueVnd: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  ordersByStatus: Record<string, number>;
  totalPaymentsVnd: number;
  outstandingDebtVnd: number;
  segment: string;
  rfmScore: number;
  rfmRecency: number;
  rfmFrequency: number;
  rfmMonetary: number;
  lastRfmCalculatedAt: string | null;
  debtAmountVnd: number;
  debtOverdueDays: number;
  reliabilityScore: number;
}

export function useCustomer360Stats(customerId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customer360Stats(customerId),
    queryFn: () =>
      fetcher<Customer360Stats>(`/api/customers/${customerId}/stats`),
    enabled: enabled && !!customerId,
    staleTime: 60_000,         // 60s — stats change infrequently
    gcTime: 10 * 60_000,       // 10min
  });
}

// ── Debt Summary (Dashboard) ─────────────────────────────

export interface DebtSummary {
  totalDebtVnd: number;
  totalCustomers: number;
  customersWithDebt: number;
  overdueCustomers: number;
  avgReliabilityScore: number;
  aging: {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  };
  topDebtors: Array<{
    id: string;
    name: string;
    debtAmountVnd: number;
    overdueDays: number;
    segment: string;
  }>;
  segmentBreakdown: Record<string, { count: number; totalDebt: number }>;
}

export function useDebtSummary() {
  return useQuery({
    queryKey: queryKeys.debtSummary,
    queryFn: () => fetcher<DebtSummary>("/api/customers/debt-summary"),
    staleTime: 60_000,         // 60s — summary is expensive
    gcTime: 10 * 60_000,       // 10min
  });
}

// ── RFM Recalculation ────────────────────────────────────

interface RecalculateRfmResult {
  success: boolean;
  updatedCount: number;
  totalCustomers: number;
  calculatedAt: string;
}

export function useRecalculateRfm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetcher<RecalculateRfmResult>("/api/customers/recalculate-rfm", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers });
      queryClient.invalidateQueries({ queryKey: queryKeys.debtSummary });
    },
    onError: (error: Error) => {
      console.error("[useRecalculateRfm] Failed:", error.message);
    },
  });
}

// ── Realtime Subscription Hook ────────────────────────────────
import { useRealtimeSubscription } from "@/shared/lib/react-query/use-realtime-subscription";

/**
 * Subscribe to realtime customer changes. Call this once in the customers page
 * to auto-refresh data when any customer is created/updated/deleted.
 */
export function useCustomersRealtime(enabled = true) {
  return useRealtimeSubscription("customers", {
    queryKeys: [queryKeys.customers, queryKeys.debtSummary],
    enabled,
  });
}
