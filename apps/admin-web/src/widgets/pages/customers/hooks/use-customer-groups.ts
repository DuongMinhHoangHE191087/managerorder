import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";
import type { CustomerGroup } from "@/shared/types/customers";
import { vi } from "@/shared/messages/vi";

export function useCustomerGroups() {
  return useQuery({
    queryKey: ["customer-groups"],
    queryFn: async () => {
      const res = await fetch("/api/customer-groups");
      if (!res.ok) {
        throw new Error(vi.common.serverError);
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
        throw new Error((await res.json().catch(() => ({}))).error || vi.customers.groups.errors.createFailed);
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || vi.customers.groups.success.created);
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
        throw new Error((await res.json().catch(() => ({}))).error || vi.customers.groups.errors.assignFailed);
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || vi.customers.groups.success.assigned);
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
        throw new Error((await res.json().catch(() => ({}))).error || vi.customers.groups.errors.removeFailed);
      }
      return res.json();
    },
    onSuccess: (data) => {
      appToast.success(data.message || vi.customers.groups.success.removed);
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
        throw new Error(vi.customers.groups.errors.updateFailed);
      }
      return res.json();
    },
    onSuccess: () => {
      appToast.success(vi.customers.groups.success.updated);
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
        throw new Error(vi.customers.groups.errors.deleteFailed);
      }
      return res.json();
    },
    onSuccess: () => {
      appToast.success(vi.customers.groups.success.deleted);
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => appToast.error(err.message),
  });
}
