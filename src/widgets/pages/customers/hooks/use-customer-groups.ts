import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";
import type { CustomerGroup } from "@/shared/types/customers";

export function useCustomerGroups() {
  return useQuery({
    queryKey: ["customer-groups"],
    queryFn: async () => {
      const res = await fetch("/api/customer-groups");
      if (!res.ok) {
        throw new Error("Failed to fetch groups");
      }
      const json = await res.json();
      return json.data as CustomerGroup[];
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; color?: string; description?: string }) => {
      const res = await fetch("/api/customer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...input }),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error || "Tao nhom that bai");
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || "Da tao nhom");
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

export function useAssignToGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      customerIds,
    }: {
      groupId: string;
      customerIds: string[];
    }) => {
      const res = await fetch("/api/customer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", groupId, customerIds }),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error || "Gan nhom that bai");
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || "Da gan nhom");
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

export function useRemoveFromGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (customerIds: string[]) => {
      const res = await fetch("/api/customer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", customerIds }),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error || "Go nhom that bai");
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || "Da go khoi nhom");
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      color?: string;
      description?: string;
    }) => {
      const res = await fetch(`/api/customer-groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new Error("Cap nhat nhom that bai");
      }
      return res.json();
    },
    onSuccess: () => {
      appToast.success("Da cap nhat nhom");
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customer-groups/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Xoa nhom that bai");
      }
      return res.json();
    },
    onSuccess: () => {
      appToast.success("Da xoa nhom");
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}
