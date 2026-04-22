import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";
import type { CustomerTag } from "@/shared/types/customers";
import { vi } from "@/shared/messages/vi";

export function useCustomerTags() {
  return useQuery({
    queryKey: ["customer-tags"],
    queryFn: async () => {
      const res = await fetch("/api/customer-tags");
      if (!res.ok) {
        throw new Error(vi.common.serverError);
      }
      const json = await res.json();
      return json.data as CustomerTag[];
    },
    staleTime: 2 * 60_000,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      const res = await fetch("/api/customer-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...input }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || vi.customers.tags.errors.createFailed);
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || vi.customers.tags.success.created);
      qc.invalidateQueries({ queryKey: ["customer-tags"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customer-tags/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(vi.customers.tags.errors.deleteFailed);
      }
      return res.json();
    },
    onSuccess: () => {
      appToast.success(vi.customers.tags.success.deleted);
      qc.invalidateQueries({ queryKey: ["customer-tags"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; color?: string }) => {
      const res = await fetch(`/api/customer-tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new Error(vi.customers.tags.errors.updateFailed);
      }
      return res.json();
    },
    onSuccess: () => {
      appToast.success(vi.customers.tags.success.updated);
      qc.invalidateQueries({ queryKey: ["customer-tags"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

export function useAssignTags() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      tagIds,
    }: {
      customerId: string;
      tagIds: string[];
    }) => {
      const res = await fetch("/api/customer-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", customerId, tagIds }),
      });
      if (!res.ok) {
        throw new Error(vi.customers.tags.errors.assignFailed);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-tags"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

export function useBatchAssignTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerIds,
      tagId,
    }: {
      customerIds: string[];
      tagId: string;
    }) => {
      const res = await fetch("/api/customer-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_assign", customerIds, tagId }),
      });
      if (!res.ok) {
        throw new Error(vi.customers.tags.errors.batchAssignFailed);
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || vi.customers.tags.success.assigned);
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-tags"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}
