import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import type { PaginatedLogsResponse, UseActivityLogsOptions } from "@/shared/types/activity-logs";

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const queryParams = new URLSearchParams();

  if (options.page) queryParams.append("page", options.page.toString());
  if (options.limit) queryParams.append("limit", options.limit.toString());
  if (options.search) queryParams.append("search", options.search);
  if (options.actionType) queryParams.append("actionType", options.actionType);
  if (options.customerId) queryParams.append("customerId", options.customerId);
  if (options.orderId) queryParams.append("orderId", options.orderId);
  if (options.sourceAccountId) queryParams.append("sourceAccountId", options.sourceAccountId);
  if (options.startDate) queryParams.append("startDate", options.startDate);
  if (options.endDate) queryParams.append("endDate", options.endDate);

  return useQuery({
    queryKey: [
      "activity-logs",
      options.page,
      options.limit,
      options.search,
      options.actionType,
      options.customerId,
      options.orderId,
      options.sourceAccountId,
      options.startDate,
      options.endDate,
    ],
    queryFn: () => fetcher<PaginatedLogsResponse>(`/api/activity-logs?${queryParams.toString()}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useInfiniteActivityLogs(options: UseActivityLogsOptions = {}) {
  return useInfiniteQuery({
    queryKey: [
      "infinite-activity-logs",
      options.limit,
      options.search,
      options.actionType,
      options.customerId,
      options.orderId,
      options.sourceAccountId,
      options.startDate,
      options.endDate,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", pageParam.toString());

      if (options.limit) queryParams.append("limit", options.limit.toString());
      if (options.search) queryParams.append("search", options.search);
      if (options.actionType) queryParams.append("actionType", options.actionType);
      if (options.customerId) queryParams.append("customerId", options.customerId);
      if (options.orderId) queryParams.append("orderId", options.orderId);
      if (options.sourceAccountId) queryParams.append("sourceAccountId", options.sourceAccountId);
      if (options.startDate) queryParams.append("startDate", options.startDate);
      if (options.endDate) queryParams.append("endDate", options.endDate);

      return fetcher<PaginatedLogsResponse>(`/api/activity-logs?${queryParams.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }

      return undefined;
    },
  });
}
