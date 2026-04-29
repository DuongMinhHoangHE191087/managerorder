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
} | CalendarEvent;

type CreateCalendarEventInput = {
  title: string;
  date: string;
  time?: string;
  notes?: string;
  type: string;
  customerIds?: string[];
  hasReminder?: boolean;
};

function isCalendarMutationEnvelope(
  res: CalendarMutationResponse,
): res is Extract<CalendarMutationResponse, { data: CalendarEvent }> {
  return typeof res === "object" && res !== null && "data" in res && Boolean(res.data);
}

/**
 * Show toast based on GCal sync result
 */
function unwrapCalendarEvent(res: CalendarMutationResponse): CalendarEvent {
  if (isCalendarMutationEnvelope(res)) {
    return res.data;
  }

  return res as CalendarEvent;
}

function getCalendarSyncMeta(res: CalendarMutationResponse) {
  if (isCalendarMutationEnvelope(res)) {
    return {
      gcalSyncStatus: res.gcalSyncStatus,
      gcalSyncError: res.gcalSyncError,
    };
  }

  return {
    gcalSyncStatus: undefined,
    gcalSyncError: undefined,
  };
}

function showGCalSyncFeedback(res: ReturnType<typeof getCalendarSyncMeta>) {
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
    mutationFn: (data: CreateCalendarEventInput) =>
      fetcher<CalendarMutationResponse>("/api/calendar", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendarEvents });
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(queryKeys.calendarEvents);
      const optimisticEvent: CalendarEvent = {
        id: `optimistic-${Date.now()}`,
        title: input.title,
        date: input.date,
        time: input.time,
        notes: input.notes,
        type: input.type,
        customerIds: input.customerIds ?? [],
        customers: [],
        hasReminder: input.hasReminder ?? false,
        isDone: false,
      };

      queryClient.setQueryData<CalendarEvent[]>(queryKeys.calendarEvents, (current = []) => [
        optimisticEvent,
        ...current,
      ]);

      return { previousEvents, optimisticId: optimisticEvent.id };
    },
    onError: (_error, _input, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(queryKeys.calendarEvents, context.previousEvents);
      }
    },
    onSuccess: (res, _input, context) => {
      const createdEvent = unwrapCalendarEvent(res);
      queryClient.setQueryData<CalendarEvent[]>(queryKeys.calendarEvents, (current = []) => {
        const safeCurrent = current.filter((event): event is CalendarEvent => Boolean(event?.id));
        const withoutOptimistic = safeCurrent.filter(
          (event) => event.id !== context?.optimisticId && event.id !== createdEvent.id,
        );
        return [createdEvent, ...withoutOptimistic];
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents });
      showGCalSyncFeedback(getCalendarSyncMeta(res));
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
      showGCalSyncFeedback(getCalendarSyncMeta(res));
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
