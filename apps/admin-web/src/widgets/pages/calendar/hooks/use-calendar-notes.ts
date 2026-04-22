import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";

export function useCalendarNotes() {
  const queryClient = useQueryClient();

  const noteQuery = useQuery({
    queryKey: ["calendar-notes"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/note", {
      });
      if (!res.ok) throw new Error("Không tải được ghi chú");
      const json = await res.json();
      return json.data as string;
    }
  });

  const saveNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/calendar/note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error("Thao tác thất bại");
      return res.json();
    },
    onSuccess: (_, newContent) => {
      queryClient.setQueryData(["calendar-notes"], newContent);
    },
    onError: () => {
      appToast.error("Không thể lưu ghi chú hiện tại");
    }
  });

  return { noteQuery, saveNoteMutation };
}

