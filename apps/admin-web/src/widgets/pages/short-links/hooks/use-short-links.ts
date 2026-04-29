"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { ShortLinkRow } from "@/lib/supabase/repositories/short-links.repo";
import { fetcher } from "@/lib/api/fetcher";
import { appToast } from "@/shared/ui/app-toast";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type {
  SalesChannel,
  ShortLinkClickEventType,
  ShortLinkDeliveryMode,
  ShortLinkFailureTemplateKey,
  ShortLinkLandingTemplateKey,
} from "@/lib/domain/types";

const QUERY_KEY = ["short-links"];

export function useShortLinks() {
  return useQuery<ShortLinkRow[]>({
    queryKey: QUERY_KEY,
    queryFn: () => fetcher("/api/short-links"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

export function useCreateShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      target_url: string;
      title?: string;
      max_clicks?: number;
      expires_at?: string | null;
      order_id?: string | null;
      customer_id?: string | null;
      require_token?: boolean;
      notify_clicks?: boolean;
      sales_channel_id?: string | null;
      delivery_mode?: ShortLinkDeliveryMode;
      landing_template_key?: ShortLinkLandingTemplateKey | null;
      failure_template_key?: ShortLinkFailureTemplateKey | null;
      seller_contact_url?: string | null;
    }) =>
      fetcher<ShortLinkRow>("/api/short-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: queryKeys.salesChannels });
      appToast.success("Đã tạo link rút gọn");
    },
    onError: (err: Error) => {
      appToast.error(err.message || "Không thể tạo link");
    },
  });
}

export function useUpdateShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, ...updates
    }: {
      id: string;
      title?: string;
      max_clicks?: number;
      current_clicks?: number;
      expires_at?: string | null;
      status?: string;
      require_token?: boolean;
      locked_ip?: string | null;
      locked_ipv6?: string | null;
      notify_clicks?: boolean;
      sales_channel_id?: string | null;
      delivery_mode?: ShortLinkDeliveryMode;
      landing_template_key?: ShortLinkLandingTemplateKey | null;
      failure_template_key?: ShortLinkFailureTemplateKey | null;
      seller_contact_url?: string | null;
    }) =>
      fetcher<ShortLinkRow>(`/api/short-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["short-link-detail"] });
      qc.invalidateQueries({ queryKey: queryKeys.salesChannels });
      appToast.success("Đã cập nhật link");
    },
    onError: (err: Error) => {
      appToast.error(err.message || "Không thể cập nhật link");
    },
  });
}

export function useDeleteShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/short-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["short-link-detail"] });
      qc.invalidateQueries({ queryKey: queryKeys.salesChannels });
      appToast.success("Đã xoá link");
    },
    onError: (err: Error) => {
      appToast.error(err.message || "Không thể xoá link");
    },
  });
}

// ── Detail hook — fetches single link + analytics from dedicated API ────
interface ClickRecord {
  id: string;
  ip_address: string;
  user_agent: string | null;
  referer: string | null;
  country: string | null;
  device_type: string | null;
  ip_version?: string | null;
  event_type: ShortLinkClickEventType;
  is_suspicious: boolean;
  suspicious_reason: string | null;
  clicked_at: string;
}

interface ClickStats {
  totalClicks: number;
  uniqueIPs: number;
  suspiciousCount: number;
  devices: Record<string, number>;
  browsers: Record<string, number>;
  topIPs: Array<{ ip: string; count: number }>;
  referers: Record<string, number>;
  countries?: Record<string, number>;
  cities?: Record<string, number>;
  ipVersions?: Record<string, number>;
  eventTypes?: Record<string, number>;
  realUserClicks?: number;
  botPreviewCount?: number;
  landingViewCount?: number;
  blockedCount?: number;
  hourlyTimeline: Array<{ hour: string; count: number }>;
  dailyTimeline: Array<{ day: string; count: number }>;
}

export interface ShortLinkDetailResponse {
  link: ShortLinkRow;
  salesChannel: SalesChannel | null;
  resolvedPolicy: {
    effectiveDeliveryMode: Exclude<ShortLinkDeliveryMode, "inherit_channel">;
    effectiveLandingTemplateKey: ShortLinkLandingTemplateKey | null;
    effectiveFailureTemplateKey: ShortLinkFailureTemplateKey;
    sellerContactUrl: string | null;
    deliveryModeSource: "link_override" | "channel_default" | "system_default";
    landingTemplateSource: "link_override" | "channel_default" | "system_default" | "not_applicable";
    failureTemplateSource: "link_override" | "channel_default" | "system_default";
    sellerContactSource: "link_override" | "channel_default" | "system_default" | "not_configured";
  };
  clicks: ClickRecord[];
  stats: ClickStats | null;
}

export function useShortLinkDetail(linkId: string | null, includeDeleted = false) {
  return useQuery<ShortLinkDetailResponse>({
    queryKey: ["short-link-detail", linkId, includeDeleted ? "trash" : "active"],
    queryFn: () =>
      fetcher(`/api/short-links/${linkId}${includeDeleted ? "?include_deleted=1" : ""}`),
    enabled: !!linkId,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000, // Auto-refresh every 30s for live data
  });
}

// Backwards-compatible analytics-only hook (used in list page)
export function useShortLinkAnalytics(linkId: string | null) {
  return useQuery<ShortLinkDetailResponse>({
    queryKey: ["short-link-detail", linkId],
    queryFn: () => fetcher(`/api/short-links/${linkId}`),
    enabled: !!linkId,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
