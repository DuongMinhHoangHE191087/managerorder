import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

// Types matching trash.repo.ts
type TrashEntityType = "customers" | "orders" | "products" | "providers" | "source_accounts" | "license_keys" | "short_links";

const TRASH_INVALIDATION_TARGETS: Record<TrashEntityType, readonly (readonly unknown[])[]> = {
  customers: [
    queryKeys.customers,
  ],
  orders: [
    queryKeys.orders,
  ],
  products: [
    queryKeys.products,
    queryKeys.inventory,
    queryKeys.inventoryDashboard,
  ],
  providers: [
    queryKeys.providers,
    queryKeys.purchaseOrders,
  ],
  source_accounts: [
    queryKeys.sourceAccounts,
    queryKeys.inventory,
    queryKeys.inventoryDashboard,
  ],
  license_keys: [
    queryKeys.inventory,
    queryKeys.inventoryDashboard,
  ],
  short_links: [
    ["short-links"],
    ["short-link-detail"],
    queryKeys.salesChannels,
  ],
};

async function invalidateTrashRelatedQueries(
  qc: ReturnType<typeof useQueryClient>,
  type: TrashEntityType,
) {
  const targets = [
    ["trash"] as const,
    ...TRASH_INVALIDATION_TARGETS[type],
  ];

  await Promise.all(
    targets.map((queryKey) =>
      qc.invalidateQueries({
        queryKey,
        refetchType: "active",
      }),
    ),
  );
}

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
      void invalidateTrashRelatedQueries(qc, vars.type);
      appToast.success(data.message || `Đã khôi phục ${vars.ids.length} mục`);
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
    onSuccess: (data, vars) => {
      void invalidateTrashRelatedQueries(qc, vars.type);
      appToast.success(data.message || "Đã xóa vĩnh viễn");
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}
