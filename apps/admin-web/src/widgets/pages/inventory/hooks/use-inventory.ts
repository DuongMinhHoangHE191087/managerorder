import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { LicenseKey } from "@/lib/domain/types";
import type { z } from "zod";
import type { createLicenseKeyInputSchema } from "@/lib/domain/schemas";
import { fetchRecoverableDetail, type RecoverableDetail } from "@/shared/lib/recoverable-detail";

type CreateLicenseKeyInput = z.infer<typeof createLicenseKeyInputSchema>;

export interface InventoryLicenseKeyDetail extends LicenseKey {
  account_id?: string;
  assigned_at?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  order_id?: string | null;
  updated_at?: string | null;
}

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.inventory,
    queryFn: () => fetcher<LicenseKey[]>("/api/inventory"),
    staleTime: 15_000,        // 15s — inventory changes more frequently
    gcTime: 3 * 60_000,       // 3min
  });
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLicenseKeyInput) =>
      fetcher<LicenseKey[]>("/api/inventory", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetcher<LicenseKey>(`/api/inventory/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_updated, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItem(variables.id) });
    },
  });
}

export function useDeleteInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher<LicenseKey>(`/api/inventory/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItem(id) });
    },
  });
}

export function useInventoryKeyDetail(id: string | null, includeDeleted = false) {
  return useQuery<RecoverableDetail<InventoryLicenseKeyDetail>>({
    queryKey: id ? [...queryKeys.inventoryItem(id), includeDeleted ? "trash" : "active"] : ["inventory", "detail", "missing"],
    queryFn: () => fetchRecoverableDetail<InventoryLicenseKeyDetail>(`/api/inventory/${id}`, includeDeleted),
    enabled: !!id,
    staleTime: 15_000,
    gcTime: 3 * 60_000,
  });
}

// ── Realtime Subscription Hook ────────────────────────────────
import { useRealtimeSubscription } from "@/shared/lib/react-query/use-realtime-subscription";

/**
 * Subscribe to realtime source_accounts changes. Call this once in the
 * inventory page to auto-refresh data when accounts are modified.
 */
export function useInventoryRealtime(enabled = true) {
  return useRealtimeSubscription("source_accounts", {
    queryKeys: [queryKeys.inventory, queryKeys.sourceAccounts],
    enabled,
  });
}

