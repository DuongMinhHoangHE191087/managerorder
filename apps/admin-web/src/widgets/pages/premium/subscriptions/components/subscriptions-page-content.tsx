"use client";

import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarClock,
  Copy,
  HandCoins,
  Link2,
  MonitorPlay,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";

import { AppLayout } from "@/widgets/layout/app-layout";
import { ActionMenu } from "@/shared/ui/action-menu";
import { FiltersBar, PageContainer, PageHeader, SurfaceCard, StatsGrid, EmptyState, SectionHeader } from "@/shared/ui/page-layout";
import { useContextMenu } from "@/shared/ui/context-menu";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import type { CustomerPremiumSubscription } from "@/lib/domain/premium-types";
import { cn, formatMoney } from "@/lib/utils";
import { getBillingCycleLabel } from "@/lib/domain/premium-renewal-finance";
import { RenewalRequestModal } from "./renewal-request-modal";
import { QuickMigrationModal } from "./quick-migration-modal";
import { Modal } from "@/shared/ui/modal";

type SubscriptionRow = CustomerPremiumSubscription & {
  customer_name: string;
  account_email: string;
  service_name: string;
  package_name?: string | null;
  order_code?: string | null;
  order_status?: string | null;
  can_renew?: boolean;
  can_mark_no_renew?: boolean;
  renewal_block_reason?: string | null;
  no_renew_block_reason?: string | null;
  migration_id: string | null;
  package_default_price?: number | null;
  renewal_price_factor?: number | null;
};

type RefundMutationPayload = {
  subscription?: Partial<SubscriptionRow>;
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

type SubscriptionStatusFilter =
  | "all"
  | "active"
  | "non_active"
  | "waiting_renewal"
  | "renewed"
  | "expired"
  | "migrated"
  | "refunded"
  | "suspended";

type OrderStatusFilter = "all" | "none" | "pending_payment" | "paid" | "provisioning" | "active" | "expired" | "refunded" | "cancelled";

type FilterOption = {
  value: string;
  label: string;
  count: number;
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
  pagination: SubscriptionPaginationMeta;
  filters?: {
    salesChannels: FilterOption[];
    orderStatuses?: FilterOption[];
    subscriptionStatuses?: FilterOption[];
  };
};

type QueryReader = {
  get: (name: string) => string | null;
};

type SubscriptionsListState = {
  search: string;
  renewalFilter: string;
  statusFilter: SubscriptionStatusFilter;
  orderStatusFilter: OrderStatusFilter;
  salesChannelId: string;
  currentPage: number;
  pageSize: number;
};

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
  pagination: {
    page: 1,
    pageSize: 12,
    totalPages: 1,
    totalItems: 0,
    start: 0,
    end: 0,
  },
  filters: {
    salesChannels: [],
    orderStatuses: [],
    subscriptionStatuses: [],
  },
};

const EMPTY_FILTERS = {
  salesChannels: [] as FilterOption[],
  orderStatuses: [] as FilterOption[],
  subscriptionStatuses: [] as FilterOption[],
};

const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS = [12, 24, 36, 48] as const;
const RENEWAL_FILTER_VALUES = new Set(["all", "none", "pending", "confirmed", "denied", "not_renewing"]);
const SUBSCRIPTION_STATUS_VALUES = new Set<SubscriptionStatusFilter>([
  "all",
  "active",
  "non_active",
  "waiting_renewal",
  "renewed",
  "expired",
  "migrated",
  "refunded",
  "suspended",
]);
const ORDER_STATUS_VALUES = new Set<OrderStatusFilter>([
  "all",
  "none",
  "pending_payment",
  "paid",
  "provisioning",
  "active",
  "expired",
  "refunded",
  "cancelled",
]);

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

function readSubscriptionsListState(params: QueryReader): SubscriptionsListState {
  return {
    search: params.get("search") ?? "",
    renewalFilter: readEnumParam(params, "renewal_state", RENEWAL_FILTER_VALUES, "all"),
    statusFilter: readEnumParam(params, "subscription_status", SUBSCRIPTION_STATUS_VALUES, "all"),
    orderStatusFilter: readEnumParam(params, "order_status", ORDER_STATUS_VALUES, "all"),
    salesChannelId: params.get("sales_channel_id") ?? "all",
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

function writeSubscriptionsListState(params: URLSearchParams, state: SubscriptionsListState) {
  setOptionalQueryParam(params, "search", state.search);
  setOptionalQueryParam(params, "renewal_state", state.renewalFilter, "all");
  setOptionalQueryParam(params, "subscription_status", state.statusFilter, "all");
  setOptionalQueryParam(params, "order_status", state.orderStatusFilter, "all");
  setOptionalQueryParam(params, "sales_channel_id", state.salesChannelId, "all");

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

function buildSubscriptionsHref(params: URLSearchParams) {
  const queryString = params.toString();
  return queryString ? `/premium/subscriptions?${queryString}` : "/premium/subscriptions";
}

function buildSubscriptionsQuery(params: {
  search: string;
  renewalFilter: string;
  statusFilter: string;
  orderStatusFilter: string;
  salesChannelId: string;
  page: number;
  pageSize: number;
}) {
  const searchParams = new URLSearchParams();
  const search = params.search.trim();

  if (search) {
    searchParams.set("search", search);
  }
  searchParams.set("renewal_state", params.renewalFilter === "all" ? "all" : params.renewalFilter);
  if (params.statusFilter !== "all") {
    searchParams.set("subscription_status", params.statusFilter);
  }
  if (params.orderStatusFilter !== "all") {
    searchParams.set("order_status", params.orderStatusFilter);
  }
  if (params.salesChannelId !== "all") {
    searchParams.set("sales_channel_id", params.salesChannelId);
  }
  searchParams.set("page", String(params.page));
  searchParams.set("page_size", String(params.pageSize));
  searchParams.set("sort_by", "expiry_asc");

  return `/api/premium/subscriptions?${searchParams.toString()}`;
}

function getRenewalStatusLabel(status: string) {
  switch (status) {
    case "none":
      return "Chưa tạo yêu cầu";
    case "pending":
      return "Đang chờ xử lý";
    case "confirmed":
      return "Đã xác nhận";
    case "denied":
      return "Đã từ chối";
    case "not_renewing":
      return "Không gia hạn";
    case "migrated":
      return "Đã di chuyển";
    case "refunded":
      return "Đã hoàn tiền";
    default:
      return status;
  }
}

function canRenewSubscription(subscription: SubscriptionRow) {
  return subscription.can_renew !== false;
}

function canRefundSubscription(subscription: SubscriptionRow) {
  return subscription.renewal_status === "denied" && subscription.original_price > 0;
}

function canMarkNoRenew(subscription: SubscriptionRow) {
  return subscription.can_mark_no_renew !== false && subscription.renewal_status !== "not_renewing";
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

function buildReminderMessage(subscription: SubscriptionRow) {
  const expiryDate = new Date(subscription.expiry_date);
  const expiryLabel = Number.isNaN(expiryDate.getTime())
    ? "ngày hết hạn hiện tại"
    : expiryDate.toLocaleDateString("vi-VN");
  const remaining = Number(subscription.days_remaining ?? 0);
  const dueText = remaining <= 0 ? `đã quá hạn ${Math.abs(remaining)} ngày` : `còn ${remaining} ngày`;
  const orderText = subscription.order_code ? `, mã đơn ${subscription.order_code}` : "";

  return `Chào ${subscription.customer_name}, gói ${subscription.service_name}${subscription.package_name ? ` - ${subscription.package_name}` : ""}${orderText} sẽ hết hạn ${expiryLabel} (${dueText}). Anh/chị xác nhận giúp em gói và số tháng muốn gia hạn để em xử lý tiếp.`;
}



export default function PremiumSubscriptionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openContextMenu, ContextMenuRender } = useContextMenu();
  const initialListState = readSubscriptionsListState(searchParams);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [meta, setMeta] = useState<SubscriptionListMeta>(EMPTY_META);
  const [search, setSearch] = useState(initialListState.search);
  const [renewalFilter, setRenewalFilter] = useState(initialListState.renewalFilter);
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatusFilter>(initialListState.statusFilter);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>(initialListState.orderStatusFilter);
  const [salesChannelId, setSalesChannelId] = useState(initialListState.salesChannelId);
  const [currentPage, setCurrentPage] = useState(initialListState.currentPage);
  const [pageSize, setPageSize] = useState(initialListState.pageSize);
  const [isLoading, setIsLoading] = useState(true);
  const [renewingSubscription, setRenewingSubscription] = useState<SubscriptionRow | null>(null);
  const [migratingSubscription, setMigratingSubscription] = useState<SubscriptionRow | null>(null);
  const [noRenewSub, setNoRenewSub] = useState<SubscriptionRow | null>(null);
  const [noRenewReason, setNoRenewReason] = useState("");
  const deferredSearch = useDeferredValue(search);
  const requestUrl = useMemo(
    () =>
      buildSubscriptionsQuery({
        search: deferredSearch,
        renewalFilter,
        statusFilter,
        orderStatusFilter,
        salesChannelId,
        page: currentPage,
        pageSize,
      }),
    [currentPage, deferredSearch, orderStatusFilter, pageSize, renewalFilter, salesChannelId, statusFilter],
  );

  useEffect(() => {
    const nextState = readSubscriptionsListState(searchParams);
    setSearch(nextState.search);
    setRenewalFilter(nextState.renewalFilter);
    setStatusFilter(nextState.statusFilter);
    setOrderStatusFilter(nextState.orderStatusFilter);
    setSalesChannelId(nextState.salesChannelId);
    setCurrentPage(nextState.currentPage);
    setPageSize(nextState.pageSize);
  }, [searchParams]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    const params = new URLSearchParams(currentQuery);
    writeSubscriptionsListState(params, {
      search,
      renewalFilter,
      statusFilter,
      orderStatusFilter,
      salesChannelId,
      currentPage,
      pageSize,
    });

    if (params.toString() !== currentQuery) {
      router.replace(buildSubscriptionsHref(params), { scroll: false });
    }
  }, [currentPage, orderStatusFilter, pageSize, renewalFilter, router, salesChannelId, search, searchParams, statusFilter]);

  const fetchSubscriptions = useCallback(async (url = requestUrl) => {
    setIsLoading(true);
    try {
      const response = await fetch(url);
      const payload = await readApiEnvelope<SubscriptionRow[]>(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể tải danh sách thuê bao premium");
        return;
      }

      setSubs(payload.data ?? []);
      const nextMeta = (payload.meta as SubscriptionListMeta | undefined) ?? EMPTY_META;
      setMeta(nextMeta);
      if (nextMeta.pagination?.page && nextMeta.pagination.page !== currentPage) {
        setCurrentPage(nextMeta.pagination.page);
      }
    } catch (error) {
      console.error("[PremiumSubscriptionsPage] fetchSubscriptions", error);
      appToast.error("Không thể tải danh sách thuê bao premium");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, requestUrl]);

  useEffect(() => {
    void fetchSubscriptions(requestUrl);
  }, [fetchSubscriptions, requestUrl]);

  async function handleRefund(subscription: SubscriptionRow) {
    if (!canRefundSubscription(subscription)) {
      appToast.error("Chỉ có thể tính hoàn tiền khi renewal đã bị từ chối.");
      return;
    }

    const previousRow = { ...subscription };

    try {
      const response = await fetch(`/api/premium/subscriptions/${subscription.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "prorated" }),
      });
      const payload = await readApiEnvelope<RefundMutationPayload>(response);

      if (!response.ok) {
        setSubs((current) =>
          current.map((item) => (item.id === subscription.id ? previousRow : item)),
        );
        appToast.error(payload.error ?? "Không thể tính hoàn tiền");
        return;
      }

      if (payload.data?.subscription) {
        setSubs((current) =>
          current.map((item) =>
            item.id === subscription.id
              ? {
                  ...item,
                  ...payload.data?.subscription,
                }
              : item,
          ),
        );
      }

      appToast.success("Đã tính hoàn tiền");
      void fetchSubscriptions();
    } catch (error) {
      console.error("[PremiumSubscriptionsPage] handleRefund", error);
      setSubs((current) =>
        current.map((item) => (item.id === subscription.id ? previousRow : item)),
      );
      appToast.error("Không thể tính hoàn tiền");
    }
  }

  function handleMarkNoRenew(subscription: SubscriptionRow) {
    if (!canMarkNoRenew(subscription)) {
      appToast.error("Thuê bao này đã ở trạng thái không gia hạn hoặc không còn active.");
      return;
    }
    setNoRenewSub(subscription);
    setNoRenewReason(subscription.renewal_denied_reason ?? "");
  }

  async function submitNoRenew() {
    if (!noRenewSub) return;
    try {
      const response = await fetch(`/api/premium/subscriptions/${noRenewSub.id}/no-renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: noRenewReason.trim() || undefined }),
      });
      const payload = await readApiEnvelope(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể chuyển sang không gia hạn");
        return;
      }

      appToast.success("Đã chuyển thuê bao sang không gia hạn");
      setNoRenewSub(null);
      await fetchSubscriptions();
    } catch (error) {
      console.error("[PremiumSubscriptionsPage] handleMarkNoRenew", error);
      appToast.error("Không thể chuyển sang không gia hạn");
    }
  }

  async function copyToClipboard(value: string | null | undefined, successMessage: string) {
    if (!value) {
      appToast.error("Không có nội dung để sao chép");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[PremiumSubscriptionsPage] copyToClipboard", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  const overallSummary = meta.overallSummary ?? EMPTY_SUMMARY;
  const filteredSummary = meta.summary ?? EMPTY_SUMMARY;
  const filterCatalog = meta.filters ?? EMPTY_FILTERS;
  const orderStatusOptions = filterCatalog.orderStatuses ?? [];
  const subscriptionStatusOptions = filterCatalog.subscriptionStatuses ?? [];
  const topSalesChannels = filterCatalog.salesChannels.filter((item) => item.value !== "none").slice(0, 4);
  const activeSubs = overallSummary.activeCount ?? 0;
  const expiringSubs = overallSummary.expiringCount ?? 0;
  const pendingRenewals = overallSummary.pendingCount ?? 0;
  const notRenewingSubs = overallSummary.notRenewingCount ?? 0;

  function applyPresetFilter(next: {
    renewalFilter?: string;
    statusFilter?: SubscriptionStatusFilter;
    orderStatusFilter?: OrderStatusFilter;
  }) {
    setCurrentPage(1);
    setOrderStatusFilter("all");
    setSalesChannelId("all");
    if (next.renewalFilter !== undefined) {
      setRenewalFilter(next.renewalFilter);
    }
    if (next.statusFilter !== undefined) {
      setStatusFilter(next.statusFilter);
    }
    if (next.orderStatusFilter !== undefined) {
      setOrderStatusFilter(next.orderStatusFilter);
    }
  }

  function applySalesChannelFilter(value: string) {
    setCurrentPage(1);
    setSalesChannelId(value);
  }

  return (
    <AppLayout>
      <ContextMenuRender />
      <RenewalRequestModal
        subscription={renewingSubscription}
        onClose={() => setRenewingSubscription(null)}
        onSubmitted={async () => {
          if (renewingSubscription) {
            setSubs((current) =>
              current.map((item) =>
                item.id === renewingSubscription.id
                  ? {
                      ...item,
                      renewal_status: "pending",
                    }
                  : item,
              ),
            );
          }
          await fetchSubscriptions();
        }}
      />

      <QuickMigrationModal
        subscription={migratingSubscription}
        onClose={() => setMigratingSubscription(null)}
        onSubmitted={async () => {
          await fetchSubscriptions();
        }}
      />

      <Modal
        isOpen={!!noRenewSub}
        onClose={() => setNoRenewSub(null)}
        title="Đánh dấu không gia hạn"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setNoRenewSub(null)}>
              Huỷ
            </Button>
            <Button
              variant="primary"
              onClick={submitNoRenew}
              disabled={!noRenewReason.trim()}
              className="!bg-[var(--danger)] hover:!bg-[var(--danger)]/90 !shadow-none"
            >
              Xác nhận
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--fg-muted)]">
            Nhập lý do đánh dấu không gia hạn cho thuê bao của khách hàng <span className="font-bold text-[var(--fg-base)]">{noRenewSub?.customer_name}</span>:
          </p>
          <Input
            value={noRenewReason}
            onChange={(e) => setNoRenewReason(e.target.value)}
            placeholder="Nhập lý do không gia hạn..."
            autoFocus
          />
        </div>
      </Modal>

      <PageContainer className="relative">
          <PageHeader
            eyebrow={<span>Premium / Subscriptions</span>}
            title="Thuê bao premium"
            description="Danh sách thuê bao premium đang hoạt động, gia hạn tài chính và hoàn tiền nhanh chóng."
            actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/premium/renewals")}
                className="rounded-[1rem] px-5 py-2.5 text-sm font-bold active:scale-[0.98] transition-all"
              >
                <ArrowRightLeft className="size-5" />
                Mở renewals
              </Button>
              <Button
                type="button"
                onClick={() => router.push("/premium/accounts")}
                className="rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)] active:scale-[0.98]"
              >
                <Plus className="size-5" />
                Mở kho tài khoản
              </Button>
            </div>
          }
        />

        <StatsGrid className="mt-6">
          <MetricCard
            label="Đang hoạt động"
            value={activeSubs}
            icon={<RefreshCw className="size-5" />}
            tone="positive"
          />
          <MetricCard
            label="Sắp hết hạn"
            value={expiringSubs}
            icon={<AlertTriangle className="size-5" />}
            tone="warning"
          />
          <MetricCard
            label="Đang chờ gia hạn"
            value={pendingRenewals}
            icon={<HandCoins className="size-5" />}
            tone="accent"
          />
          <MetricCard
            label="Không gia hạn"
            value={notRenewingSubs}
            icon={<XCircle className="size-5" />}
            tone="danger"
          />
        </StatsGrid>

        <div className="mt-4 flex flex-wrap gap-2">
          <PresetChip
            label="Tất cả"
            count={overallSummary.total}
            active={renewalFilter === "all" && statusFilter === "all"}
            tone="neutral"
            onClick={() => applyPresetFilter({ renewalFilter: "all", statusFilter: "all" })}
          />
          <PresetChip
            label="Chờ duyệt"
            count={pendingRenewals}
            active={renewalFilter === "pending"}
            tone="warning"
            onClick={() => applyPresetFilter({ renewalFilter: "pending", statusFilter: "all" })}
          />
          <PresetChip
            label="Khách active"
            count={activeSubs}
            active={statusFilter === "active"}
            tone="positive"
            onClick={() => applyPresetFilter({ renewalFilter: "all", statusFilter: "active" })}
          />
          <PresetChip
            label="Không gia hạn"
            count={notRenewingSubs}
            active={renewalFilter === "not_renewing"}
            tone="danger"
            onClick={() => applyPresetFilter({ renewalFilter: "not_renewing", statusFilter: "all" })}
          />
          <PresetChip
            label="Hoàn tiền"
            count={filteredSummary.blockedCount}
            active={statusFilter === "refunded"}
            tone="danger"
            onClick={() => applyPresetFilter({ renewalFilter: "all", statusFilter: "refunded" })}
          />
          <PresetChip
            label="Di chuyển"
            count={filteredSummary.blockedCount}
            active={statusFilter === "migrated"}
            tone="neutral"
            onClick={() => applyPresetFilter({ renewalFilter: "all", statusFilter: "migrated" })}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PresetChip
            label="Đơn chờ thanh toán"
            count={orderStatusOptions.find((item) => item.value === "pending_payment")?.count ?? 0}
            active={orderStatusFilter === "pending_payment"}
            tone="warning"
            onClick={() => applyPresetFilter({ orderStatusFilter: "pending_payment" })}
          />
          <PresetChip
            label="Đơn đã thanh toán"
            count={orderStatusOptions.find((item) => item.value === "paid")?.count ?? 0}
            active={orderStatusFilter === "paid"}
            tone="positive"
            onClick={() => applyPresetFilter({ orderStatusFilter: "paid" })}
          />
          <PresetChip
            label="Đang cấp phát"
            count={orderStatusOptions.find((item) => item.value === "provisioning")?.count ?? 0}
            active={orderStatusFilter === "provisioning"}
            tone="warning"
            onClick={() => applyPresetFilter({ orderStatusFilter: "provisioning" })}
          />
          <PresetChip
            label="Đang hoạt động"
            count={orderStatusOptions.find((item) => item.value === "active")?.count ?? 0}
            active={orderStatusFilter === "active"}
            tone="positive"
            onClick={() => applyPresetFilter({ orderStatusFilter: "active" })}
          />
          <PresetChip
            label="Không có đơn"
            count={orderStatusOptions.find((item) => item.value === "none")?.count ?? 0}
            active={orderStatusFilter === "none"}
            tone="neutral"
            onClick={() => applyPresetFilter({ orderStatusFilter: "none" })}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PresetChip
            label="Tất cả CTV"
            count={filterCatalog.salesChannels.reduce((total, item) => total + item.count, 0)}
            active={salesChannelId === "all"}
            tone="neutral"
            onClick={() => applySalesChannelFilter("all")}
          />
          <PresetChip
            label="Không có CTV"
            count={filterCatalog.salesChannels.find((item) => item.value === "none")?.count ?? 0}
            active={salesChannelId === "none"}
            tone="neutral"
            onClick={() => applySalesChannelFilter("none")}
          />
          {topSalesChannels.map((channel) => (
            <PresetChip
              key={channel.value}
              label={channel.label}
              count={channel.count}
              active={salesChannelId === channel.value}
              tone="positive"
              onClick={() => applySalesChannelFilter(channel.value)}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PresetChip
            label="Đang active"
            count={subscriptionStatusOptions.find((item) => item.value === "active")?.count ?? 0}
            active={statusFilter === "active"}
            tone="positive"
            onClick={() => applyPresetFilter({ statusFilter: "active", renewalFilter: "all" })}
          />
          <PresetChip
            label="Chờ gia hạn"
            count={subscriptionStatusOptions.find((item) => item.value === "waiting_renewal")?.count ?? 0}
            active={statusFilter === "waiting_renewal"}
            tone="warning"
            onClick={() => applyPresetFilter({ statusFilter: "waiting_renewal", renewalFilter: "all" })}
          />
          <PresetChip
            label="Đã gia hạn"
            count={subscriptionStatusOptions.find((item) => item.value === "renewed")?.count ?? 0}
            active={statusFilter === "renewed"}
            tone="positive"
            onClick={() => applyPresetFilter({ statusFilter: "renewed", renewalFilter: "confirmed" })}
          />
          <PresetChip
            label="Đã migration"
            count={subscriptionStatusOptions.find((item) => item.value === "migrated")?.count ?? 0}
            active={statusFilter === "migrated"}
            tone="neutral"
            onClick={() => applyPresetFilter({ statusFilter: "migrated", renewalFilter: "all" })}
          />
          <PresetChip
            label="Đã hoàn tiền"
            count={subscriptionStatusOptions.find((item) => item.value === "refunded")?.count ?? 0}
            active={statusFilter === "refunded"}
            tone="danger"
            onClick={() => applyPresetFilter({ statusFilter: "refunded", renewalFilter: "all" })}
          />
          <PresetChip
            label="Tạm ngưng"
            count={subscriptionStatusOptions.find((item) => item.value === "suspended")?.count ?? 0}
            active={statusFilter === "suspended"}
            tone="warning"
            onClick={() => applyPresetFilter({ statusFilter: "suspended", renewalFilter: "all" })}
          />
        </div>

        <FiltersBar className="mt-6 flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px_auto]">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                aria-label="Tìm thuê bao premium"
                name="premium-subscription-search"
                value={search}
                onChange={(event) => {
                  setCurrentPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Tìm khách, email, dịch vụ, ID thuê bao..."
                className="pl-10"
              />
            </div>
            <Select
              aria-label="Lọc trạng thái renewal"
              name="premium-subscription-renewal-state"
              value={renewalFilter}
              onChange={(event) => {
                setCurrentPage(1);
                setRenewalFilter(event.target.value);
              }}
            >
              <option value="all">Tất cả renewal</option>
              <option value="none">Chưa tạo yêu cầu</option>
              <option value="pending">Chờ xử lý</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="denied">Đã từ chối</option>
              <option value="not_renewing">Không gia hạn</option>
            </Select>
            <Select
              aria-label="Lọc trạng thái đơn liên quan"
              name="premium-subscription-order-status"
              value={orderStatusFilter}
              onChange={(event) => {
                setCurrentPage(1);
                setOrderStatusFilter(event.target.value as OrderStatusFilter);
              }}
            >
              <option value="all">Tất cả trạng thái đơn</option>
              <option value="none">Không có đơn</option>
              <option value="pending_payment">Chờ thanh toán</option>
              <option value="paid">Đã thanh toán</option>
              <option value="provisioning">Đang cấp phát</option>
              <option value="active">Đang hoạt động</option>
              <option value="expired">Hết hạn</option>
              <option value="refunded">Hoàn tiền</option>
              <option value="cancelled">Đã huỷ</option>
            </Select>
            <Select
              aria-label="Lọc trạng thái thuê bao"
              name="premium-subscription-status"
              value={statusFilter}
              onChange={(event) => {
                setCurrentPage(1);
                setStatusFilter(event.target.value as SubscriptionStatusFilter);
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang active</option>
              <option value="expired">Hết hạn</option>
              <option value="suspended">Tạm ngưng</option>
              <option value="waiting_renewal">Chờ gia hạn</option>
              <option value="renewed">Đã gia hạn</option>
              <option value="migrated">Đã migration</option>
              <option value="refunded">Đã hoàn tiền</option>
              <option value="non_active">Không active</option>
            </Select>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch("");
                setRenewalFilter("all");
                setOrderStatusFilter("all");
                setStatusFilter("all");
                setSalesChannelId("all");
                setCurrentPage(1);
                setPageSize(12);
              }}
              className="rounded-full"
            >
              Reset
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Select
              aria-label="Lọc CTV hoặc kênh bán"
              name="premium-subscription-sales-channel"
              value={salesChannelId}
              onChange={(event) => {
                setCurrentPage(1);
                setSalesChannelId(event.target.value);
              }}
            >
              <option value="all">Tất cả CTV/kênh bán</option>
              <option value="none">Không có CTV/kênh bán</option>
              {filterCatalog.salesChannels.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </Select>
          </div>
        </FiltersBar>

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Danh sách thuê bao"
            description="Gia hạn giờ đi qua modal chuẩn với chu kỳ mới, giá bán, giá vốn và số tiền đã thu để đội vận hành nhìn ngay doanh thu và lãi."
          />

          {isLoading ? (
            <div className="p-6">
              <div className="flex justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-white/70 p-12">
                <div className="size-8 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
              </div>
            </div>
          ) : subs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<User className="size-6" />}
                title="Không có thuê bao phù hợp"
                description="Đổi bộ lọc hoặc reset để xem lại toàn bộ thuê bao."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setRenewalFilter("all");
                      setOrderStatusFilter("all");
                      setStatusFilter("all");
                      setSalesChannelId("all");
                      setCurrentPage(1);
                      setPageSize(12);
                    }}
                    className="rounded-full"
                  >
                    Reset bộ lọc
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-4 sm:p-6">
              {subs.map((sub) => {
                const isExpired = sub.days_remaining <= 0;
                const isExpiring = sub.days_remaining > 0 && sub.days_remaining <= 7;
                const canRenew = canRenewSubscription(sub);
                const canRefund = canRefundSubscription(sub);
                const canNoRenew = canMarkNoRenew(sub);
                const renewalBlockReason = getRenewalBlockReason(sub);
                const noRenewBlockReason = getNoRenewBlockReason(sub);
                const currentPrice = Number(sub.final_price ?? sub.original_price ?? 0);
                const primaryAction = canRenew
                    ? {
                        label: "Gia hạn",
                        icon: <Sparkles className="size-3.5" />,
                        onClick: () => setRenewingSubscription(sub),
                        className: "bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20",
                      }
                    : canRefund
                      ? {
                          label: "Hoàn tiền",
                          icon: <HandCoins className="size-3.5" />,
                          onClick: () => void handleRefund(sub),
                          className: "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20",
                        }
                      : canNoRenew
                      ? {
                          label: "Không gia hạn",
                          icon: <XCircle className="size-3.5" />,
                          onClick: () => void handleMarkNoRenew(sub),
                          className: "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20",
                        }
                      : null;

                const quickActions = [
                  {
                    label: "Xem khách hàng",
                    icon: <User className="size-4" />,
                    onClick: () => router.push(`/customers/${sub.customer_id}`),
                  },
                  ...(sub.order_id
                    ? [
                        {
                          label: "Xem đơn hàng",
                          icon: <Link2 className="size-4" />,
                          onClick: () => router.push(`/orders/${sub.order_id}`),
                        },
                      ]
                    : []),
                  {
                    label: "Xem account premium",
                    icon: <MonitorPlay className="size-4" />,
                    onClick: () => router.push(`/premium/accounts/${sub.premium_account_id}`),
                  },
                  ...(sub.migration_id
                    ? [
                        {
                          label: "Mở migration liên quan",
                          icon: <ArrowRightLeft className="size-4" />,
                          onClick: () => router.push("/premium/migrations"),
                        },
                      ]
                    : []),
                  ...(sub.premium_account_id
                    ? [
                        {
                          label: "Chuyển Family nhanh",
                          icon: <ArrowRightLeft className="size-4" />,
                          onClick: () => setMigratingSubscription(sub),
                        },
                      ]
                    : []),
                  {
                    label: "Sao chép ID thuê bao",
                    icon: <Copy className="size-4" />,
                    onClick: () => void copyToClipboard(sub.id, "Đã sao chép ID thuê bao"),
                  },
                  {
                    label: "Sao chép email account",
                    icon: <Copy className="size-4" />,
                    onClick: () => void copyToClipboard(sub.account_email, "Đã sao chép email account"),
                  },
                  ...(sub.order_code
                    ? [
                        {
                          label: "Sao chép mã đơn",
                          icon: <Copy className="size-4" />,
                          onClick: () => void copyToClipboard(sub.order_code, "Đã sao chép mã đơn"),
                        },
                      ]
                    : []),
                ];

                return (
                  <article
                    key={sub.id}
                    className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.02)] transition-all duration-300 hover:shadow-[0_18px_42px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 active:scale-[0.99] flex flex-col justify-between"
                    onContextMenu={(event) => {
                      openContextMenu(event, [
                        ...quickActions,
                        ...(canRenew
                          ? [
                              {
                                label: "Tạo yêu cầu gia hạn",
                                icon: <RefreshCw className="size-4" />,
                                onClick: () => setRenewingSubscription(sub),
                              },
                            ]
                          : []),
                        ...(canRefund
                          ? [
                              {
                                label: "Tính hoàn tiền",
                                icon: <HandCoins className="size-4" />,
                                onClick: () => void handleRefund(sub),
                              },
                            ]
                          : []),
                        ...(canNoRenew
                          ? [
                              {
                                label: "Đánh dấu không gia hạn",
                                icon: <XCircle className="size-4" />,
                                onClick: () => void handleMarkNoRenew(sub),
                              },
                            ]
                          : []),
                        ...(sub.premium_account_id
                          ? [
                              {
                                label: "Chuyển Family nhanh",
                                icon: <ArrowRightLeft className="size-4" />,
                                onClick: () => setMigratingSubscription(sub),
                              },
                            ]
                          : []),
                      ]);
                    }}
                  >
                    <div className="space-y-4">
                      {/* Header Section: Customer Info & Service Type */}
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 text-[var(--accent)] transition-transform group-hover:rotate-6">
                          <User className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/customers/${sub.customer_id}`}
                            className="block truncate text-[14px] font-black text-[var(--fg-base)] transition-colors hover:text-[var(--accent)]"
                          >
                            {sub.customer_name}
                          </Link>
                          <p className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--fg-muted)]">
                            {sub.service_name}
                          </p>
                        </div>
                      </div>

                      {/* Mono email container */}
                      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/40 p-2.5 flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px] font-extrabold text-[var(--fg-base)]">
                          {sub.account_email}
                        </span>
                        <span className="text-[9px] font-bold text-[var(--fg-muted)] tracking-wider shrink-0 uppercase">
                          {sub.order_status ?? "Chưa rõ"}
                        </span>
                      </div>

                      {/* Info Pills Grid 2x2 */}
                      <div className="grid grid-cols-2 gap-2">
                        <InfoPill
                          label="Chu kỳ"
                          value={getBillingCycleLabel(sub.billing_cycle)}
                        />
                        <InfoPill
                          label="Giá"
                          value={formatMoney(currentPrice)}
                          isMono
                        />
                        <InfoPill
                          label="Hạn dùng"
                          value={format(new Date(sub.expiry_date), "dd/MM/yyyy")}
                          tone={isExpired ? "danger" : isExpiring ? "warning" : "positive"}
                          isMono
                        />
                        <InfoPill
                          label="Renewal"
                          value={getRenewalStatusLabel(sub.renewal_status)}
                          tone={
                            sub.renewal_status === "confirmed" || sub.renewal_status === "migrated"
                              ? "positive"
                              : sub.renewal_status === "pending"
                                ? "warning"
                                : sub.renewal_status === "denied" || sub.renewal_status === "not_renewing" || sub.renewal_status === "refunded"
                                  ? "danger"
                                  : "neutral"
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-[var(--border-soft)] space-y-3">
                      {/* Follow-up slot or reasons */}
                      <div className="rounded-xl border border-[var(--border-soft)] bg-white/50 px-3.5 py-1.5 flex items-center justify-between text-[11px] font-semibold text-[var(--fg-muted)]">
                        <div className="flex items-center gap-1.5">
                          <CalendarClock
                            className={`size-3.5 ${isExpired ? "text-rose-500" : isExpiring ? "text-amber-500" : "text-emerald-500"}`}
                          />
                          <span className="font-extrabold text-[var(--fg-base)]">
                            {isExpired ? "Đã hết hạn" : <>Còn <span className="font-mono text-[var(--accent)] font-black">{Math.max(0, sub.days_remaining)}</span> ngày</>}
                          </span>
                        </div>
                        {sub.order_code ? (
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Mã: {sub.order_code}</span>
                        ) : null}
                      </div>

                      {!canRenew && renewalBlockReason ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-[10px] leading-relaxed text-amber-800 font-medium">
                          <span className="font-bold">Không gia hạn:</span> {renewalBlockReason}
                        </div>
                      ) : null}

                      {!canNoRenew && noRenewBlockReason ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-1.5 text-[10px] leading-relaxed text-rose-800 font-medium">
                          <span className="font-bold">Không gia hạn:</span> {noRenewBlockReason}
                        </div>
                      ) : null}

                      {/* Action buttons row */}
                      <div className="flex items-center gap-2 justify-between">
                        {primaryAction ? (
                          <Button
                            type="button"
                            onClick={primaryAction.onClick}
                            className={cn(
                              "flex-1 h-9 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]",
                              primaryAction.className
                            )}
                          >
                            {primaryAction.icon}
                            <span>{primaryAction.label}</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.push(`/customers/${sub.customer_id}`)}
                            className="flex-1 h-9 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                          >
                            <User className="size-3.5" />
                            <span>Chi tiết khách</span>
                          </Button>
                        )}

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void copyToClipboard(buildReminderMessage(sub), "Đã sao chép mẫu nhắc gia hạn")}
                            className="size-9 rounded-xl flex items-center justify-center p-0 transition-transform active:scale-90"
                            title="Sao chép mẫu nhắc gia hạn"
                          >
                            <Copy className="size-3.5" />
                          </Button>

                          <ActionMenu items={quickActions} />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!isLoading && meta.pagination.totalItems > 0 ? (
            <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--fg-muted)]">
                <span>
                  Trang {meta.pagination.page} / {meta.pagination.totalPages}
                </span>
                <span>
                  Đang hiển thị {meta.pagination.start}-{meta.pagination.end} / {filteredSummary.total}
                </span>
                <span>
                  Tổng sau lọc {filteredSummary.total} / {overallSummary.total}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Số thuê bao mỗi trang"
                  name="premium-subscription-page-size"
                  value={String(pageSize)}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setPageSize(Number(event.target.value) || 12);
                  }}
                  className="min-w-[120px]"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} mục
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={meta.pagination.page <= 1}
                  onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                  className="rounded-full"
                >
                  Trang trước
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={meta.pagination.page >= meta.pagination.totalPages}
                  onClick={() =>
                    setCurrentPage((current) => Math.min(meta.pagination.totalPages, current + 1))
                  }
                  className="rounded-full"
                >
                  Trang sau
                </Button>
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "positive" | "warning" | "accent" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-500/10 text-emerald-600"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-600"
        : tone === "danger"
          ? "bg-rose-500/10 text-rose-600"
          : "bg-[var(--accent)]/10 text-[var(--accent)]";

  return (
    <div className="app-card flex h-full items-center justify-between gap-4 p-6 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
        <p className="mt-2 text-3xl font-black text-[var(--fg-base)] font-mono tracking-tight">{value}</p>
      </div>
      <div className={`flex size-11 items-center justify-center rounded-xl ${toneClass}`}>{icon}</div>
    </div>
  );
}

function PresetChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: "positive" | "warning" | "danger" | "neutral";
  onClick: () => void;
}) {
  const toneClass =
    tone === "positive"
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

function InfoPill({
  label,
  value,
  tone = "neutral",
  isMono = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
  isMono?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-rose-600"
          : "text-[var(--fg-base)]";

  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/40 p-2.5">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
      <p className={`mt-1 text-[12px] font-extrabold ${toneClass} ${isMono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
