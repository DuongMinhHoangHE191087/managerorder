"use client";

import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/widgets/layout/app-layout";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFlowShell,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import { PageContainer } from "@/shared/ui/page-layout";
import { SectionCard } from "@/shared/ui/section-card";
import {
  useShortLinks, useCreateShortLink, useUpdateShortLink,
  useDeleteShortLink, useShortLinkAnalytics,
} from "@/widgets/pages/short-links/hooks/use-short-links";
import { useSalesChannels } from "@/widgets/pages/settings/hooks/use-settings";
import type { ShortLinkRow } from "@/lib/supabase/repositories/short-links.repo";
import type {
  ShortLinkDeliveryMode,
  ShortLinkFailureTemplateKey,
  ShortLinkLandingTemplateKey,
} from "@/lib/domain/types";
import { resolveShortLinkPolicy } from "@/domains/short-links/services/policy";
import { formatDateLabel, formatRelativeTime } from "@/lib/utils";
import {
  Link2, Plus, Copy, Trash2, ExternalLink, Clock, CheckCircle2, XCircle,
  Eye, Shield, Loader2, Search, Filter, ChevronLeft, ChevronRight, Check,
  Pencil, Save, X, ShieldCheck, ScanLine, Lock, Unlock, BarChart3,
  Smartphone, Monitor, Bot, AlertTriangle, Globe, ChevronDown,
  Bell, BellOff, CalendarPlus, CheckSquare, Store
} from "lucide-react";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/app-toast";
import { vi } from "@/shared/messages/vi";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return { label: vi.shortLinks.shared.active, color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
    case "expired":
      return { label: vi.shortLinks.shared.expired, color: "bg-amber-100 text-amber-700", icon: Clock };
    case "disabled":
      return { label: vi.shortLinks.shared.disabled, color: "bg-red-100 text-red-700", icon: XCircle };
    default:
      return { label: status, color: "bg-gray-100 text-gray-700", icon: Eye };
  }
}

function formatDate(d: string) {
  return formatDateLabel(d);
}

function formatRelative(d: string) {
  return formatRelativeTime(d);
}

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.length > 20 ? u.pathname.slice(0, 20) + "..." : u.pathname}`;
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "..." : url;
  }
}

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Smartphone,
  bot: Bot,
};

function formatDeviceTypeLabel(type?: string | null) {
  switch (type) {
    case "desktop":
      return vi.shortLinks.shared.deviceLabels.desktop;
    case "mobile":
      return vi.shortLinks.shared.deviceLabels.mobile;
    case "tablet":
      return vi.shortLinks.shared.deviceLabels.tablet;
    case "bot":
      return vi.shortLinks.shared.deviceLabels.bot;
    default:
      return vi.common.notAvailable;
  }
}

// â”€â”€ Expiry Options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EXPIRY_OPTIONS = vi.shortLinks.page.expiryOptions;

function expiryToDate(value: string): string | null {
  if (!value) return null;
  const now = new Date();
  const map: Record<string, number> = {
    "1h": 3600_000, "6h": 6 * 3600_000, "24h": 24 * 3600_000,
    "48h": 48 * 3600_000, "7d": 7 * 24 * 3600_000, "30d": 30 * 24 * 3600_000,
  };
  return new Date(now.getTime() + (map[value] || 0)).toISOString();
}

const PAGE_SIZE = 10;
type StatusFilter = "all" | "active" | "expired" | "disabled";
type SortOrder = "newest" | "clicks" | "expiry";

type QueryReader = {
  get: (name: string) => string | null;
};

type ShortLinksListState = {
  searchQuery: string;
  statusFilter: StatusFilter;
  sortOrder: SortOrder;
  currentPage: number;
};

const STATUS_FILTER_VALUES = new Set<StatusFilter>(["all", "active", "expired", "disabled"]);
const SORT_ORDER_VALUES = new Set<SortOrder>(["newest", "clicks", "expiry"]);

function parseZeroBasedPage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
}

function readEnumParam<T extends string>(params: QueryReader, key: string, values: Set<T>, fallback: T) {
  const value = params.get(key);
  return value && values.has(value as T) ? (value as T) : fallback;
}

function readShortLinksListState(params: QueryReader): ShortLinksListState {
  return {
    searchQuery: params.get("search") ?? "",
    statusFilter: readEnumParam(params, "status", STATUS_FILTER_VALUES, "all"),
    sortOrder: readEnumParam(params, "sort", SORT_ORDER_VALUES, "newest"),
    currentPage: parseZeroBasedPage(params.get("page")),
  };
}

function setOptionalQueryParam(params: URLSearchParams, key: string, value: string, defaultValue = "") {
  const normalized = value.trim();
  if (normalized && normalized !== defaultValue) {
    params.set(key, normalized);
  } else {
    params.delete(key);
  }
}

function writeShortLinksListState(params: URLSearchParams, state: ShortLinksListState) {
  setOptionalQueryParam(params, "search", state.searchQuery);
  setOptionalQueryParam(params, "status", state.statusFilter, "all");
  setOptionalQueryParam(params, "sort", state.sortOrder, "newest");

  if (state.currentPage > 0) {
    params.set("page", String(state.currentPage + 1));
  } else {
    params.delete("page");
  }
}

function buildShortLinksHref(params: URLSearchParams) {
  const queryString = params.toString();
  return queryString ? `/short-links?${queryString}` : "/short-links";
}

interface EditState {
  max_clicks: number;
  expiry: string;
  status: string;
  require_token: boolean;
  notify_clicks: boolean;
}

type CreateShortLinkFormState = {
  target_url: string;
  title: string;
  max_clicks: number;
  expiry: string;
  require_token: boolean;
  notify_clicks: boolean;
  sales_channel_id: string | null;
  delivery_mode: ShortLinkDeliveryMode;
  landing_template_key: ShortLinkLandingTemplateKey | null;
  failure_template_key: ShortLinkFailureTemplateKey | null;
  seller_contact_url: string;
};

const DEFAULT_CREATE_FORM: CreateShortLinkFormState = {
  target_url: "",
  title: "",
  max_clicks: 5,
  expiry: "",
  require_token: false,
  notify_clicks: false,
  sales_channel_id: null,
  delivery_mode: "inherit_channel",
  landing_template_key: null,
  failure_template_key: null,
  seller_contact_url: "",
};

const DELIVERY_MODE_OPTIONS: Array<{ value: ShortLinkDeliveryMode; label: string }> = [
  { value: "inherit_channel", label: "Kế thừa từ kênh bán" },
  { value: "direct_redirect", label: "Chuyển hướng trực tiếp" },
  { value: "landing_page", label: "Qua landing giới thiệu" },
];

const LANDING_TEMPLATE_OPTIONS: Array<{ value: ShortLinkLandingTemplateKey; label: string }> = [
  { value: "owner_intro", label: "Giới thiệu chủ shop" },
  { value: "ctv_neutral", label: "Mẫu CTV trung tính" },
];

const FAILURE_TEMPLATE_OPTIONS: Array<{ value: ShortLinkFailureTemplateKey; label: string }> = [
  { value: "customer_offer_wall", label: "Khách thường: landing mua hàng" },
  { value: "seller_unlock_request", label: "CTV: xin người bán mở lại" },
];

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PageTab = "short-links" | "account-shares";

export default function ShortLinksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialListState = readShortLinksListState(searchParams);
  const { data: links = [], isLoading } = useShortLinks();
  const { data: salesChannels = [] } = useSalesChannels();
  const createMut = useCreateShortLink();
  const updateMut = useUpdateShortLink();
  const deleteMut = useDeleteShortLink();

  const [activeTab, setActiveTab] = useState<PageTab>("short-links");
  const [showCreate, setShowCreate] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [form, setForm] = useState<CreateShortLinkFormState>(DEFAULT_CREATE_FORM);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditState>({ max_clicks: 5, expiry: "", status: "active", require_token: false, notify_clicks: false });
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialListState.searchQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialListState.statusFilter);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialListState.sortOrder);
  const [currentPage, setCurrentPage] = useState(initialListState.currentPage);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Bulk Select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; message: string } | null>(null);

  // Analytics
  const { data: analytics, isLoading: analyticsLoading } = useShortLinkAnalytics(analyticsId);
  const salesChannelById = useMemo(
    () => new Map(salesChannels.map((channel) => [channel.id, channel] as const)),
    [salesChannels],
  );
  const linkById = useMemo(
    () => new Map(links.map((link) => [link.id, link] as const)),
    [links],
  );
  const linkBySlug = useMemo(
    () => new Map(links.map((link) => [link.slug, link] as const)),
    [links],
  );
  const selectedSalesChannel = salesChannelById.get(form.sales_channel_id ?? "") ?? null;
  const salesChannelNameMap = useMemo(
    () => new Map(salesChannels.map((channel) => [channel.id, channel.name] as const)),
    [salesChannels],
  );
  const createdLink = useMemo(
    () => (createdSlug ? linkBySlug.get(createdSlug) ?? null : null),
    [createdSlug, linkBySlug],
  );
  const effectivePolicy = resolveShortLinkPolicy(
    {
      delivery_mode: form.delivery_mode,
      landing_template_key: form.landing_template_key,
      failure_template_key: form.failure_template_key,
      seller_contact_url: form.seller_contact_url || null,
    },
    selectedSalesChannel,
  );
  const deliveryModeLabel = (mode: string) =>
    DELIVERY_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
  const landingTemplateLabel = (templateKey: ShortLinkLandingTemplateKey | null) =>
    LANDING_TEMPLATE_OPTIONS.find((option) => option.value === templateKey)?.label ??
    "Kế thừa theo kênh bán";
  const policySourceLabel = (source: string) => {
    switch (source) {
      case "link_override":
        return "Từ link";
      case "channel_default":
        return "Từ kênh bán";
      case "system_default":
        return "Mặc định hệ thống";
      case "not_applicable":
        return "Không áp dụng";
      default:
        return source;
    }
  };
  const effectiveLandingTemplateLabel =
    effectivePolicy.effectiveDeliveryMode === "direct_redirect"
      ? "Không áp dụng"
      : landingTemplateLabel(effectivePolicy.effectiveLandingTemplateKey);
  const failureTemplateLabel = (templateKey: ShortLinkFailureTemplateKey) =>
    FAILURE_TEMPLATE_OPTIONS.find((option) => option.value === templateKey)?.label ?? templateKey;

  // Stats
  const stats = useMemo(() => {
    return links.reduce(
      (acc, link) => {
        acc.total += 1;
        acc.totalClicks += link.current_clicks;
        if (link.status === "active") acc.active += 1;
        if (link.status === "expired") acc.expired += 1;
        if (link.require_token) acc.protectedLinks += 1;
        return acc;
      },
      { total: 0, active: 0, expired: 0, totalClicks: 0, protectedLinks: 0 },
    );
  }, [links]);

  // Filtered + searched
  const filteredLinks = useMemo(() => {
    let result = links;
    if (statusFilter !== "all") result = result.filter(l => l.status === statusFilter);
    if (hasSearchTokens(deferredSearchQuery)) {
      result = result.filter((link) =>
        matchesSearchQuery(
          deferredSearchQuery,
          link.title,
          link.slug,
          link.target_url,
          link.access_token,
          link.order_id,
          link.sales_channel_id ? salesChannelNameMap.get(link.sales_channel_id) ?? "" : "",
        ),
      );
    }
    
    // Sort
    if (sortOrder === "clicks") {
      result = [...result].sort((a, b) => b.current_clicks - a.current_clicks);
    } else if (sortOrder === "expiry") {
      result = [...result].sort((a, b) => {
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      });
    } else {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return result;
  }, [links, statusFilter, deferredSearchQuery, sortOrder, salesChannelNameMap]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / PAGE_SIZE));
  const paginatedLinks = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredLinks.slice(start, start + PAGE_SIZE);
  }, [filteredLinks, currentPage]);

  useEffect(() => {
    setCurrentPage((value) => Math.min(value, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  useEffect(() => {
    const nextState = readShortLinksListState(searchParams);
    setSearchQuery(nextState.searchQuery);
    setStatusFilter(nextState.statusFilter);
    setSortOrder(nextState.sortOrder);
    setCurrentPage(nextState.currentPage);
  }, [searchParams]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    const params = new URLSearchParams(currentQuery);
    writeShortLinksListState(params, {
      searchQuery,
      statusFilter,
      sortOrder,
      currentPage,
    });

    if (params.toString() !== currentQuery) {
      router.replace(buildShortLinksHref(params), { scroll: false });
    }
  }, [currentPage, router, searchParams, searchQuery, sortOrder, statusFilter]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
  }, []);

  const handleFilterChange = useCallback((value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(0);
  }, []);

  const handleSortChange = useCallback((value: SortOrder) => {
    setSortOrder(value);
    setCurrentPage(0);
  }, []);

  const handleCreate = async () => {
    if (!form.target_url) { appToast.error(vi.shortLinks.page.targetUrlRequired); return; }
    try {
      const result = await createMut.mutateAsync({
        target_url: form.target_url,
        title: form.title || undefined,
        max_clicks: form.max_clicks,
        expires_at: expiryToDate(form.expiry),
        require_token: form.require_token,
        notify_clicks: form.notify_clicks,
        sales_channel_id: form.sales_channel_id,
        delivery_mode: form.delivery_mode,
        landing_template_key: form.landing_template_key,
        failure_template_key: form.failure_template_key,
        seller_contact_url: form.seller_contact_url || null,
      });
      setCreatedSlug((result as { slug?: string; access_token?: string | null })?.slug || null);
      setForm(DEFAULT_CREATE_FORM);
    } catch { /* handled by mutation */ }
  };

  const handleCopy = (slug: string, token?: string | null) => {
    const url = `${getBaseUrl()}/s/${slug}${token ? `?t=${token}` : ""}`;
    appToast.copy(url, vi.shortLinks.shared.copiedLink);
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirm({ ids: [id], message: vi.shortLinks.detail.confirmDelete });
  };

  const startEdit = (link: typeof links[0]) => {
    setEditingId(link.id);
    setEditForm({
      max_clicks: link.max_clicks, expiry: "",
      status: link.status, require_token: link.require_token ?? false,
      notify_clicks: link.notify_clicks ?? false,
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    const updates: Record<string, unknown> = {};
    const original = linkById.get(id);

    if (original && editForm.max_clicks !== original.max_clicks) updates.max_clicks = editForm.max_clicks;
    if (editForm.expiry) updates.expires_at = expiryToDate(editForm.expiry);
    if (original && editForm.status !== original.status) updates.status = editForm.status;
    if (original && editForm.require_token !== (original.require_token ?? false)) updates.require_token = editForm.require_token;
    if (original && editForm.notify_clicks !== (original.notify_clicks ?? false)) updates.notify_clicks = editForm.notify_clicks;

    if (Object.keys(updates).length === 0) {
      appToast.info(vi.common.empty);
      setEditingId(null);
      return;
    }

    await updateMut.mutateAsync({ id, ...updates } as Parameters<typeof updateMut.mutateAsync>[0]);
    setEditingId(null);
  };

  const handleUnlockIP = async (id: string) => {
    await updateMut.mutateAsync({ id, locked_ip: null, locked_ipv6: null });
    appToast.success(`${vi.common.open} ${vi.shortLinks.shared.ipLocked}`);
  };

  const handleQuickRenew = async (id: string, days: number) => {
    const link = linkById.get(id);
    if (!link) return;
    const baseDate = link.expires_at && new Date(link.expires_at) > new Date() ? new Date(link.expires_at) : new Date();
    const expires_at = new Date(baseDate.getTime() + days * 24 * 3600_000).toISOString();
    await updateMut.mutateAsync({ id, expires_at, status: link.status === 'expired' ? 'active' : link.status });
  };

  const handleToggleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedLinks.length && paginatedLinks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLinks.map(l => l.id)));
    }
  }, [paginatedLinks, selectedIds.size]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkRenew = async (days: number) => {
    const ids = Array.from(selectedIds);
    await Promise.allSettled(
      ids.map(id => {
        const link = linkById.get(id);
        if (!link) return Promise.resolve();
        const baseDate = link.expires_at && new Date(link.expires_at) > new Date() ? new Date(link.expires_at) : new Date();
        const expires_at = new Date(baseDate.getTime() + days * 24 * 3600_000).toISOString();
        return updateMut.mutateAsync({ id, expires_at, status: link.status === 'expired' ? 'active' : link.status });
      })
    );
    appToast.success(vi.shortLinks.page.bulkRenewSuccess(days, ids.length));
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({
      ids: Array.from(selectedIds),
      message: vi.shortLinks.page.bulkDeleteConfirm(selectedIds.size),
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const ids = deleteConfirm.ids;
    const results = await Promise.allSettled(ids.map(id => deleteMut.mutateAsync(id)));
    const success = results.filter((result) => result.status === "fulfilled").length;
    if (analyticsId && ids.includes(analyticsId)) setAnalyticsId(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setDeleteConfirm(null);
    if (ids.length > 1 && success > 0) {
      appToast.success(vi.shortLinks.page.bulkDeleteSuccess(success));
    }
  };

  const FILTER_OPTIONS: { label: string; value: StatusFilter; count: number }[] = [
    { label: vi.shortLinks.page.all, value: "all", count: stats.total },
    { label: vi.shortLinks.shared.active, value: "active", count: stats.active },
    { label: vi.shortLinks.shared.expired, value: "expired", count: stats.expired },
  ];

  return (
    <AppLayout>
      <PageContainer>
        {deleteConfirm ? (
          <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: "var(--z-modal)" }}>
            <button
              type="button"
              aria-label="Đóng xác nhận xoá"
              className="absolute inset-0 bg-black/40"
              onClick={() => setDeleteConfirm(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="short-links-delete-title"
              className="relative w-full max-w-md rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <AlertTriangle aria-hidden="true" className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="short-links-delete-title" className="text-base font-black text-[var(--fg-base)]">
                    Xác nhận xoá short link
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--fg-muted)]">{deleteConfirm.message}</p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm font-bold text-[var(--fg-base)] transition-colors hover:bg-[var(--surface-light)]"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmDelete()}
                  disabled={deleteMut.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-[background-color,opacity] hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteMut.isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                  Xoá
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 mt-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--fg-base)] flex items-center gap-3">
              <Link2 className="size-9 text-[var(--accent)]" />
              {vi.shortLinks.page.title}
            </h1>
            <p className="text-[15px] text-[var(--fg-muted)] font-medium mt-1">
              {vi.shortLinks.page.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowCreate(!showCreate); setCreatedSlug(null); }}
            data-testid="short-links-create-toggle"
            className="flex items-center gap-2 bg-[var(--fg-base)] text-[var(--bg-app)] px-5 py-2.5 rounded-full font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-[box-shadow,opacity,transform] cursor-pointer"
          >
            <Plus aria-hidden="true" className="size-4" />
            {vi.shortLinks.page.create}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
            { label: vi.shortLinks.page.total, value: stats.total, color: "from-blue-500/20 to-indigo-500/20", icon: Link2 },
            { label: vi.shortLinks.page.active, value: stats.active, color: "from-emerald-500/20 to-teal-500/20", icon: CheckCircle2 },
            { label: vi.shortLinks.page.expired, value: stats.expired, color: "from-amber-500/20 to-orange-500/20", icon: Clock },
            { label: vi.shortLinks.page.clicks, value: stats.totalClicks, color: "from-purple-500/20 to-pink-500/20", icon: BarChart3 },
            { label: vi.shortLinks.page.protected, value: stats.protectedLinks, color: "from-violet-500/20 to-indigo-500/20", icon: ShieldCheck },
          ].map(s => (
            <div key={s.label} className={cn("glass-card p-4 rounded-2xl bg-gradient-to-br", s.color)}>
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="size-3.5 text-[var(--fg-muted)]" />
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{s.label}</p>
              </div>
              <p className="text-2xl font-black text-[var(--fg-base)]">{s.value}</p>
            </div>
          ))}
        </div>



        {/* Create Form - only when on short-links tab */}
        {activeTab === "short-links" && showCreate && (
          createdSlug ? (
            <SectionCard title={vi.shortLinks.page.createTitle} description={vi.shortLinks.page.createDescription}>
              <CreatedSuccess
                slug={createdSlug}
                link={createdLink}
                onCopy={handleCopy}
                onCreateAnother={() => setCreatedSlug(null)}
                onClose={() => { setShowCreate(false); setCreatedSlug(null); }}
              />
            </SectionCard>
          ) : (
            <CreateFlowShell
              title={vi.shortLinks.page.createTitle}
              description="Chỉ mở những trường thật sự cần để tạo link mới. Template lỗi, chống gian lận và notify được gom vào nhóm nâng cao."
              footer={
                <CreateActionFooter
                  primaryLabel={vi.shortLinks.page.createSubmit}
                  onPrimary={() => void handleCreate()}
                  onCancel={() => { setShowCreate(false); setCreatedSlug(null); }}
                  pending={createMut.isPending}
                  disabled={!form.target_url}
                />
              }
            >
              <CreateFormSection
                title="Thông tin chính"
                description="URL đích, tiêu đề hiển thị và kênh bán là ba trường cốt lõi để vận hành link."
              >
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      {vi.shortLinks.page.targetUrl} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={form.target_url}
                      onChange={(event) => setForm((current) => ({ ...current, target_url: event.target.value }))}
                      placeholder={vi.shortLinks.page.targetUrlPlaceholder}
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color]"
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                        {vi.shortLinks.page.titleLabel}
                      </label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder={vi.shortLinks.page.titlePlaceholder}
                        className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                        Kênh bán
                      </label>
                      <select
                        value={form.sales_channel_id ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            sales_channel_id: event.target.value || null,
                          }))
                        }
                        className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color] cursor-pointer"
                      >
                        <option value="">Không gắn kênh bán</option>
                        {salesChannels.map((channel) => (
                          <option key={channel.id} value={channel.id}>
                            {channel.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </CreateFormSection>

              <CreateFormSection
                title="Chính sách public"
                description="Delivery mode được mở ngay vì nó quyết định link redirect thẳng hay đi qua landing."
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      Cách mở link
                    </label>
                    <select
                      value={form.delivery_mode}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          delivery_mode: event.target.value as ShortLinkDeliveryMode,
                          landing_template_key:
                            event.target.value === "direct_redirect"
                              ? null
                              : current.landing_template_key,
                        }))
                      }
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color] cursor-pointer"
                    >
                      {DELIVERY_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-soft)] bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-bold text-[var(--fg-base)]">Chính sách hiệu lực</p>
                        <p className="mt-0.5 text-[11px] leading-6 text-[var(--fg-muted)]">
                          Xem nhanh template landing, template lỗi và nguồn quyết định đang được resolve.
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                        Preview
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <PolicyChip label="Cách mở link" value={deliveryModeLabel(effectivePolicy.effectiveDeliveryMode)} />
                      <PolicyChip label="Mẫu landing" value={effectiveLandingTemplateLabel} />
                      <PolicyChip label="Mẫu khi lỗi" value={failureTemplateLabel(effectivePolicy.effectiveFailureTemplateKey)} />
                      <PolicyChip label="Nguồn quyết định" value={`${policySourceLabel(effectivePolicy.deliveryModeSource)} / ${policySourceLabel(effectivePolicy.landingTemplateSource)}`} />
                    </div>
                  </div>
                </div>
              </CreateFormSection>

              <AdvancedOptionsDisclosure>
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      {vi.shortLinks.page.maxClicks}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.max_clicks}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, max_clicks: Number(event.target.value) || 1 }))
                      }
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      {vi.shortLinks.page.expiresAfter}
                    </label>
                    <select
                      value={form.expiry}
                      onChange={(event) => setForm((current) => ({ ...current, expiry: event.target.value }))}
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color] cursor-pointer"
                    >
                      {EXPIRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      Mẫu landing
                    </label>
                    <select
                      value={form.landing_template_key ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          landing_template_key: (event.target.value || null) as ShortLinkLandingTemplateKey | null,
                        }))
                      }
                      disabled={form.delivery_mode === "direct_redirect"}
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color,opacity] cursor-pointer disabled:opacity-60"
                    >
                      <option value="">Kế thừa theo kênh bán</option>
                      {LANDING_TEMPLATE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      Mẫu khi link lỗi / hết hạn
                    </label>
                    <select
                      value={form.failure_template_key ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          failure_template_key: (event.target.value || null) as ShortLinkFailureTemplateKey | null,
                        }))
                      }
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color] cursor-pointer"
                    >
                      <option value="">Kế thừa theo kênh bán / hệ thống</option>
                      {FAILURE_TEMPLATE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      Link liên hệ người bán
                    </label>
                    <input
                      type="url"
                      value={form.seller_contact_url}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, seller_contact_url: event.target.value }))
                      }
                      placeholder="https://zalo.me/... hoặc link chat người bán"
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, require_token: !current.require_token }))}
                    className="flex items-center gap-3 rounded-2xl border border-violet-200/40 bg-violet-50 p-4 text-left"
                  >
                    <div
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        form.require_token ? "bg-violet-500" : "bg-slate-300",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform",
                          form.require_token ? "translate-x-[22px]" : "translate-x-0.5",
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-violet-700">
                        <ShieldCheck className="size-4" />
                        {vi.shortLinks.page.antiFraud}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-violet-600/70">
                        {vi.shortLinks.page.antiFraudDescription}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, notify_clicks: !current.notify_clicks }))}
                    className="flex items-center gap-3 rounded-2xl border border-amber-200/40 bg-amber-50 p-4 text-left"
                  >
                    <div
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        form.notify_clicks ? "bg-amber-500" : "bg-slate-300",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform",
                          form.notify_clicks ? "translate-x-[22px]" : "translate-x-0.5",
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-amber-700">
                        <Bell className="size-4" />
                        {vi.shortLinks.page.telegramNotify}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-amber-600/70">
                        {vi.shortLinks.page.telegramNotifyDescription}
                      </p>
                    </div>
                  </button>
                </div>
              </AdvancedOptionsDisclosure>
            </CreateFlowShell>
          )
        )}

        {/* Links Table - only when on short-links tab */}
        {activeTab === "short-links" && <SectionCard title={vi.shortLinks.page.listTitle} description={vi.shortLinks.page.listDescription(filteredLinks.length)}>
          {/* Search, Sort & Filter */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 mb-4">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              data-testid="short-links-select-all"
              className={cn(
                "flex items-center justify-center size-[42px] rounded-xl border flex-shrink-0 transition-colors cursor-pointer disabled:opacity-50",
                selectedIds.size > 0 && selectedIds.size === paginatedLinks.length ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "bg-white border-[var(--border-soft)] hover:border-[var(--accent)]/50 text-[var(--fg-muted)]"
              )}
              disabled={paginatedLinks.length === 0}
              title={vi.shortLinks.page.selectAllTooltip}
            >
              {selectedIds.size > 0 && selectedIds.size < paginatedLinks.length ? (
                <div className="size-3 rounded-sm bg-[var(--accent)]" />
              ) : (
                <CheckSquare className="size-5" />
              )}
            </button>
            <div className="relative flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-muted)]" />
              <input
                aria-label="Tìm short link"
                name="short-links-search"
                type="text"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder={vi.shortLinks.page.searchPlaceholder}
                data-testid="short-links-search"
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-[background-color,border-color,box-shadow,color]"
              />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--border-soft)]/50" data-testid="short-links-status-filters">
              <Filter aria-hidden="true" className="size-3.5 text-[var(--fg-muted)] mx-1.5" />
              {FILTER_OPTIONS.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  aria-pressed={statusFilter === opt.value}
                  onClick={() => handleFilterChange(opt.value)}
                  data-testid={`short-links-filter-${opt.value}`}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-[background-color,box-shadow,color,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer",
                    statusFilter === opt.value
                      ? "bg-[var(--bg-surface)] text-[var(--fg-base)] shadow-sm"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                  )}
                >
                  {opt.label} ({opt.count})
                </button>
              ))}
            </div>
            <select
              aria-label="Sắp xếp short link"
              name="short-links-sort"
              value={sortOrder}
              onChange={e => handleSortChange(e.target.value as SortOrder)}
              data-testid="short-links-sort"
              className="p-2.5 rounded-xl bg-white border border-[var(--border-soft)] text-xs font-bold text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none cursor-pointer"
            >
              <option value="newest">{vi.shortLinks.page.sortNewest}</option>
              <option value="clicks">{vi.shortLinks.page.sortClicks}</option>
              <option value="expiry">{vi.shortLinks.page.sortExpiry}</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 text-[var(--accent)] animate-spin" />
            </div>
          ) : paginatedLinks.length === 0 ? (
            <div className="text-center py-12" data-testid="short-links-empty-state">
              <Link2 className="size-12 text-[var(--fg-muted)]/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-[var(--fg-muted)]">
                {hasSearchTokens(searchQuery) || statusFilter !== "all" ? vi.shortLinks.page.noResults : vi.shortLinks.page.noLinks}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedLinks.map(link => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    salesChannelLabel={link.sales_channel_id ? salesChannelNameMap.get(link.sales_channel_id) ?? null : null}
                    orderId={link.order_id ?? null}
                    selected={selectedIds.has(link.id)}
                    onToggleSelect={() => handleToggleSelect(link.id)}
                    onQuickRenew={(days) => handleQuickRenew(link.id, days)}
                    isEditing={editingId === link.id}
                  showAnalytics={analyticsId === link.id}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  analytics={analyticsId === link.id ? analytics : null}
                  analyticsLoading={analyticsId === link.id && analyticsLoading}
                  onCopy={handleCopy}
                  onEdit={() => startEdit(link)}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={() => saveEdit(link.id)}
                  onDelete={() => handleDelete(link.id)}
                  onToggleAnalytics={() => setAnalyticsId(analyticsId === link.id ? null : link.id)}
                  onUnlockIP={() => handleUnlockIP(link.id)}
                  updatePending={updateMut.isPending}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-soft)]">
              <p className="text-xs text-[var(--fg-muted)] font-medium">
                {vi.shortLinks.page.pageLabel(currentPage + 1, totalPages, filteredLinks.length)}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:bg-[var(--border-soft)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.93] active:duration-75 cursor-pointer",
                      currentPage === i
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--fg-muted)] hover:bg-[var(--border-soft)]"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1.5 rounded-lg text-[var(--fg-muted)] hover:bg-[var(--border-soft)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </SectionCard>}

        {/* Floating Bulk Action Bar (Matches Inventory style) */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--fg-base)] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
            <span className="text-[13px] font-bold">{vi.shortLinks.page.selectedCount(selectedIds.size)}</span>
            <div className="w-px h-6 bg-white/20" />
            <button
              onClick={() => handleBulkRenew(1)}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 rounded-lg transition-colors cursor-pointer"
            >
              <CalendarPlus className="size-3.5" /> {vi.shortLinks.page.bulkRenew1Day}
            </button>
            <button
              onClick={() => handleBulkRenew(7)}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg transition-colors cursor-pointer"
            >
              <CalendarPlus className="size-3.5" /> {vi.shortLinks.page.bulkRenew7Days}
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="size-3.5" /> {vi.shortLinks.page.bulkDelete}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="size-4 opacity-60" />
            </button>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

function PolicyChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{label}</p>
      <p className="mt-1 text-[12px] font-bold text-[var(--fg-base)]">{value}</p>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUB-COMPONENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function CreatedSuccess({ slug, link, onCopy, onCreateAnother, onClose }: {
  slug: string;
  link: { slug: string; access_token?: string | null } | null;
  onCopy: (slug: string, token?: string | null) => void;
  onCreateAnother: () => void;
  onClose: () => void;
}) {
  const token = link?.access_token;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200/50">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Check className="size-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-700">{vi.shortLinks.created.successTitle}</p>
          <p className="text-xs text-emerald-600/80 font-mono truncate mt-0.5">
            {getBaseUrl()}/s/{slug}{token ? `?t=${token}` : ""}
          </p>
        </div>
          <button
            type="button"
            onClick={() => onCopy(slug, token)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 active:scale-95 transition-[background-color,box-shadow,transform] cursor-pointer shadow-md shadow-emerald-500/30"
          >
            <Copy className="size-3.5" />
          {vi.shortLinks.created.copy}
          </button>
      </div>

      {token && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-200/40">
          <ShieldCheck className="size-5 text-violet-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-violet-700">{vi.shortLinks.created.tokenTitle}</p>
            <p className="text-xs font-mono text-violet-600 mt-0.5">{token}</p>
          </div>
          <button
            onClick={() => appToast.copy(token, vi.shortLinks.shared.copiedToken)}
            className="px-3 py-1.5 bg-violet-500 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-violet-600 transition-colors"
          >
            {vi.shortLinks.created.copyToken}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
          <button type="button" onClick={onCreateAnother} className="flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-[opacity,transform] cursor-pointer">
          <Plus className="size-4" /> {vi.shortLinks.created.createAnother}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors cursor-pointer">
          {vi.shortLinks.created.close}
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Link Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface LinkCardProps {
  link: ShortLinkRow;
  salesChannelLabel: string | null;
  orderId: string | null;
  selected: boolean;
  onToggleSelect: () => void;
  onQuickRenew: (days: number) => void;
  isEditing: boolean;
  showAnalytics: boolean;
  editForm: EditState;
  setEditForm: React.Dispatch<React.SetStateAction<EditState>>;
  analytics: ReturnType<typeof useShortLinkAnalytics>["data"] | null;
  analyticsLoading: boolean;
  onCopy: (slug: string, token?: string | null) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onToggleAnalytics: () => void;
  onUnlockIP: () => void;
  updatePending: boolean;
}

function LinkCard({
  link, salesChannelLabel, orderId, selected, onToggleSelect, onQuickRenew, isEditing, showAnalytics, editForm, setEditForm,
  analytics, analyticsLoading, onCopy, onEdit, onCancelEdit,
  onSaveEdit, onDelete, onToggleAnalytics, onUnlockIP, updatePending,
}: LinkCardProps) {
  const badge = getStatusBadge(link.status);
  const BadgeIcon = badge.icon;
  const progress = link.max_clicks > 0 ? (link.current_clicks / link.max_clicks) * 100 : 0;

  return (
    <div className={cn(
      "glass-card p-4 rounded-2xl transition-[border-color,box-shadow] group",
      isEditing ? "border-[var(--accent)]/40 ring-2 ring-[var(--accent)]/10" : "hover:border-[var(--accent)]/20"
    )}
      data-testid="short-links-row"
      data-short-link-id={link.id}
    >
      <div className="flex flex-col gap-3">
        {/* Row 1: Info */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 self-start sm:self-auto mt-0.5">
            <button
              onClick={onToggleSelect}
              className={cn(
                "flex items-center justify-center size-5 rounded-md border flex-shrink-0 transition-colors",
                selected ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border-soft)] hover:border-[var(--accent)]/50 text-transparent"
              )}
            >
              <Check className="size-3.5" />
            </button>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--fg-base)] truncate">
                {link.title || link.slug}
              </h3>
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", badge.color)}>
                <BadgeIcon className="size-3" /> {badge.label}
              </span>
              {link.require_token && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">
                  <ShieldCheck className="size-3" /> {vi.shortLinks.shared.token}
                </span>
              )}
              {link.locked_ip && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  <Lock className="size-3" /> {vi.shortLinks.shared.ipLocked}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)] font-medium flex-wrap">
              <span className="flex items-center gap-1 font-mono bg-[var(--border-soft)] px-2 py-0.5 rounded-md">
                /s/{link.slug}
              </span>
              <span className="flex items-center gap-1">
                <ExternalLink className="size-3" /> {maskUrl(link.target_url)}
              </span>
              {link.access_token && (
                <span className="flex items-center gap-1 font-mono text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                  <ScanLine className="size-3" /> {link.access_token}
                </span>
              )}
              {link.notify_clicks && (
                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  <Bell className="size-3" /> {vi.shortLinks.shared.telegram}
                </span>
              )}
              {salesChannelLabel && (
                <span className="flex items-center gap-1 text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  <Store className="size-3" /> {salesChannelLabel}
                </span>
              )}
              {orderId && (
                <NextLink
                  href={`/orders/${orderId}`}
                  title={orderId}
                  className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                >
                  <ExternalLink className="size-3" /> Đơn #{orderId.slice(0, 8).toUpperCase()}
                </NextLink>
              )}
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 h-1.5 bg-[var(--border-soft)] rounded-full overflow-hidden max-w-xs">
                <div
                  className={cn(
                    "h-full rounded-full transition-[background-color,width] duration-500",
                    progress >= 100 ? "bg-red-500" : progress >= 70 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-[var(--fg-muted)]">
                {vi.shortLinks.card.clicks(link.current_clicks, link.max_clicks)}
              </span>
              {link.expires_at && (
                <span className="text-[11px] text-[var(--fg-muted)] flex items-center gap-1">
                  <Clock className="size-3" /> {formatDate(link.expires_at)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={() => onCopy(link.slug, link.access_token)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-lg transition-[background-color,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer" title={vi.shortLinks.card.copyLinkTitle}>
                <Copy className="size-3.5" /> {vi.shortLinks.card.copyLink}
              </button>
              <button onClick={() => appToast.copy(link.target_url, vi.shortLinks.shared.copiedUrl)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-[background-color,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer" title={vi.shortLinks.card.copyOriginUrlTitle}>
                <ExternalLink className="size-3.5" /> {vi.shortLinks.card.copyOriginUrl}
              </button>
              <NextLink href={`/short-links/${link.id}`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-[background-color,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer" title={vi.shortLinks.card.detailsTitle}>
                <Eye className="size-3.5" /> {vi.shortLinks.card.details}
              </NextLink>
              <button onClick={() => onQuickRenew(1)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-600 bg-teal-500/10 hover:bg-teal-500/20 rounded-lg transition-[background-color,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer" title={vi.shortLinks.card.quickRenewTitle(1)}>
                <CalendarPlus className="size-3.5" /> {vi.shortLinks.card.quickRenew(1)}
              </button>
              <button onClick={onToggleAnalytics} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-[background-color,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer", showAnalytics ? "text-purple-700 bg-purple-500/20" : "text-purple-600 bg-purple-500/10 hover:bg-purple-500/20")} title={vi.shortLinks.card.analytics}>
                <BarChart3 className="size-3.5" />
              </button>
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-[background-color,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer" title={vi.shortLinks.card.edit}>
                <Pencil className="size-3.5" />
              </button>
              <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-[background-color,transform] duration-200 ease-out active:scale-[0.95] active:duration-75 cursor-pointer" title={vi.shortLinks.card.delete}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Edit Panel */}
        {isEditing && (
          <div className="border-t border-[var(--border-soft)] pt-3 mt-1">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">{vi.shortLinks.card.maxClicks}</label>
                <input type="number" min={1} max={100} value={editForm.max_clicks}
                  onChange={e => setEditForm((f: EditState) => ({ ...f, max_clicks: Number(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">{vi.shortLinks.card.renewal}</label>
                <select value={editForm.expiry} onChange={e => setEditForm((f: EditState) => ({ ...f, expiry: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none cursor-pointer"
                >
                  <option value="">{vi.shortLinks.card.keepOriginal}</option>
                  {EXPIRY_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">{vi.shortLinks.card.status}</label>
                <select value={editForm.status} onChange={e => setEditForm((f: EditState) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[var(--border-soft)] text-sm text-[var(--fg-base)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none cursor-pointer"
                >
                  <option value="active">{vi.shortLinks.shared.active}</option>
                  <option value="expired">{vi.shortLinks.shared.expired}</option>
                  <option value="disabled">{vi.shortLinks.shared.disabled}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">{vi.shortLinks.card.token}</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f: EditState) => ({ ...f, require_token: !f.require_token }))}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer border",
                    editForm.require_token
                      ? "bg-violet-50 text-violet-700 border-violet-200"
                      : "bg-white text-[var(--fg-muted)] border-[var(--border-soft)]"
                  )}
                >
                  {editForm.require_token ? <ShieldCheck className="size-4" /> : <Shield className="size-4" />}
                  {editForm.require_token ? vi.shortLinks.card.onToken : vi.shortLinks.card.offToken}
                </button>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 block">{vi.shortLinks.card.notifications}</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f: EditState) => ({ ...f, notify_clicks: !f.notify_clicks }))}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer border",
                    editForm.notify_clicks
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-white text-[var(--fg-muted)] border-[var(--border-soft)]"
                  )}
                >
                  {editForm.notify_clicks ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                  {editForm.notify_clicks ? vi.shortLinks.card.telegramOn : vi.shortLinks.card.telegramOff}
                </button>
              </div>
            </div>

            {/* IP Lock management */}
            {link.locked_ip && (
              <div className="flex items-center gap-3 mt-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200/40">
                <Lock className="size-4 text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-700">{vi.shortLinks.card.ipLocked} <span className="font-mono">{link.locked_ip}</span></p>
                </div>
                <button onClick={onUnlockIP} className="px-3 py-1 bg-blue-500 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-blue-600 active:scale-[0.95] active:duration-75 transition-[background-color,transform] duration-200 ease-out flex items-center gap-1">
                  <Unlock className="size-3" /> {vi.shortLinks.card.unlockIp}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button type="button" onClick={onSaveEdit} disabled={updatePending}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 active:scale-95 transition-[background-color,opacity,transform] cursor-pointer disabled:opacity-50"
              >
                {updatePending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                {vi.shortLinks.card.saveChanges}
              </button>
              <button onClick={onCancelEdit} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors cursor-pointer">
                <X className="size-3.5" /> {vi.shortLinks.card.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="border-t border-[var(--border-soft)] pt-3 mt-1">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 text-purple-500 animate-spin" />
                <span className="ml-2 text-xs text-[var(--fg-muted)]">{vi.shortLinks.analytics.loading}</span>
              </div>
            ) : analytics?.stats ? (
              <div className="space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatMini icon={BarChart3} label={vi.shortLinks.analytics.totalClicks} value={analytics.stats.totalClicks} color="text-purple-500" />
                  <StatMini icon={Globe} label={vi.shortLinks.analytics.uniqueIPs} value={analytics.stats.uniqueIPs} color="text-blue-500" />
                  <StatMini icon={AlertTriangle} label={vi.shortLinks.analytics.suspicious} value={analytics.stats.suspiciousCount} color="text-red-500" />
                  <StatMini
                    icon={Monitor} label={vi.shortLinks.analytics.device}
                    value={Object.entries(analytics.stats.devices).map(([k, v]) => `${formatDeviceTypeLabel(k)}: ${v}`).join(", ") || vi.shortLinks.analytics.noData}
                    color="text-teal-500"
                  />
                </div>

                {/* Hourly Timeline Bar Chart */}
                {analytics.stats.hourlyTimeline && analytics.stats.hourlyTimeline.some(h => h.count > 0) && (
                  <div>
                    <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-2">{vi.shortLinks.analytics.clicks24h}</p>
                    <div className="flex items-end gap-px h-16 bg-[var(--border-soft)]/20 rounded-lg p-1.5">
                      {analytics.stats.hourlyTimeline.map((h, i) => {
                        const maxCount = Math.max(...analytics.stats!.hourlyTimeline.map(t => t.count), 1);
                        const heightPct = (h.count / maxCount) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 group/bar relative">
                            <div
                              className={cn(
                                "w-full rounded-t-sm transition-[background-color,height] min-h-[2px]",
                                h.count > 0 ? "bg-purple-500/80 hover:bg-purple-500" : "bg-[var(--border-soft)]/40"
                              )}
                              style={{ height: `${Math.max(heightPct, 3)}%` }}
                            />
                            {/* Tooltip on hover */}
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover/bar:block z-10">
                              <div className="bg-[#1e293b] text-white text-[9px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                                {h.hour}: {h.count} {vi.shortLinks.shared.clicks}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[8px] text-[var(--fg-muted)] mt-0.5 px-1">
                      <span>{analytics.stats.hourlyTimeline[0]?.hour}</span>
                      <span>{analytics.stats.hourlyTimeline[analytics.stats.hourlyTimeline.length - 1]?.hour}</span>
                    </div>
                  </div>
                )}

                {/* Top IPs + Referers side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Top IPs */}
                  {analytics.stats.topIPs && analytics.stats.topIPs.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5">{vi.shortLinks.analytics.topIPs}</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {analytics.stats.topIPs.map((entry, i) => (
                          <div key={entry.ip} className="flex items-center gap-2 text-xs">
                            <span className={cn(
                              "inline-flex items-center justify-center size-4 rounded text-[9px] font-black",
                              i === 0 ? "bg-amber-100 text-amber-700" : "bg-[var(--border-soft)] text-[var(--fg-muted)]"
                            )}>{i + 1}</span>
                            <span className="font-mono text-[var(--fg-base)] flex-1 truncate">{entry.ip}</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold",
                              entry.count >= 5 ? "bg-red-100 text-red-600" :
                              entry.count >= 3 ? "bg-amber-100 text-amber-600" :
                              "bg-emerald-100 text-emerald-600"
                            )}>{entry.count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Referer Domains */}
                  {analytics.stats.referers && Object.keys(analytics.stats.referers).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5">🔗 {vi.shortLinks.analytics.trafficSources}</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {Object.entries(analytics.stats.referers)
                          .sort((a, b) => b[1] - a[1])
                          .map(([domain, count]) => (
                            <div key={domain} className="flex items-center gap-2 text-xs">
                              <span className="text-[var(--fg-base)] flex-1 truncate font-medium">
                                {domain === 'direct' ? `🎯 ${vi.shortLinks.shared.directAccess}` : domain}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                                {count}×
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Detailed Click Log Table */}
                {(analytics.clicks?.length ?? 0) > 0 && (
                  <ClickLogTable clicks={analytics.clicks} />
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-[var(--fg-muted)] py-4">{vi.shortLinks.analytics.noAnalytics}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€ Click Log Table with Expandable Rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ClickLogTable({ clicks }: {
  clicks: Array<{
    id: string;
    ip_address: string;
    user_agent: string | null;
    referer: string | null;
    country: string | null;
    device_type: string | null;
    is_suspicious: boolean;
    suspicious_reason: string | null;
    clicked_at: string;
  }>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  function abbreviateReferer(ref: string | null): string {
    if (!ref) return "-";
    try { return new URL(ref).hostname; } catch { return ref.length > 30 ? ref.slice(0, 30) + '...' : ref; }
  }

  function abbreviateUA(ua: string | null): string {
    if (!ua) return vi.shortLinks.analytics.noData;
    // Extract browser + OS hint
    const match = ua.match(/(Chrome|Firefox|Safari|Edge|Zalo|Telegram|Facebook|Bot|curl|wget|python)\/?([\d.]*)/i);
    if (match) return `${match[1]} ${match[2] || ''}`.trim();
    return ua.length > 40 ? ua.slice(0, 40) + '...' : ua;
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-2">
        {vi.shortLinks.analytics.clickLog(clicks.length)}
      </p>
      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-[var(--border-soft)]">
        <table className="w-full text-xs">
          <thead className="bg-[var(--border-soft)]/50 sticky top-0 z-[5]">
            <tr>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] w-[100px]">{vi.shortLinks.analytics.time}</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)]">{vi.shortLinks.analytics.ipAddress}</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] w-[70px]">{vi.shortLinks.analytics.device}</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] hidden sm:table-cell">{vi.shortLinks.analytics.source}</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] hidden sm:table-cell w-[80px]">{vi.shortLinks.analytics.browser}</th>
              <th className="px-2.5 py-2 text-left font-bold text-[var(--fg-muted)] w-[90px]">{vi.shortLinks.analytics.status}</th>
              <th className="px-2.5 py-2 w-[30px]"></th>
            </tr>
          </thead>
          <tbody>
            {clicks.slice(0, visibleCount).map((click) => {
              const DevIcon = DEVICE_ICONS[click.device_type ?? ""] || Globe;
              const isExpanded = expandedId === click.id;

              return (
                <Fragment key={click.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : click.id)}
                    className={cn(
                      "border-t border-[var(--border-soft)] cursor-pointer transition-colors",
                      click.is_suspicious
                        ? "bg-red-50/50 hover:bg-red-50"
                        : "hover:bg-[var(--border-soft)]/30",
                      isExpanded && "bg-blue-50/50"
                    )}
                  >
                    <td className="px-2.5 py-2 text-[var(--fg-muted)] whitespace-nowrap">{formatRelative(click.clicked_at)}</td>
                    <td className="px-2.5 py-2 font-mono text-[var(--fg-base)] font-medium">{click.ip_address}</td>
                    <td className="px-2.5 py-2">
                      <span className="inline-flex items-center gap-1 text-[var(--fg-muted)]">
                        <DevIcon className="size-3" />
                        <span>{formatDeviceTypeLabel(click.device_type)}</span>
                      </span>
                    </td>
                    <td className="px-2.5 py-2 hidden sm:table-cell">
                      <span className="text-[var(--fg-muted)] truncate max-w-[120px] block text-[11px]">
                        {abbreviateReferer(click.referer)}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 hidden sm:table-cell">
                      <span className="text-[11px] text-[var(--fg-muted)] truncate block max-w-[100px]">
                        {abbreviateUA(click.user_agent)}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      {click.is_suspicious ? (
                        <span className="inline-flex items-center gap-1 text-red-500 font-bold text-[10px]">
                          <AlertTriangle className="size-3" />
                          <span className="truncate max-w-[60px]">{click.suspicious_reason || vi.shortLinks.analytics.suspiciousReason}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[10px]">
                          <CheckCircle2 className="size-3" /> {vi.shortLinks.analytics.valid}
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      <ChevronDown className={cn("size-3.5 text-[var(--fg-muted)] transition-transform", isExpanded && "rotate-180")} />
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {isExpanded && (
                    <tr className="border-t border-dashed border-[var(--border-soft)]">
                      <td colSpan={7} className="px-4 py-3 bg-slate-50/80">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                          <div className="space-y-2">
                            <div>
                              <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">{vi.shortLinks.analytics.userAgentFull}</span>
                              <p className="font-mono text-[10px] text-[var(--fg-base)] bg-white px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] break-all leading-relaxed">
                                {click.user_agent || "-"}
                              </p>
                            </div>
                            <div>
                              <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">{vi.shortLinks.analytics.sourceFull}</span>
                              <p className="font-mono text-[10px] text-[var(--fg-base)] bg-white px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] break-all">
                                {click.referer || vi.shortLinks.shared.directAccess}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">{vi.shortLinks.analytics.ipAddress}</span>
                                <p className="font-mono text-sm font-bold text-[var(--fg-base)]">{click.ip_address}</p>
                              </div>
                              <div>
                                <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">{vi.shortLinks.analytics.device}</span>
                                <p className="text-sm font-bold text-[var(--fg-base)] capitalize flex items-center gap-1.5">
                                  <DevIcon className="size-4" />
                                  {formatDeviceTypeLabel(click.device_type)}
                                </p>
                              </div>
                            </div>
                            <div>
                              <span className="font-bold text-[var(--fg-muted)] uppercase tracking-wider text-[9px] block mb-0.5">{vi.shortLinks.analytics.exactTime}</span>
                              <p className="text-[var(--fg-base)] font-medium">
                                {formatDateLabel(click.clicked_at)}
                              </p>
                            </div>
                            {click.is_suspicious && (
                              <div className="p-2 rounded-lg bg-red-50 border border-red-200/40">
                                <span className="font-bold text-red-600 text-[10px] flex items-center gap-1">
                                  <AlertTriangle className="size-3" />
                                  {vi.shortLinks.analytics.suspiciousDetected} {click.suspicious_reason}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {clicks.length > visibleCount && (
        <button
          onClick={() => setVisibleCount(v => v + 20)}
          className="w-full mt-2 py-2 text-center text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)]/5 rounded-lg transition-colors cursor-pointer"
        >
            {vi.shortLinks.detail.loadMore(Math.min(20, clicks.length - visibleCount), visibleCount, clicks.length)}
          </button>
      )}
    </div>
  );
}

function StatMini({ icon: Icon, label, value, color }: {
  icon: typeof BarChart3; label: string; value: string | number; color: string;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-[var(--border-soft)]/30">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={cn("size-3", color)} />
        <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase">{label}</span>
      </div>
      <p className="text-sm font-black text-[var(--fg-base)] truncate">{value}</p>
    </div>
  );
}




