import { useQuery } from "@tanstack/react-query";
import type { BotManagerStatus } from "@/lib/domain/types";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

async function fetchBotRuntimeStatus(): Promise<BotManagerStatus | null> {
  const response = await fetch("/api/settings/bot/status", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      typeof payload === "object" && payload && "error" in payload && typeof (payload as { error?: unknown }).error === "string"
        ? String((payload as { error: string }).error)
      : "Không thể tải trạng thái bot",
    );
  }

  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: BotManagerStatus | null }).data ?? null;
  }

  return null;
}

export function useBotRuntimeStatus() {
  return useQuery({
    queryKey: queryKeys.botStatus,
    queryFn: fetchBotRuntimeStatus,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}
