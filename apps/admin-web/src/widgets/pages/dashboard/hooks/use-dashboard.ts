// ============================================================
// DASHBOARD HOOKS — React Query integration for server-side stats
// ============================================================

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "../../../../shared/lib/react-query/query-keys";
import type { DashboardStats } from "../../../../shared/types/dashboard";

/**
 * Fetch pre-computed dashboard stats from server.
 * staleTime = 1 minute — avoids noisy refetches while keeping the dashboard fresh.
 * keepPreviousData smooths time-range changes without blanking the panel.
 */
export function useDashboardStats(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.dashboardStats(days),
    queryFn: ({ signal }) => fetcher<DashboardStats>(`/api/dashboard/stats?days=${days}`, { signal }),
    staleTime: 60 * 1000,           // 1 minute
    gcTime: 10 * 60 * 1000,         // 10 minutes garbage collection
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

/**
 * Manual refresh — invalidates all dashboard queries to force re-fetch.
 * Used by the "Tính lại" button on the dashboard.
 */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();

  return {
    refresh: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    isRefreshing:
      queryClient.isFetching({ queryKey: queryKeys.dashboard }) > 0,
  };
}

