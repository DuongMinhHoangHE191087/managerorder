import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { OrderStats } from "@/lib/supabase/repositories/orders.repo";

export interface UseOrdersOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    count: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Using any since there isn't a strict exported ApiOrder type in domain/types.ts yet
export function useOrders(options: UseOrdersOptions = {}) {
  // Use a stable query key that includes the options
  const queryKey = [...queryKeys.orders, options];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.page) params.append("page", options.page.toString());
      if (options.limit) params.append("limit", options.limit.toString());
      if (options.search) params.append("search", options.search);
      if (options.status) params.append("status", options.status);
      if (options.customer_id) params.append("customer_id", options.customer_id);
      if (options.date_from) params.append("date_from", options.date_from);
      if (options.date_to) params.append("date_to", options.date_to);
      
      const queryString = params.toString() ? `?${params.toString()}` : "";
      return fetcher<PaginatedResponse<unknown>>(`/api/orders${queryString}`);
    },
    // Keep previous data while fetching new pages to avoid UI flickering
    placeholderData: keepPreviousData,
    staleTime: 10_000,        // 10s — orders change frequently
    gcTime: 3 * 60_000,       // 3min
  });
}

// ── Aggregated Stats Hook ─────────────────────────────────────────────────
export function useOrderStats(options: Omit<UseOrdersOptions, 'page' | 'limit'> = {}) {
  return useQuery({
    queryKey: [...queryKeys.orders, "stats", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.search) params.append("search", options.search);
      if (options.status) params.append("status", options.status);
      if (options.customer_id) params.append("customer_id", options.customer_id);
      if (options.date_from) params.append("date_from", options.date_from);
      if (options.date_to) params.append("date_to", options.date_to);
      
      const queryString = params.toString() ? `?${params.toString()}` : "";
      // fetcher already unwraps { data: ... } from API response
      return fetcher<OrderStats>(`/api/orders/stats${queryString}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,        // 15s — stats are less volatile
    gcTime: 5 * 60_000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => fetcher<unknown>(`/api/orders/${id}`),
    enabled: !!id,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      fetcher<unknown>("/api/orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // queryKeys.orders prefix invalidates all order queries including stats
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesChannels });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetcher<unknown>(`/api/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      // queryKeys.orders prefix invalidates orders list + stats + specific order
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.orderStatusHistory(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesChannels });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher<unknown>(`/api/orders/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesChannels });
    },
  });
}

// ── Batch Delete Hook ─────────────────────────────────────────────────────
export function useBatchDeleteOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      fetcher<unknown>("/api/orders/batch", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.salesChannels });
    },
  });
}

// ── Export Hook ────────────────────────────────────────────────────────────
export function useExportOrders() {
  return {
    exportCSV: async (options: Omit<UseOrdersOptions, 'page' | 'limit'> = {}) => {
      const params = new URLSearchParams();
      if (options.search) params.append("search", options.search);
      if (options.status) params.append("status", options.status);
      if (options.customer_id) params.append("customer_id", options.customer_id);
      if (options.date_from) params.append("date_from", options.date_from);
      if (options.date_to) params.append("date_to", options.date_to);
      
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/orders/export${queryString}`);
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}

// ── Realtime Subscription Hook ────────────────────────────────
import { useRealtimeSubscription } from "@/shared/lib/react-query/use-realtime-subscription";

/**
 * Subscribe to realtime order changes. Call this once in the orders page
 * to auto-refresh data when any order is created/updated/deleted.
 */
export function useOrdersRealtime(enabled = true) {
  return useRealtimeSubscription("orders", {
    queryKeys: [queryKeys.orders],
    enabled,
  });
}

