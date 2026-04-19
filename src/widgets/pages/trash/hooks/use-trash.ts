import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";

// Types matching trash.repo.ts
type TrashEntityType = "customers" | "orders" | "products" | "providers" | "source_accounts" | "license_keys" | "short_links";

// Fetch deleted items by type
export function useTrashItems(type: TrashEntityType) {
  return useQuery({
    queryKey: ["trash", type],
    queryFn: async () => {
      const res = await fetch(`/api/trash?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch trash items");
      const json = await res.json();
      return json as { data: Record<string, unknown>[]; count: number; type: string };
    },
    staleTime: 30_000, // 30s — trash rarely changes
  });
}

// Fetch overview counts for all types
export function useTrashCounts() {
  return useQuery({
    queryKey: ["trash", "counts"],
    queryFn: async () => {
      const res = await fetch("/api/trash");
      if (!res.ok) throw new Error("Failed to fetch trash counts");
      const json = await res.json();
      return json.data as Record<TrashEntityType, number>;
    },
    staleTime: 30_000, // 30s
  });
}

// Restore items from trash
export function useRestoreItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, ids }: { type: TrashEntityType; ids: string[] }) => {
      const res = await fetch("/api/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Khôi phục thất bại");
      }
      return res.json();
    },
    onSuccess: (data, vars) => {
      appToast.success(data.message || `Đã khôi phục ${vars.ids.length} mục`);
      qc.invalidateQueries({ queryKey: ["trash"] });
      qc.invalidateQueries({ queryKey: [vars.type] });
      // Also invalidate the main entity list
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

// Purge items permanently
export function usePurgeItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, ids }: { type: TrashEntityType; ids: string[] }) => {
      const res = await fetch("/api/trash/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Xóa vĩnh viễn thất bại");
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || "Đã xóa vĩnh viễn");
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}
