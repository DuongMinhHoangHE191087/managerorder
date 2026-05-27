import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

export type AccountShareFieldType =
  | "email"
  | "password"
  | "link_join"
  | "2fa"
  | "2fa_backup"
  | "duolingo_id"
  | "other";

export interface AccountShareLink {
  id: string;
  sourceAccountId: string;
  orderId: string | null;
  orderItemId: string | null;
  customerId: string | null;
  slug: string;
  title: string | null;
  status: "active" | "disabled" | "expired";
  expiresAt: string | null;
  maxViews: number;
  viewCount: number;
  maxUnlocks: number;
  unlockCount: number;
  passcodeRequired: boolean;
  exposurePolicy: {
    fields: AccountShareFieldType[];
    credentialIds?: string[];
    includeLabels?: boolean;
  };
  accessPolicy: {
    requirePasscode: boolean;
    allowNoPasscode?: boolean;
    lockToIp?: boolean;
  };
  publicUrl: string;
  createdAt: string;
}

export interface AccountShareAccessLog {
  id: string;
  linkId: string;
  accountId: string;
  eventType: "unlock" | "view" | "copy" | "totp_view" | "blocked";
  ipAddress: string | null;
  ipVersion: string | null;
  userAgent: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface CreateAccountShareInput {
  sourceAccountId: string;
  orderId?: string | null;
  orderItemId?: string | null;
  customerId?: string | null;
  title?: string | null;
  expiresAt?: string | null;
  maxViews?: number;
  maxUnlocks?: number;
  passcode?: string | null;
  allowNoPasscode?: boolean;
  lockToIp?: boolean;
  exposurePolicy: {
    fields: AccountShareFieldType[];
    credentialIds?: string[];
    includeLabels?: boolean;
  };
}

export interface UpdateAccountShareInput {
  id: string;
  title?: string | null;
  status?: "active" | "disabled" | "expired";
  expiresAt?: string | null;
  maxViews?: number;
  maxUnlocks?: number;
  passcode?: string | null;
  clearPasscode?: boolean;
  lockToIp?: boolean;
  exposurePolicy?: {
    fields: AccountShareFieldType[];
    credentialIds?: string[];
    includeLabels?: boolean;
  };
}

export function useAccountShares(sourceAccountId?: string | null) {
  return useQuery({
    queryKey: sourceAccountId ? queryKeys.accountSharesForSource(sourceAccountId) : queryKeys.accountShares,
    queryFn: () => {
      const suffix = sourceAccountId ? `?sourceAccountId=${encodeURIComponent(sourceAccountId)}` : "";
      return fetcher<AccountShareLink[]>(`/api/account-shares${suffix}`);
    },
    staleTime: 20_000,
    enabled: sourceAccountId !== undefined,
  });
}

export function useAccountShareLogs(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? queryKeys.accountShareLogs(id) : ["account-shares", "logs", "none"],
    queryFn: () => fetcher<AccountShareAccessLog[]>(`/api/account-shares/${id}/logs`),
    enabled: enabled && !!id,
    staleTime: 5_000,
  });
}

export function useCreateAccountShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountShareInput) =>
      fetcher<AccountShareLink>("/api/account-shares", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (share) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountShares });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountSharesForSource(share.sourceAccountId) });
    },
  });
}

export function useUpdateAccountShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAccountShareInput) =>
      fetcher<AccountShareLink>(`/api/account-shares/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (share) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountShares });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountSharesForSource(share.sourceAccountId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountShareLogs(share.id) });
    },
  });
}

export function useDeleteAccountShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (share: Pick<AccountShareLink, "id" | "sourceAccountId">) =>
      fetcher<{ deleted: true }>(`/api/account-shares/${share.id}`, {
        method: "DELETE",
      }),
    onSuccess: (_, share) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountShares });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountSharesForSource(share.sourceAccountId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountShareLogs(share.id) });
    },
  });
}
