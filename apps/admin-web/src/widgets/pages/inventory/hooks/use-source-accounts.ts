import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import type { SourceAccount, WarehouseCredentialType } from "@/lib/domain/types";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { SlotBreakdownData } from "@/shared/types/inventory";
import { fetchRecoverableDetail } from "@/shared/lib/recoverable-detail";

export interface DecryptedSourceAccountCredential {
  id: string;
  type: WarehouseCredentialType;
  value: string;
  label?: string;
}

export interface DecryptedSourceAccountSecrets {
  id: string;
  email: string;
  password: string | null;
  credentials: DecryptedSourceAccountCredential[];
}

export function useSourceAccounts() {
  return useQuery({
    queryKey: queryKeys.sourceAccounts,
    queryFn: () => fetcher<SourceAccount[]>("/api/source-accounts"),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useSourceAccount(id: string, includeDeleted = false) {
  return useQuery({
    queryKey: [...queryKeys.sourceAccount(id), includeDeleted ? "trash" : "active"],
    queryFn: () => fetchRecoverableDetail<SourceAccount>(`/api/source-accounts/${id}`, includeDeleted),
    enabled: !!id,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

export function useSourceAccountDecrypt(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sourceAccountDecrypt(id),
    queryFn: () => fetcher<DecryptedSourceAccountSecrets>(`/api/source-accounts/${id}/decrypt`),
    enabled: enabled && !!id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) =>
      fetcher<SourceAccount>("/api/source-accounts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
    },
  });
}

export function useUpdateSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetcher<SourceAccount>(`/api/source-accounts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccount(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccountDecrypt(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.slotBreakdown(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccountConnections(variables.id) });
    },
  });
}

export function useDeleteSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetcher<SourceAccount>(`/api/source-accounts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
    },
  });
}

export function useSourceAccountConnections(id: string) {
  return useQuery({
    queryKey: queryKeys.sourceAccountConnections(id),
    queryFn: () =>
      fetcher<{ connected: Record<string, unknown>[]; unconnected: Record<string, unknown>[] }>(
        `/api/source-accounts/${id}/connections`,
      ),
    enabled: !!id,
    staleTime: 10_000,
    gcTime: 3 * 60_000,
  });
}

export function useDisconnectSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceAccountId,
      orderItemId,
      quantity,
    }: {
      sourceAccountId: string;
      orderItemId: string;
      quantity: number;
    }) =>
      fetcher(`/api/source-accounts/${sourceAccountId}/connections/disconnect`, {
        method: "POST",
        body: JSON.stringify({ orderItemId, quantity }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sourceAccountConnections(variables.sourceAccountId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
    },
  });
}

export function useReconnectSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceAccountId,
      orderItemId,
      quantity,
    }: {
      sourceAccountId: string;
      orderItemId: string;
      quantity: number;
    }) =>
      fetcher(`/api/source-accounts/${sourceAccountId}/connections/reconnect`, {
        method: "POST",
        body: JSON.stringify({ orderItemId, quantity }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sourceAccountConnections(variables.sourceAccountId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
    },
  });
}

export function useConnectSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceAccountId,
      orderItemId,
      quantity,
    }: {
      sourceAccountId: string;
      orderItemId: string;
      quantity: number;
    }) =>
      fetcher(`/api/source-accounts/${sourceAccountId}/connections/connect`, {
        method: "POST",
        body: JSON.stringify({ orderItemId, quantity }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sourceAccountConnections(variables.sourceAccountId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
      queryClient.invalidateQueries({
        queryKey: queryKeys.sourceAccount(variables.sourceAccountId),
      });
    },
  });
}

export function useAddReservedNick() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sourceAccountId, nick }: { sourceAccountId: string; nick: string }) =>
      fetcher(`/api/source-accounts/${sourceAccountId}/reserved-nicks`, {
        method: "POST",
        body: JSON.stringify({ nick }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sourceAccount(variables.sourceAccountId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
    },
  });
}

export function useRemoveReservedNick() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sourceAccountId, nick }: { sourceAccountId: string; nick: string }) =>
      fetcher(`/api/source-accounts/${sourceAccountId}/reserved-nicks`, {
        method: "DELETE",
        body: JSON.stringify({ nick }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sourceAccount(variables.sourceAccountId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
    },
  });
}

export function useRecalculateSlots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceAccountId: string) =>
      fetcher<{ previous: number; recalculated: number; changed: boolean }>(
        `/api/source-accounts/${sourceAccountId}`,
        { method: "PATCH" },
      ),
    onSuccess: (_, sourceAccountId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sourceAccount(sourceAccountId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.sourceAccountConnections(sourceAccountId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.slotBreakdown(sourceAccountId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
    },
  });
}

export function useSlotBreakdown(sourceAccountId: string) {
  return useQuery({
    queryKey: queryKeys.slotBreakdown(sourceAccountId),
    queryFn: () =>
      fetcher<SlotBreakdownData>(
        `/api/source-accounts/${sourceAccountId}/slot-breakdown`,
      ),
    enabled: !!sourceAccountId,
    staleTime: 15_000,
    gcTime: 3 * 60_000,
  });
}

export function useBatchRecalculateSlots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<{
        total: number;
        changed: number;
        results: Array<{
          id: string;
          email: string;
          previous: number;
          recalculated: number;
        }>;
      }>("/api/source-accounts/recalculate-all", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
    },
  });
}

export function useConnectionsEnriched(sourceAccountId: string) {
  return useQuery({
    queryKey: queryKeys.connectionsEnriched(sourceAccountId),
    queryFn: () =>
      fetcher<
        Array<{
          id: string;
          productId: string;
          productNameSnapshot: string;
          quantity: number;
          customerNickUsed: string | null;
          orderId: string;
          orderStatus: string;
          orderCreatedAt: string;
          customerId: string;
          customerName: string;
          customerContact: string | null;
        }>
      >(`/api/source-accounts/${sourceAccountId}/connections-enriched`),
    enabled: !!sourceAccountId,
    staleTime: 10_000,
    gcTime: 3 * 60_000,
  });
}
