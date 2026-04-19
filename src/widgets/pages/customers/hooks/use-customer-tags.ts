import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";
import type { CustomerTag } from "@/shared/types/customers";

export function useCustomerTags() {
  return useQuery({
    queryKey: ["customer-tags"],
    queryFn: async () => {
      const res = await fetch("/api/customer-tags");
      if (!res.ok) {
        throw new Error("Failed to fetch tags");
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
        throw new Error(err.error || "Tao tag that bai");
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || "Da tao tag");
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
        throw new Error("Xoa tag that bai");
      }
      return res.json();
    },
    onSuccess: () => {
      appToast.success("Da xoa tag");
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
        throw new Error("Cap nhat tag that bai");
      }
      return res.json();
    },
    onSuccess: () => {
      appToast.success("Da cap nhat tag");
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
        throw new Error("Gan tag that bai");
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
        throw new Error("Gan tag hang loat that bai");
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || "Da gan tag");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-tags"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}
