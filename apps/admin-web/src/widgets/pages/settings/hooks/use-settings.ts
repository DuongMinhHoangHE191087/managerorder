import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type {
  SystemSettings,
  PaymentSource,
  SalesChannel,
  ShortLinkLandingTemplateKey,
  ShortLinkFailureTemplateKey,
  ShortLinkResolvedDeliveryMode,
  ReminderConfig,
  Webhook,
} from "@/lib/domain/types";

export function useSystemSettings() {
  return useQuery({
    queryKey: queryKeys.systemSettings,
    queryFn: () => fetcher<SystemSettings>("/api/settings/system"),
    staleTime: 10 * 60_000, // 10 min — system settings rarely change
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SystemSettings>) =>
      fetcher<SystemSettings>("/api/settings/system", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systemSettings });
    },
  });
}

export function usePaymentSources() {
  return useQuery({
    queryKey: queryKeys.paymentSources,
    queryFn: () => fetcher<PaymentSource[]>("/api/settings/payment-sources"),
    staleTime: 5 * 60_000, // 5 min
  });
}

export function useCreatePaymentSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; icon: string }) =>
      fetcher<PaymentSource>("/api/settings/payment-sources", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSources });
    },
  });
}

export function useUpdatePaymentSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; icon: string }) =>
      fetcher<PaymentSource>(`/api/settings/payment-sources/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSources });
    },
  });
}

export function useDeletePaymentSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/settings/payment-sources/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSources });
    },
  });
}

export function useSalesChannels() {
  return useQuery({
    queryKey: queryKeys.salesChannels,
    queryFn: () => fetcher<SalesChannel[]>("/api/settings/sales-channels"),
    staleTime: 5 * 60_000, // 5 min
  });
}

export function useCreateSalesChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      defaultDeliveryMode: ShortLinkResolvedDeliveryMode;
      defaultLandingTemplateKey: ShortLinkLandingTemplateKey;
      defaultFailureTemplateKey?: ShortLinkFailureTemplateKey;
      sellerContactUrl?: string | null;
    }) =>
      fetcher<SalesChannel>("/api/settings/sales-channels", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.salesChannels });
    },
  });
}

export function useUpdateSalesChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      name?: string;
      defaultDeliveryMode?: ShortLinkResolvedDeliveryMode;
      defaultLandingTemplateKey?: ShortLinkLandingTemplateKey;
      defaultFailureTemplateKey?: ShortLinkFailureTemplateKey;
      sellerContactUrl?: string | null;
    }) =>
      fetcher<SalesChannel>(`/api/settings/sales-channels/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.salesChannels });
    },
  });
}

export function useDeleteSalesChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/settings/sales-channels/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.salesChannels });
    },
  });
}

// ── Reminder Config ──────────────────────────────────────────────

export function useReminderConfig() {
  return useQuery({
    queryKey: queryKeys.reminderConfig,
    queryFn: () => fetcher<ReminderConfig>("/api/settings/reminders"),
    staleTime: 10 * 60_000, // 10 min
  });
}

export function useUpdateReminderConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ReminderConfig>) =>
      fetcher<ReminderConfig>("/api/settings/reminders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminderConfig });
    },
  });
}

// ── Webhooks ─────────────────────────────────────────────────────

export function useWebhooks() {
  return useQuery({
    queryKey: queryKeys.webhooks,
    queryFn: () => fetcher<Webhook[]>("/api/settings/webhooks"),
    staleTime: 5 * 60_000, // 5 min
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { url: string; events: string[] }) =>
      fetcher<Webhook>("/api/settings/webhooks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; url?: string; events?: string[]; status?: string }) =>
      fetcher<Webhook>("/api/settings/webhooks", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/settings/webhooks?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

