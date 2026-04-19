import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import type { BotManagerStatus } from "@/lib/domain/types";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

export function useBotRuntimeStatus() {
  return useQuery({
    queryKey: queryKeys.botStatus,
    queryFn: () => fetcher<BotManagerStatus>("/api/settings/bot/status"),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}
