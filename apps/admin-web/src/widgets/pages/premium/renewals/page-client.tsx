"use client";

import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  PackageCheck,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppLayout } from "@/widgets/layout/app-layout";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import {
  EmptyState,
  PageContainer,
  PageHeader,
  SectionHeader,
  SurfaceCard,
} from "@/shared/ui/page-layout";
import { readApiEnvelope, type ApiEnvelope } from "@/shared/lib/api-client";
import { appToast } from "@/shared/lib/toast";
import { formatMoney } from "@/lib/utils";
import { getBillingCycleLabel } from "@/lib/domain/premium-renewal-finance";
import { RenewalRequestModal } from "@/widgets/pages/premium/subscriptions/components/renewal-request-modal";
import { RenewalConfirmModal } from "./components/renewal-confirm-modal";

type DueStateFilter = "all" | "expired" | "expiring" | "safe";
type RenewalStateFilter =
  | "actionable"
  | "all"
  | "eligible"
  | "blocked"
  | "none"
  | "pending"
  | "confirmed"
  | "denied"
  | "not_renewing";
type SubscriptionStatusFilter = "all" | "active" | "non_active";
type SortMode = "expiry_asc" | "expiry_desc" | "customer_asc" | "purchase_desc";
type AccountBindingFilter = "all" | "linked" | "placeholder";

type LatestRenewalRow = {
  id: string;
  original_subscription_id: string;
  status: string;
  renewal_requested_date: string | null;
  renewal_confirmed_date: string | null;
  renewal_price: number | null;
  total_price: number | null;
  new_billing_cycle: string | null;
  new_cycle_months: number | null;
  cost_price: number | null;
  collected_amount: number | null;
  profit_amount: number | null;
  new_product_id: string | null;
  new_product_name_snapshot: string | null;
  new_product_duration_months: number | null;
  new_product_sell_price_vnd: number | null;
  new_product_buy_price_vnd: number | null;
  customer_response: string | null;
  customer_response_date: string | null;
  decline_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SubscriptionRow = {
  id: string;
  account_id: string;
  customer_id: string;
  order_id: string | null;
  premium_account_id: string;
  premium_account_user_id: string | null;
  service_type_id: string;
  package_id: string;
  purchase_date: string;
  billing_cycle: string;
  cycle_months: number;
  start_date: string;
  expiry_date: string;
  days_remaining: number;
  original_price: number;
  final_price: number;
  discount: number;
  renewal_status: string;
  status: string;
  notes: string | null;
  renewal_asked_at: string | null;
  renewal_confirmed_at: string | null;
  renewal_denied_at: string | null;
  renewal_denied_reason: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string;
  account_email: string;
  service_name: string;
  package_name?: string | null;
  order_code?: string | null;
  order_contact_snapshot?: string | null;
  order_product_name?: string | null;
  order_sales_note?: string | null;
  order_status?: string | null;
  sales_channel_id?: string | null;
  sales_channel_name?: string | null;
  package_default_price?: number | null;
  renewal_price_factor?: number | null;
  renewal_block_reason?: string | null;
  no_renew_block_reason?: string | null;
  premium_account_users?: {
    user_email?: string | null;
    status?: string | null;
  } | null;
  latest_renewal?: LatestRenewalRow | null;
  latest_renewal_status?: string | null;
  reminder_message?: string | null;
  can_renew?: boolean;
  can_mark_no_renew?: boolean;
  placeholder_account?: boolean;
};

type RenewalConfirmRow = LatestRenewalRow & {
  customer_name: string;
  service_name: string;
  current_billing_cycle?: string | null;
  current_cycle_months?: number | null;
  current_expiry_date?: string | null;
  current_subscription_price?: number | null;
  package_default_price?: number | null;
};

type ManualFilterState = {
  search: string;
  serviceName: string;
  packageId: string;
  salesChannelId: string;
  expiryMonth: string;
  dueState: DueStateFilter;
  renewalState: RenewalStateFilter;
  subscriptionStatus: SubscriptionStatusFilter;
  accountBinding: AccountBindingFilter;
  sortBy: SortMode;
};

type FilterOption = {
  value: string;
  label: string;
  count: number;
};

type SubscriptionSummary = {
  total: number;
  eligibleCount: number;
  blockedCount: number;
  activeCount: number;
  expiredCount: number;
  expiringCount: number;
  pendingCount: number;
  notRenewingCount?: number;
};

type SubscriptionFiltersMeta = {
  services: FilterOption[];
  packages: FilterOption[];
  salesChannels: FilterOption[];
  expiryMonths: FilterOption[];
};

type SubscriptionSourceState = {
  premiumSubscriptions: number;
  premiumAccounts: number;
  orders: number;
  paidOrdersReady: number;
  placeholderAccounts: number;
  linkedAccounts: number;
};

type SubscriptionPaginationMeta = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  start: number;
  end: number;
};

type SubscriptionListMeta = {
  total: number;
  summary: SubscriptionSummary;
  overallSummary: SubscriptionSummary;
  filters: SubscriptionFiltersMeta;
  sourceState: SubscriptionSourceState;
  pagination: SubscriptionPaginationMeta;
  applied: Record<string, unknown>;
};

const DEFAULT_FILTERS: ManualFilterState = {
  search: "",
  serviceName: "all",
  packageId: "all",
  salesChannelId: "all",
  expiryMonth: "all",
  dueState: "all",
  renewalState: "actionable",
  subscriptionStatus: "all",
  accountBinding: "all",
  sortBy: "expiry_asc",
};

type QueryReader = {
  get: (name: string) => string | null;
};

type RenewalsListState = {
  filters: ManualFilterState;
  currentPage: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 18;
const PAGE_SIZE_OPTIONS = [12, 18, 30, 48] as const;
const DUE_STATE_VALUES = new Set<DueStateFilter>(["all", "expired", "expiring", "safe"]);
const RENEWAL_STATE_VALUES = new Set<RenewalStateFilter>([
  "actionable",
  "all",
  "eligible",
  "blocked",
  "none",
  "pending",
  "confirmed",
  "denied",
  "not_renewing",
]);
const SUBSCRIPTION_STATUS_VALUES = new Set<SubscriptionStatusFilter>(["all", "active", "non_active"]);
const ACCOUNT_BINDING_VALUES = new Set<AccountBindingFilter>(["all", "linked", "placeholder"]);
const SORT_MODE_VALUES = new Set<SortMode>(["expiry_asc", "expiry_desc", "customer_asc", "purchase_desc"]);

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null) {
  const parsed = parsePositiveInteger(value, DEFAULT_PAGE_SIZE);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : DEFAULT_PAGE_SIZE;
}

function readEnumParam<T extends string>(params: QueryReader, key: string, values: Set<T>, fallback: T) {
  const value = params.get(key);
  return value && values.has(value as T) ? (value as T) : fallback;
}

function readTextParam(params: QueryReader, key: string, fallback = "all") {
  return params.get(key)?.trim() || fallback;
}

function readRenewalsListState(params: QueryReader): RenewalsListState {
  return {
    filters: {
      search: params.get("search") ?? "",
      serviceName: readTextParam(params, "service_name"),
      packageId: readTextParam(params, "package_id"),
      salesChannelId: readTextParam(params, "sales_channel_id"),
      expiryMonth: readTextParam(params, "expiry_month"),
      dueState: readEnumParam(params, "due_state", DUE_STATE_VALUES, DEFAULT_FILTERS.dueState),
      renewalState: readEnumParam(params, "renewal_state", RENEWAL_STATE_VALUES, DEFAULT_FILTERS.renewalState),
      subscriptionStatus: readEnumParam(
        params,
        "subscription_status",
        SUBSCRIPTION_STATUS_VALUES,
        DEFAULT_FILTERS.subscriptionStatus,
      ),
      accountBinding: readEnumParam(params, "account_binding", ACCOUNT_BINDING_VALUES, DEFAULT_FILTERS.accountBinding),
      sortBy: readEnumParam(params, "sort_by", SORT_MODE_VALUES, DEFAULT_FILTERS.sortBy),
    },
    currentPage: parsePositiveInteger(params.get("page"), 1),
    pageSize: parsePageSize(params.get("page_size")),
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

function writeRenewalsListState(params: URLSearchParams, state: RenewalsListState) {
  const { filters } = state;

  setOptionalQueryParam(params, "search", filters.search);
  setOptionalQueryParam(params, "service_name", filters.serviceName, DEFAULT_FILTERS.serviceName);
  setOptionalQueryParam(params, "package_id", filters.packageId, DEFAULT_FILTERS.packageId);
  setOptionalQueryParam(params, "sales_channel_id", filters.salesChannelId, DEFAULT_FILTERS.salesChannelId);
  setOptionalQueryParam(params, "expiry_month", filters.expiryMonth, DEFAULT_FILTERS.expiryMonth);
  setOptionalQueryParam(params, "due_state", filters.dueState, DEFAULT_FILTERS.dueState);
  setOptionalQueryParam(params, "renewal_state", filters.renewalState, DEFAULT_FILTERS.renewalState);
  setOptionalQueryParam(params, "subscription_status", filters.subscriptionStatus, DEFAULT_FILTERS.subscriptionStatus);
  setOptionalQueryParam(params, "account_binding", filters.accountBinding, DEFAULT_FILTERS.accountBinding);
  setOptionalQueryParam(params, "sort_by", filters.sortBy, DEFAULT_FILTERS.sortBy);

  if (state.currentPage > 1) {
    params.set("page", String(state.currentPage));
  } else {
    params.delete("page");
  }

  if (state.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("page_size", String(state.pageSize));
  } else {
    params.delete("page_size");
  }
}

function buildRenewalsHref(params: URLSearchParams) {
  const queryString = params.toString();
  return queryString ? `/premium/renewals?${queryString}` : "/premium/renewals";
}

const EMPTY_SUMMARY: SubscriptionSummary = {
  total: 0,
  eligibleCount: 0,
  blockedCount: 0,
  activeCount: 0,
  expiredCount: 0,
  expiringCount: 0,
  pendingCount: 0,
  notRenewingCount: 0,
};

const EMPTY_META: SubscriptionListMeta = {
  total: 0,
  summary: EMPTY_SUMMARY,
  overallSummary: EMPTY_SUMMARY,
  filters: {
    services: [],
    packages: [],
    salesChannels: [],
    expiryMonths: [],
  },
  sourceState: {
    premiumSubscriptions: 0,
    premiumAccounts: 0,
    orders: 0,
    paidOrdersReady: 0,
    placeholderAccounts: 0,
    linkedAccounts: 0,
  },
  pagination: {
    page: 1,
    pageSize: 18,
    totalPages: 1,
    totalItems: 0,
    start: 0,
    end: 0,
  },
  applied: {},
};

function safeDateLabel(value?: string | null, pattern = "dd/MM/yyyy") {
  if (!value) {
    return "Chưa có";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return format(parsed, pattern);
}

function monthLabelFromKey(value: string) {
  const [year, month] = value.split("-");
  return year && month ? `Tháng ${month}/${year}` : value;
}

function getDueBadge(daysRemaining: number) {
  if (daysRemaining <= 0) {
    return {
      label: daysRemaining === 0 ? "Hết hạn hôm nay" : `Quá hạn ${Math.abs(daysRemaining)} ngày`,
      tone: "danger" as const,
    };
  }

  if (daysRemaining <= 7) {
    return {
      label: `Còn ${daysRemaining} ngày`,
      tone: "warning" as const,
    };
  }

  return {
    label: `Còn ${daysRemaining} ngày`,
    tone: "positive" as const,
  };
}

function getRenewalStatusLabel(status?: string | null) {
  switch (status) {
    case "pending":
      return "Chờ duyệt";
    case "confirmed":
      return "Đã gia hạn";
    case "denied":
      return "Đã từ chối";
    case "not_renewing":
      return "Không gia hạn";
    case "none":
    case null:
    case undefined:
      return "Chưa xử lý";
    default:
      return status;
  }
}

function getRenewalBlockReason(subscription: SubscriptionRow) {
  if (subscription.renewal_block_reason) {
    return subscription.renewal_block_reason;
  }

  if (subscription.renewal_status === "pending") {
    return "Đã có yêu cầu gia hạn chờ duyệt";
  }

  if (subscription.renewal_status === "not_renewing") {
    return "Đã đánh dấu không gia hạn";
  }

  if (subscription.status === "active" || subscription.status === "expired") {
    return null;
  }

  if (subscription.status === "waiting_renewal") {
    return "Thuê bao đang chờ gia hạn";
  }

  if (subscription.status === "suspended") {
    return "Thuê bao đang tạm ngưng";
  }

  if (subscription.status === "refunded") {
    return "Thuê bao đã hoàn tiền";
  }

  if (subscription.status === "migrated") {
    return "Thuê bao đã migration";
  }

  return `Thuê bao đang ở trạng thái ${subscription.status}`;
}

function getNoRenewBlockReason(subscription: SubscriptionRow) {
  if (subscription.no_renew_block_reason) {
    return subscription.no_renew_block_reason;
  }

  if (subscription.renewal_status === "not_renewing") {
    return "Đã đánh dấu không gia hạn";
  }

  if (subscription.status === "active" || subscription.status === "expired") {
    return null;
  }

  return `Thuê bao đang ở trạng thái ${subscription.status}`;
}

function getRenewalTone(status?: string | null): "neutral" | "positive" | "warning" | "danger" {
  if (status === "pending") return "warning";
  if (status === "confirmed") return "positive";
  if (status === "denied" || status === "not_renewing") return "danger";
  return "neutral";
}

function buildSubscriptionsQuery(filters: ManualFilterState, page: number, pageSize: number) {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.serviceName !== "all") params.set("service_name", filters.serviceName);
  if (filters.packageId !== "all") params.set("package_id", filters.packageId);
  if (filters.salesChannelId !== "all") params.set("sales_channel_id", filters.salesChannelId);
  if (filters.expiryMonth !== "all") params.set("expiry_month", filters.expiryMonth);
  if (filters.dueState !== "all") params.set("due_state", filters.dueState);
  params.set("renewal_state", filters.renewalState);
  if (filters.subscriptionStatus !== "all") params.set("subscription_status", filters.subscriptionStatus);
  if (filters.accountBinding !== "all") params.set("account_binding", filters.accountBinding);
  if (filters.sortBy !== "expiry_asc") params.set("sort_by", filters.sortBy);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));

  return `/api/premium/subscriptions?${params.toString()}`;
}

function buildConfirmRow(subscription: SubscriptionRow): RenewalConfirmRow | null {
  if (!subscription.latest_renewal || subscription.latest_renewal.status !== "pending") {
    return null;
  }

  return {
    ...subscription.latest_renewal,
    customer_name: subscription.customer_name,
    service_name: subscription.service_name,
    current_billing_cycle: subscription.billing_cycle,
    current_cycle_months: subscription.cycle_months,
    current_expiry_date: subscription.expiry_date,
    current_subscription_price: Number(subscription.final_price ?? subscription.original_price ?? 0),
    package_default_price: subscription.package_default_price ?? 0,
  };
}

export default function PremiumRenewalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialListState = readRenewalsListState(searchParams);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [subscriptionMeta, setSubscriptionMeta] = useState<SubscriptionListMeta>(EMPTY_META);
  const [filterCatalog, setFilterCatalog] = useState<SubscriptionFiltersMeta>(EMPTY_META.filters);
  const [filters, setFilters] = useState<ManualFilterState>(initialListState.filters);
  const [currentPage, setCurrentPage] = useState(initialListState.currentPage);
  const [pageSize, setPageSize] = useState(initialListState.pageSize);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingPremium, setIsSyncingPremium] = useState(false);
  const [renewingSubscription, setRenewingSubscription] = useState<SubscriptionRow | null>(null);
  const [confirmingRenewal, setConfirmingRenewal] = useState<RenewalConfirmRow | null>(null);
  const [actioningSubscriptionId, setActioningSubscriptionId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search);
  const requestedFilters = useMemo(
    () => ({ ...filters, search: deferredSearch }),
    [deferredSearch, filters],
  );
  const requestUrl = useMemo(
    () => buildSubscriptionsQuery(requestedFilters, currentPage, pageSize),
    [currentPage, pageSize, requestedFilters],
  );

  useEffect(() => {
    const nextState = readRenewalsListState(searchParams);
    setFilters(nextState.filters);
    setCurrentPage(nextState.currentPage);
    setPageSize(nextState.pageSize);
  }, [searchParams]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    const params = new URLSearchParams(currentQuery);
    writeRenewalsListState(params, { filters, currentPage, pageSize });

    if (params.toString() !== currentQuery) {
      router.replace(buildRenewalsHref(params), { scroll: false });
    }
  }, [currentPage, filters, pageSize, router, searchParams]);
  const summary = subscriptionMeta.summary ?? EMPTY_SUMMARY;
  const overallSummary = subscriptionMeta.overallSummary ?? EMPTY_SUMMARY;
  const hasCoverageGap =
    subscriptionMeta.sourceState.paidOrdersReady > subscriptionMeta.sourceState.premiumSubscriptions ||
    subscriptionMeta.sourceState.placeholderAccounts > 0;

  const refreshSubscriptions = useCallback(async (url = requestUrl) => {
    setIsLoading(true);
    try {
      const response = await fetch(url);
      const payload = (await readApiEnvelope<SubscriptionRow[]>(response)) as ApiEnvelope<SubscriptionRow[]> & {
        meta?: SubscriptionListMeta;
      };

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể tải danh sách thuê bao");
        setSubscriptions([]);
        setSubscriptionMeta(EMPTY_META);
        return;
      }

      setSubscriptions(payload.data ?? []);
      setSubscriptionMeta(payload.meta ?? EMPTY_META);
      setFilterCatalog(payload.meta?.filters ?? EMPTY_META.filters);
      if (payload.meta?.pagination?.page && payload.meta.pagination.page !== currentPage) {
        setCurrentPage(payload.meta.pagination.page);
      }
    } catch (error) {
      console.error("[PremiumRenewalsPage] refreshSubscriptions", error);
      appToast.error("Không thể tải danh sách thuê bao");
      setSubscriptions([]);
      setSubscriptionMeta(EMPTY_META);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, requestUrl]);

  useEffect(() => {
    void refreshSubscriptions(requestUrl);
  }, [refreshSubscriptions, requestUrl]);

  function updateFilter<K extends keyof ManualFilterState>(key: K, value: ManualFilterState[K]) {
    setCurrentPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyQuickView(view: "all" | "actionable" | "pending" | "expiring" | "overdue" | "not_renewing") {
    setCurrentPage(1);

    switch (view) {
      case "all":
        setFilters((current) => ({
          ...current,
          renewalState: "all",
          dueState: "all",
          subscriptionStatus: "all",
        }));
        return;
      case "actionable":
        setFilters((current) => ({
          ...current,
          renewalState: "actionable",
          dueState: "all",
          subscriptionStatus: "all",
        }));
        return;
      case "pending":
        setFilters((current) => ({
          ...current,
          renewalState: "pending",
          dueState: "all",
        }));
        return;
      case "expiring":
        setFilters((current) => ({
          ...current,
          renewalState: "actionable",
          dueState: "expiring",
          subscriptionStatus: "active",
        }));
        return;
      case "overdue":
        setFilters((current) => ({
          ...current,
          renewalState: "actionable",
          dueState: "expired",
          subscriptionStatus: "all",
        }));
        return;
      case "not_renewing":
        setFilters((current) => ({
          ...current,
          renewalState: "not_renewing",
          dueState: "all",
          subscriptionStatus: "all",
        }));
        return;
      default:
        return;
    }
  }

  async function copyToClipboard(text: string | null | undefined, successMessage = "Đã sao chép") {
    if (!text) {
      appToast.error("Không có nội dung để sao chép");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[PremiumRenewalsPage] copy", error);
      appToast.error("Không thể sao chép");
    }
  }

  async function handleSyncPremiumData() {
    setIsSyncingPremium(true);
    try {
      const response = await fetch("/api/premium/sync", { method: "POST" });
      const payload = await readApiEnvelope(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể đồng bộ dữ liệu premium");
        return;
      }

      appToast.success("Đã đồng bộ dữ liệu premium từ đơn đã bán");
      await refreshSubscriptions();
    } catch (error) {
      console.error("[PremiumRenewalsPage] handleSyncPremiumData", error);
      appToast.error("Không thể đồng bộ dữ liệu premium");
    } finally {
      setIsSyncingPremium(false);
    }
  }

  async function handleMarkNoRenew(subscription: SubscriptionRow) {
    const reason = window.prompt(
      `Lý do đánh dấu không gia hạn cho ${subscription.customer_name}?`,
      subscription.renewal_denied_reason ?? "",
    );

    if (reason === null) {
      return;
    }

    setActioningSubscriptionId(subscription.id);
    try {
      const response = await fetch(`/api/premium/subscriptions/${subscription.id}/no-renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const payload = await readApiEnvelope(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể chuyển sang không gia hạn");
        return;
      }

      appToast.success("Đã chuyển sang không gia hạn. Mặc định danh sách sẽ ẩn đơn này.");
      await refreshSubscriptions();
    } catch (error) {
      console.error("[PremiumRenewalsPage] handleMarkNoRenew", error);
      appToast.error("Không thể chuyển sang không gia hạn");
    } finally {
      setActioningSubscriptionId(null);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          eyebrow="PREMIUM RENEWALS V2"
          title="Kế hoạch gia hạn thuê bao"
          description="Tìm đúng đơn theo khách, mã đơn, sản phẩm, CTV, hạn dùng hoặc trạng thái rồi xử lý từng đơn. Không có gia hạn hàng loạt để tránh thao tác nhầm."
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={isSyncingPremium}
                onClick={() => void handleSyncPremiumData()}
                className="rounded-full"
              >
                <RefreshCw className={`size-4 ${isSyncingPremium ? "animate-spin" : ""}`} />
                Đồng bộ đơn đã bán
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isLoading}
                onClick={() => void refreshSubscriptions()}
                className="rounded-full"
              >
                <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <RenewalFilterPanel
            filters={filters}
            filterCatalog={filterCatalog}
            totalCount={subscriptionMeta.pagination.totalItems}
            overallCount={overallSummary.total}
            onChange={updateFilter}
            onReset={() => {
              setCurrentPage(1);
              setFilters(DEFAULT_FILTERS);
            }}
          />

          <div className="grid min-w-0 gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Đang hiển thị" value={summary.total} tone="accent" />
              <MetricCard label="Quá hạn" value={summary.expiredCount} tone="danger" />
              <MetricCard label="Sắp hết hạn" value={summary.expiringCount} tone="warning" />
              <MetricCard label="Chờ duyệt" value={summary.pendingCount} tone="warning" />
              <MetricCard label="Không gia hạn" value={overallSummary.notRenewingCount ?? 0} tone="danger" />
              <MetricCard label="Account tạm" value={subscriptionMeta.sourceState.placeholderAccounts} tone="neutral" />
            </div>

            <div className="flex flex-wrap gap-2">
              <QuickPresetChip
                label="Tất cả"
                count={overallSummary.total}
                active={filters.renewalState === "all" && filters.dueState === "all"}
                tone="neutral"
                onClick={() => applyQuickView("all")}
              />
              <QuickPresetChip
                label="Cần xử lý"
                count={summary.eligibleCount}
                active={
                  filters.renewalState === "actionable" &&
                  filters.dueState === "all" &&
                  filters.subscriptionStatus === "all"
                }
                tone="accent"
                onClick={() => applyQuickView("actionable")}
              />
              <QuickPresetChip
                label="Chờ duyệt"
                count={summary.pendingCount}
                active={filters.renewalState === "pending"}
                tone="warning"
                onClick={() => applyQuickView("pending")}
              />
              <QuickPresetChip
                label="Sắp hết hạn"
                count={summary.expiringCount}
                active={filters.dueState === "expiring"}
                tone="warning"
                onClick={() => applyQuickView("expiring")}
              />
              <QuickPresetChip
                label="Quá hạn"
                count={summary.expiredCount}
                active={filters.dueState === "expired" && filters.subscriptionStatus === "all"}
                tone="danger"
                onClick={() => applyQuickView("overdue")}
              />
              <QuickPresetChip
                label="Không gia hạn"
                count={overallSummary.notRenewingCount ?? 0}
                active={filters.renewalState === "not_renewing"}
                tone="danger"
                onClick={() => applyQuickView("not_renewing")}
              />
            </div>

            {hasCoverageGap ? (
              <SurfaceCard className="border-amber-200 bg-amber-50/80">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
                    <div>
                      <p className="text-[14px] font-black text-amber-900">Dữ liệu premium còn lệch với đơn đã bán</p>
                      <p className="mt-1 text-[12px] leading-5 text-amber-800">
                        Có {subscriptionMeta.sourceState.paidOrdersReady} đơn đã bán sẵn sàng, {subscriptionMeta.sourceState.premiumSubscriptions} thuê bao premium và {subscriptionMeta.sourceState.placeholderAccounts} account tạm.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSyncingPremium}
                    onClick={() => void handleSyncPremiumData()}
                    className="rounded-full"
                  >
                    <RefreshCw className={`size-4 ${isSyncingPremium ? "animate-spin" : ""}`} />
                    Đồng bộ ngay
                  </Button>
                </div>
              </SurfaceCard>
            ) : null}

            <SurfaceCard>
              <SectionHeader
                title="Danh sách thuê bao cần xử lý"
                description={
                  subscriptionMeta.pagination.totalItems > 0
                    ? `Hiển thị ${subscriptionMeta.pagination.start}-${subscriptionMeta.pagination.end} / ${subscriptionMeta.pagination.totalItems} kết quả sau lọc.`
                    : "Không có thuê bao phù hợp với bộ lọc hiện tại."
                }
                action={
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label="Số thuê bao gia hạn mỗi trang"
                      name="premium-renewals-page-size"
                      value={String(pageSize)}
                      onChange={(event) => {
                        setCurrentPage(1);
                        setPageSize(Number(event.target.value));
                      }}
                      className="h-10 w-[116px]"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}/card
                        </option>
                      ))}
                    </Select>
                  </div>
                }
              />

              {isLoading ? (
                <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-72 animate-pulse rounded-[1.6rem] border border-[var(--border-soft)] bg-white/80"
                    />
                  ))}
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Search className="size-6" />}
                    title={
                      overallSummary.total === 0
                        ? "Chưa có yêu cầu gia hạn"
                        : "Không tìm thấy thuê bao"
                    }
                    description={
                      overallSummary.total === 0
                        ? "Tenant này chưa có bản ghi gia hạn. Đi sang màn Thuê bao premium để chọn đơn cần gia hạn hoặc đánh dấu không gia hạn."
                        : "Mở rộng bộ lọc, chọn trạng thái 'Tất cả' hoặc 'Không gia hạn' nếu cần xem các đơn đã ẩn khỏi danh sách xử lý."
                    }
                    action={
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setCurrentPage(1);
                            setFilters(DEFAULT_FILTERS);
                          }}
                          className="rounded-full"
                        >
                          Đặt lại bộ lọc
                        </Button>
                        {overallSummary.total === 0 ? (
                          <Button
                            type="button"
                            onClick={() => router.push("/premium/subscriptions")}
                            className="rounded-full"
                          >
                            Mở subscriptions
                          </Button>
                        ) : null}
                      </div>
                    }
                  />
                </div>
              ) : (
                <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
                  {subscriptions.map((subscription) => (
                    <SubscriptionCard
                      key={subscription.id}
                      subscription={subscription}
                      actioning={actioningSubscriptionId === subscription.id}
                      onCopyReminder={() =>
                        void copyToClipboard(subscription.reminder_message, "Đã sao chép mẫu nhắc gia hạn")
                      }
                      onRenew={() => setRenewingSubscription(subscription)}
                      onConfirm={() => setConfirmingRenewal(buildConfirmRow(subscription))}
                      onMarkNoRenew={() => void handleMarkNoRenew(subscription)}
                      onOpenCustomer={() => router.push(`/customers/${subscription.customer_id}`)}
                      onOpenOrder={() => {
                        if (subscription.order_id) {
                          router.push(`/orders/${subscription.order_id}`);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {!isLoading && subscriptionMeta.pagination.totalItems > 0 ? (
                <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-[12px] text-[var(--fg-muted)]">
                    Trang {subscriptionMeta.pagination.page} / {subscriptionMeta.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                      className="rounded-full"
                    >
                      Trang trước
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={currentPage >= subscriptionMeta.pagination.totalPages}
                      onClick={() =>
                        setCurrentPage((current) => Math.min(subscriptionMeta.pagination.totalPages, current + 1))
                      }
                      className="rounded-full"
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              ) : null}
            </SurfaceCard>
          </div>
        </div>
      </PageContainer>

      <RenewalRequestModal
        subscription={renewingSubscription}
        onClose={() => setRenewingSubscription(null)}
        onSubmitted={() => refreshSubscriptions()}
      />
      <RenewalConfirmModal
        renewal={confirmingRenewal}
        onClose={() => setConfirmingRenewal(null)}
        onSubmitted={() => refreshSubscriptions()}
      />
    </AppLayout>
  );
}

function RenewalFilterPanel({
  filters,
  filterCatalog,
  totalCount,
  overallCount,
  onChange,
  onReset,
}: {
  filters: ManualFilterState;
  filterCatalog: SubscriptionFiltersMeta;
  totalCount: number;
  overallCount: number;
  onChange: <K extends keyof ManualFilterState>(key: K, value: ManualFilterState[K]) => void;
  onReset: () => void;
}) {
  return (
    <SurfaceCard className="h-fit lg:sticky lg:top-24">
      <div className="border-b border-[var(--border-soft)] p-4">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-[var(--accent)]" />
          <h2 className="text-[15px] font-black text-[var(--fg-base)]">Bộ lọc chuẩn</h2>
        </div>
        <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
          {totalCount} / {overallCount} thuê bao sau lọc
        </p>
      </div>

      <div className="grid gap-4 p-4">
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tìm kiếm</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              aria-label="Tìm thuê bao cần gia hạn"
              name="premium-renewal-search"
              value={filters.search}
              onChange={(event) => onChange("search", event.target.value)}
              placeholder="Mã đơn, khách, email, CTV, sản phẩm..."
              className="pl-10"
            />
          </div>
        </div>

        <FilterSelect
          label="Dịch vụ"
          value={filters.serviceName}
          onChange={(value) => onChange("serviceName", value)}
        >
          <option value="all">Tất cả dịch vụ</option>
          {filterCatalog.services.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count})
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Gói"
          value={filters.packageId}
          onChange={(value) => onChange("packageId", value)}
        >
          <option value="all">Tất cả gói</option>
          {filterCatalog.packages.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count})
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="CTV / kênh bán"
          value={filters.salesChannelId}
          onChange={(value) => onChange("salesChannelId", value)}
        >
          <option value="all">Tất cả CTV</option>
          {filterCatalog.salesChannels.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count})
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Tháng hết hạn"
          value={filters.expiryMonth}
          onChange={(value) => onChange("expiryMonth", value)}
        >
          <option value="all">Tất cả tháng</option>
          {filterCatalog.expiryMonths.map((option) => (
            <option key={option.value} value={option.value}>
              {monthLabelFromKey(option.label)} ({option.count})
            </option>
          ))}
        </FilterSelect>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tình trạng hạn dùng</p>
          <div className="grid gap-2">
            <CheckOption
              label="Tất cả hạn"
              checked={filters.dueState === "all"}
              onClick={() => onChange("dueState", "all")}
            />
            <CheckOption
              label="Quá hạn"
              checked={filters.dueState === "expired"}
              onClick={() => onChange("dueState", "expired")}
            />
            <CheckOption
              label="Sắp hết hạn"
              checked={filters.dueState === "expiring"}
              onClick={() => onChange("dueState", "expiring")}
            />
            <CheckOption
              label="Còn hạn"
              checked={filters.dueState === "safe"}
              onClick={() => onChange("dueState", "safe")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Trạng thái xử lý</p>
          <div className="grid gap-2">
            <CheckOption
              label="Cần xử lý"
              checked={filters.renewalState === "actionable"}
              onClick={() => onChange("renewalState", "actionable")}
            />
            <CheckOption
              label="Chờ duyệt"
              checked={filters.renewalState === "pending"}
              onClick={() => onChange("renewalState", "pending")}
            />
            <CheckOption
              label="Chưa có request"
              checked={filters.renewalState === "none"}
              onClick={() => onChange("renewalState", "none")}
            />
            <CheckOption
              label="Không gia hạn"
              checked={filters.renewalState === "not_renewing"}
              onClick={() => onChange("renewalState", "not_renewing")}
            />
            <CheckOption
              label="Tất cả trạng thái"
              checked={filters.renewalState === "all"}
              onClick={() => onChange("renewalState", "all")}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <FilterSelect
            label="Liên kết account"
            value={filters.accountBinding}
            onChange={(value) => onChange("accountBinding", value as AccountBindingFilter)}
          >
            <option value="all">Tất cả account</option>
            <option value="linked">Account thật</option>
            <option value="placeholder">Account tạm từ đơn</option>
          </FilterSelect>

          <FilterSelect
            label="Sắp xếp"
            value={filters.sortBy}
            onChange={(value) => onChange("sortBy", value as SortMode)}
          >
            <option value="expiry_asc">Hết hạn gần nhất</option>
            <option value="expiry_desc">Hết hạn xa nhất</option>
            <option value="customer_asc">Tên khách A-Z</option>
            <option value="purchase_desc">Mua mới nhất</option>
          </FilterSelect>
        </div>

        <Button type="button" variant="secondary" onClick={onReset} className="rounded-full">
          Đặt lại bộ lọc
        </Button>
      </div>
    </SurfaceCard>
  );
}

function SubscriptionCard({
  subscription,
  actioning,
  onCopyReminder,
  onRenew,
  onConfirm,
  onMarkNoRenew,
  onOpenCustomer,
  onOpenOrder,
}: {
  subscription: SubscriptionRow;
  actioning: boolean;
  onCopyReminder: () => void;
  onRenew: () => void;
  onConfirm: () => void;
  onMarkNoRenew: () => void;
  onOpenCustomer: () => void;
  onOpenOrder: () => void;
}) {
  const dueBadge = getDueBadge(Number(subscription.days_remaining ?? 0));
  const latestRenewal = subscription.latest_renewal ?? null;
  const confirmable = latestRenewal?.status === "pending";
  const canRenew = subscription.can_renew !== false;
  const canNoRenew = subscription.can_mark_no_renew !== false && subscription.renewal_status !== "not_renewing";
  const renewalBlockReason = getRenewalBlockReason(subscription);
  const noRenewBlockReason = getNoRenewBlockReason(subscription);
  const isBusy = actioning;

  return (
    <article className="flex min-h-[340px] flex-col rounded-[1.6rem] border border-[var(--border-soft)] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="max-w-[220px] truncate text-[16px] font-black text-[var(--fg-base)]">
              {subscription.customer_name}
            </h3>
            <StatusBadge tone={dueBadge.tone}>{dueBadge.label}</StatusBadge>
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] font-black text-emerald-700">
            {subscription.service_name} {subscription.package_name ? `• ${subscription.package_name}` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          <IconButton label="Khách" onClick={onOpenCustomer}>
            <User className="size-4" />
          </IconButton>
          <IconButton label="Đơn" disabled={!subscription.order_id} onClick={onOpenOrder}>
            <ExternalLink className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge tone={getRenewalTone(subscription.renewal_status)}>
          {getRenewalStatusLabel(subscription.renewal_status)}
        </StatusBadge>
        {subscription.placeholder_account ? <StatusBadge tone="warning">Account tạm</StatusBadge> : null}
        {subscription.sales_channel_name ? <StatusBadge tone="neutral">{subscription.sales_channel_name}</StatusBadge> : null}
      </div>

      {!canRenew && renewalBlockReason ? (
        <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
          <span className="font-black">Không thể gia hạn:</span> {renewalBlockReason}
        </div>
      ) : null}

      {!canNoRenew && noRenewBlockReason ? (
        <div className="mt-2 rounded-[1rem] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] leading-5 text-rose-800">
          <span className="font-black">Không gia hạn:</span> {noRenewBlockReason}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 text-[12px] text-[var(--fg-muted)]">
        <InfoLine label="Mã đơn" value={subscription.order_code ?? subscription.order_id ?? "Chưa gắn đơn"} mono />
        <InfoLine label="Tài khoản" value={subscription.premium_account_users?.user_email ?? subscription.account_email} />
        <InfoLine label="Kênh/contact" value={subscription.order_contact_snapshot ?? subscription.sales_channel_name ?? "Chưa có"} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <InfoPill label="Hết hạn" value={safeDateLabel(subscription.expiry_date)} tone={dueBadge.tone} />
        <InfoPill label="Chu kỳ" value={getBillingCycleLabel(subscription.billing_cycle)} />
        <InfoPill label="Giá hiện tại" value={formatMoney(Number(subscription.final_price ?? subscription.original_price ?? 0))} />
        <InfoPill
          label="Request mới nhất"
          value={
            latestRenewal
              ? latestRenewal.new_product_name_snapshot
                ? latestRenewal.new_product_name_snapshot
                : getRenewalStatusLabel(latestRenewal.status)
              : "Chưa có"
          }
          tone={getRenewalTone(latestRenewal?.status)}
        />
      </div>

      {subscription.renewal_status === "not_renewing" ? (
        <div className="mt-3 rounded-[1rem] border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] leading-5 text-rose-800">
          {subscription.renewal_denied_reason || latestRenewal?.decline_reason || "Đã đánh dấu không gia hạn. Chỉ hiện khi bật lọc Không gia hạn/Tất cả."}
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCopyReminder}
            disabled={isBusy}
            className="h-9 rounded-full px-3 text-[12px] font-bold"
          >
            <Copy className="size-3.5" />
            Mẫu nhắc
          </Button>

          {confirmable ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onConfirm}
              disabled={isBusy}
              className="h-9 rounded-full bg-emerald-500/10 px-3 text-[12px] font-bold text-emerald-700 hover:bg-emerald-500/20"
            >
              {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Xác nhận
            </Button>
          ) : null}

          <Button
            type="button"
            disabled={!canRenew || isBusy}
            onClick={onRenew}
            title={!canRenew && renewalBlockReason ? renewalBlockReason : undefined}
            className="h-9 rounded-full px-3 text-[12px] font-bold"
          >
            {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Gia hạn
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={!canNoRenew || isBusy}
            onClick={onMarkNoRenew}
            title={!canNoRenew && noRenewBlockReason ? noRenewBlockReason : undefined}
            className="h-9 rounded-full bg-rose-500/10 px-3 text-[12px] font-bold text-rose-700 hover:bg-rose-500/20"
          >
            {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
            Không gia hạn
          </Button>
        </div>
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
        {label}
      </label>
      <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </Select>
    </div>
  );
}

function CheckOption({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-[0.9rem] border px-3 py-2 text-left text-[12px] font-bold transition-[background-color,border-color,color] ${
        checked
          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
          : "border-[var(--border-soft)] bg-white text-[var(--fg-base)] hover:border-[var(--border-strong)]"
      }`}
    >
      <span
        className={`flex size-4 items-center justify-center rounded border ${
          checked ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)] bg-white"
        }`}
      >
        {checked ? <CheckCircle2 className="size-3" /> : null}
      </span>
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "accent" | "positive" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "accent"
      ? "bg-[var(--accent)]/12 text-[var(--accent)]"
      : tone === "positive"
        ? "bg-emerald-500/12 text-emerald-700"
        : tone === "warning"
          ? "bg-amber-500/12 text-amber-700"
          : tone === "danger"
            ? "bg-rose-500/12 text-rose-700"
            : "bg-slate-500/10 text-slate-700";

  return (
    <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-[var(--fg-base)]">{value}</p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-[1rem] ${toneClass}`}>
          {tone === "danger" ? (
            <ShieldAlert className="size-5" />
          ) : tone === "warning" ? (
            <CalendarClock className="size-5" />
          ) : tone === "positive" ? (
            <CheckCircle2 className="size-5" />
          ) : tone === "neutral" ? (
            <PackageCheck className="size-5" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </div>
      </div>
    </div>
  );
}

function QuickPresetChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: "accent" | "positive" | "warning" | "danger" | "neutral";
  onClick: () => void;
}) {
  const toneClass =
    tone === "accent"
      ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20"
      : tone === "positive"
        ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
        : tone === "warning"
          ? "bg-amber-500/10 text-amber-700 border-amber-200"
          : tone === "danger"
            ? "bg-rose-500/10 text-rose-700 border-rose-200"
            : "bg-slate-500/10 text-slate-700 border-slate-200";

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      className={`h-10 rounded-full border px-4 text-[12px] font-bold ${
        active
          ? `shadow-sm ${toneClass}`
          : "border-[var(--border-soft)] bg-white text-[var(--fg-base)] hover:border-[var(--border-strong)]"
      }`}
    >
      {label}
      <span
        className={`rounded-full border px-2 py-0.5 text-[11px] font-black leading-none ${
          active ? "border-current bg-white/80" : "border-[var(--border-soft)] bg-[var(--surface-light)]"
        }`}
      >
        {count}
      </span>
    </Button>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-500/10 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-700"
        : tone === "danger"
          ? "bg-rose-500/10 text-rose-700"
          : "bg-slate-500/10 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${toneClass}`}>
      {children}
    </span>
  );
}

function InfoLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
      <span className="font-bold text-[var(--fg-muted)]">{label}</span>
      <span className={`min-w-0 truncate font-bold text-[var(--fg-base)] ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function InfoPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-rose-700"
          : "text-[var(--fg-base)]";

  return (
    <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/55 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
      <p className={`mt-1 line-clamp-2 text-[12px] font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function IconButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white text-[var(--fg-muted)] transition-[border-color,color,opacity] hover:border-[var(--border-strong)] hover:text-[var(--fg-base)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
