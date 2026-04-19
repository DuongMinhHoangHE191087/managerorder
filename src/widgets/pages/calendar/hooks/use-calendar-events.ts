import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { CalendarEvent } from "@/lib/domain/types";
import { appToast } from "@/shared/ui/app-toast";

// API response includes GCal sync info
type CalendarMutationResponse = {
  data: CalendarEvent;
  gcalSyncStatus?: "synced" | "failed" | "not_connected";
  gcalSyncError?: string;
};

/**
 * Show toast based on GCal sync result
 */
function showGCalSyncFeedback(res: CalendarMutationResponse) {
  if (res.gcalSyncStatus === "synced") {
    appToast.success("Đã đồng bộ Google Calendar", {
      description: "Sự kiện đã được cập nhật trên GCal.",
      duration: 3000,
    });
  } else if (res.gcalSyncStatus === "failed") {
    appToast.warning("Không thể đồng bộ Google Calendar", {
      description: res.gcalSyncError || "Vui lòng kiểm tra kết nối GCal.",
      duration: 5000,
    });
  }
  // "not_connected" = silent, user hasn't connected GCal
}

export function useCalendarEvents() {
  return useQuery({
    queryKey: queryKeys.calendarEvents,
    queryFn: () => fetcher<CalendarEvent[]>("/api/calendar"),
    staleTime: 30_000, // 30s — calendar events need to be fresh
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      date: string;
      time?: string;
      notes?: string;
      type: string;
      customerIds?: string[];
      hasReminder?: boolean;
    }) =>
      fetcher<CalendarMutationResponse>("/api/calendar", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents });
      showGCalSyncFeedback(res);
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetcher<CalendarMutationResponse>(`/api/calendar?id=${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents });
      showGCalSyncFeedback(res);
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/calendar?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents });
    },
  });
}
