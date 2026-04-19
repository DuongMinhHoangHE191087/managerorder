"use client";

import { appToast } from "@/shared/lib/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

interface AllocateOrderButtonProps {
  orderId: string;
  onSuccess?: () => void;
}

export function AllocateOrderButton({ orderId, onSuccess }: AllocateOrderButtonProps) {
  const queryClient = useQueryClient();

  const { mutate: handleAllocate, isPending: isSubmitting } = useMutation({
    mutationFn: () => 
      fetcher<{ message?: string }>("/api/inventory/allocate", {
        method: "POST",
        body: JSON.stringify({ orderId, confirm: true }),
      }),
    onSuccess: (data) => {
      appToast.success(data?.message ?? "Cấp phát kho thành công");
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      appToast.error(error.message ?? "Không thể cấp phát kho");
    }
  });

  return (
    <button
      type="button"
      onClick={() => handleAllocate()}
      disabled={isSubmitting}
      className="inline-flex min-h-11 items-center rounded-lg border border-border-soft px-3 py-2 text-xs font-semibold text-fg-base transition-colors hover:bg-bg-surface-strong disabled:opacity-60"
    >
      {isSubmitting ? "Đang cấp phát..." : "Cấp phát"}
    </button>
  );
}
