"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  Copy,
  HandCoins,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { AppLayout } from "@/widgets/layout/app-layout";
import { ActionMenu } from "@/shared/ui/action-menu";
import { Input } from "@/shared/ui/input";
import { PageContainer, PageHeader, SurfaceCard, StatsGrid, SectionHeader, EmptyState } from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
import { useContextMenu } from "@/shared/ui/context-menu";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { formatMoney } from "@/lib/utils";
import {
  calculateRenewalFinanceSnapshot,
  getBillingCycleLabel,
} from "@/lib/domain/premium-renewal-finance";
import type { AutoRenewalEngineOutcome } from "@/lib/services/auto-renewal-engine";
import type {
  AutoRenewalEngineRunHistoryResult,
} from "@/lib/services/auto-renewal-engine-audit";
import type { SubscriptionRenewal } from "@/lib/domain/premium-types";
import {
  AdminHistoryFilters,
  type AdminHistoryFilterValue,
} from "@/widgets/pages/premium/shared/admin-history-filters";
import { RenewalConfirmModal } from "./components/renewal-confirm-modal";

type RenewalRow = SubscriptionRenewal & {
  customer_name: string;
  account_email: string;
  service_name: string;
  current_billing_cycle?: string | null;
  current_cycle_months?: number | null;
  current_expiry_date?: string | null;
  current_subscription_price?: number | null;
  package_default_price?: number | null;
  renewal_price_factor?: number | null;
};

type AutoRenewalRunReport = AutoRenewalEngineOutcome;
type RenewalStatusFilter = "pending" | "completed" | "denied";

type EngineFormState = {
  daysThreshold: number;
  maxCreated: number;
  minReliabilityScore: number;
};

type RenewalWatchlistItem = {
  subscriptionId: string;
  customerId: string;
  customerName: string;
  serviceName: string;
  nick: string;
  accountEmail: string;
  expiryDate: string;
  expiryDateLabel: string;
  daysUntilExpiry: number;
  urgency: "expired" | "expiring";
  contactChannel: string;
  contactValue: string;
  notificationMessage: string;
};

type RenewalWatchlistData = {
  thresholdDays: number;
  summary: {
    expiredCount: number;
    expiringSoonCount: number;
    totalActionable: number;
  };
  expired: RenewalWatchlistItem[];
  expiringSoon: RenewalWatchlistItem[];
};

const RENEWAL_STATUSES: RenewalStatusFilter[] = ["pending", "completed", "denied"];
const DEFAULT_ENGINE_FORM: EngineFormState = {
  daysThreshold: 7,
  maxCreated: 20,
  minReliabilityScore: 70,
};
const DEFAULT_HISTORY_FILTERS: AdminHistoryFilterValue = {
  mode: "all",
  createdBy: "",
  fromDate: "",
  toDate: "",
};
const EMPTY_RENEWAL_BUCKETS: Record<RenewalStatusFilter, RenewalRow[]> = {
  pending: [],
  completed: [],
  denied: [],
};
const EMPTY_RENEWAL_WATCHLIST: RenewalWatchlistData = {
  thresholdDays: 7,
  summary: {
    expiredCount: 0,
    expiringSoonCount: 0,
    totalActionable: 0,
  },
  expired: [],
  expiringSoon: [],
};

const AUTO_RENEWAL_SKIP_REASON_LABELS: Record<string, string> = {
  customer_missing: "Thiếu khách hàng",
  customer_has_debt: "Khách còn nợ",
  customer_overdue: "Khách quá hạn",
  low_reliability: "Reliability thấp",
  renewal_not_allowed: "Không đủ điều kiện",
  renewal_pending: "Đã có request chờ",
  renewal_creation_failed: "Tạo request lỗi",
};

type DynamicDataTableComponent = <TData, TValue>(props: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowContextMenu?: (event: React.MouseEvent, row: TData) => void;
}) => ReactElement;

const DataTable = dynamic(
  () => import("@/shared/ui/data-table").then((module) => ({ default: module.DataTable })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-[1.2rem] border border-[var(--border-soft)] bg-white/60 p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-4 w-20 rounded bg-[var(--border-soft)]" />
              <div className="h-4 w-40 rounded bg-[var(--border-soft)]" />
              <div className="h-4 w-28 rounded bg-[var(--border-soft)]" />
            </div>
          </div>
        ))}
      </div>
    ),
  },
) as unknown as DynamicDataTableComponent;

function formatSkipReason(reason: string) {
  return AUTO_RENEWAL_SKIP_REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
}

function moveRenewalToStatus(
  source: Record<RenewalStatusFilter, RenewalRow[]>,
  renewalId: string,
  nextStatus: RenewalStatusFilter,
) {
  const nextBuckets: Record<RenewalStatusFilter, RenewalRow[]> = {
    pending: [],
    completed: [],
    denied: [],
  };
  let movedRenewal: RenewalRow | null = null;

  for (const status of RENEWAL_STATUSES) {
    for (const item of source[status]) {
      if (item.id === renewalId) {
        movedRenewal = { ...item, status: nextStatus };
        continue;
      }

      nextBuckets[status].push(item);
    }
  }

  if (!movedRenewal) {
    return source;
  }

  nextBuckets[nextStatus] = [movedRenewal, ...nextBuckets[nextStatus]];
  return nextBuckets;
}

function buildHistorySearch(value: AdminHistoryFilterValue, page: number, limit: number) {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (value.mode && value.mode !== "all") {
    searchParams.set("mode", value.mode);
  }
  if (value.createdBy.trim()) {
    searchParams.set("created_by", value.createdBy.trim());
  }
  if (value.fromDate) {
    searchParams.set("from_date", value.fromDate);
  }
  if (value.toDate) {
    searchParams.set("to_date", value.toDate);
  }

  return searchParams.toString();
}

function getRenewalFinance(renewal: RenewalRow) {
  return calculateRenewalFinanceSnapshot({
    renewalPrice: Number(renewal.renewal_price ?? renewal.total_price ?? renewal.original_price ?? 0),
    collectedAmount: Number(renewal.collected_amount ?? renewal.renewal_price ?? renewal.total_price ?? 0),
    costPrice: Number(renewal.cost_price ?? 0),
  });
}

function getExpiryStatusLabel(daysUntilExpiry: number) {
  if (daysUntilExpiry < 0) {
    return `Quá hạn ${Math.abs(daysUntilExpiry)} ngày`;
  }
  if (daysUntilExpiry === 0) {
    return "Hết hạn hôm nay";
  }
  return `Còn ${daysUntilExpiry} ngày`;
}

function FilterCard({
  label,
  count,
  color,
  icon,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  icon: ReactElement;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="app-card flex items-start justify-between gap-4 p-6 text-left transition-all hover:-translate-y-0.5"
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
        <p className="mt-2 text-3xl font-black text-[var(--fg-base)]" style={{ color }}>
          {count}
        </p>
      </div>
      <div
        className="flex size-12 items-center justify-center rounded-[1rem] bg-[var(--surface-light)] shadow-sm"
        style={{ color }}
      >
        {icon}
      </div>
    </button>
  );
}

export default function PremiumRenewalsPage() {
  const router = useRouter();
  const { openContextMenu, ContextMenuRender } = useContextMenu();
  const [selectedStatus, setSelectedStatus] = useState<RenewalStatusFilter>("pending");
  const [renewalsByStatus, setRenewalsByStatus] =
    useState<Record<RenewalStatusFilter, RenewalRow[]>>(EMPTY_RENEWAL_BUCKETS);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningRenewalId, setActioningRenewalId] = useState<string | null>(null);
  const [confirmingRenewal, setConfirmingRenewal] = useState<RenewalRow | null>(null);
  const [engineForm, setEngineForm] = useState<EngineFormState>(DEFAULT_ENGINE_FORM);
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [lastRunReport, setLastRunReport] = useState<AutoRenewalRunReport | null>(null);
  const [engineRunHistory, setEngineRunHistory] = useState<AutoRenewalEngineRunHistoryResult | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyDraft, setHistoryDraft] = useState<AdminHistoryFilterValue>(DEFAULT_HISTORY_FILTERS);
  const [historyFilters, setHistoryFilters] = useState<AdminHistoryFilterValue>(DEFAULT_HISTORY_FILTERS);
  const [watchlistThresholdDays, setWatchlistThresholdDays] = useState(7);
  const [renewalWatchlist, setRenewalWatchlist] = useState<RenewalWatchlistData>(EMPTY_RENEWAL_WATCHLIST);
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(true);

  const fetchRenewalsByStatus = useCallback(async (statusFilter: RenewalStatusFilter): Promise<RenewalRow[]> => {
    try {
      const response = await fetch(`/api/premium/renewals?status=${statusFilter}`);
      const payload = await readApiEnvelope<RenewalRow[]>(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể tải danh sách renewal");
        return [];
      }

      return payload.data ?? [];
    } catch (error) {
      console.error("[PremiumRenewalsPage] fetchRenewalsByStatus", error);
      appToast.error("Không thể tải danh sách renewal");
      return [];
    }
  }, []);

  const fetchEngineRunHistory = useCallback(
    async (filterValue: AdminHistoryFilterValue, page = 1): Promise<AutoRenewalEngineRunHistoryResult | null> => {
      try {
        const response = await fetch(
          `/api/premium/renewals/auto-run/history?${buildHistorySearch(filterValue, page, 5)}`,
        );
        const payload = await readApiEnvelope<AutoRenewalEngineRunHistoryResult>(response);

        if (!response.ok) {
          appToast.error(payload.error ?? "Không thể tải lịch sử engine");
          return null;
        }

        return payload.data ?? null;
      } catch (error) {
        console.error("[PremiumRenewalsPage] fetchEngineRunHistory", error);
        appToast.error("Không thể tải lịch sử engine");
        return null;
      }
    },
    [],
  );

  const fetchRenewalWatchlist = useCallback(async (daysThreshold: number): Promise<RenewalWatchlistData | null> => {
    try {
      const response = await fetch(
        `/api/premium/renewals/watchlist?days_threshold=${daysThreshold}&limit=50`,
      );
      const payload = await readApiEnvelope<RenewalWatchlistData>(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể tải danh sách nick gia hạn");
        return null;
      }

      return payload.data ?? EMPTY_RENEWAL_WATCHLIST;
    } catch (error) {
      console.error("[PremiumRenewalsPage] fetchRenewalWatchlist", error);
      appToast.error("Không thể tải danh sách nick gia hạn");
      return null;
    }
  }, []);

  const refreshRenewalBuckets = useCallback(
    async (nextStatus?: RenewalStatusFilter) => {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          RENEWAL_STATUSES.map(async (status) => [status, await fetchRenewalsByStatus(status)] as const),
        );

        const nextBuckets = { ...EMPTY_RENEWAL_BUCKETS };
        for (const [status, rows] of results) {
          nextBuckets[status] = rows;
        }

        setRenewalsByStatus(nextBuckets);
        if (nextStatus) {
          setSelectedStatus(nextStatus);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [fetchRenewalsByStatus],
  );

  const refreshEngineRunHistory = useCallback(
    async (filterValue = historyFilters, page = 1) => {
      setIsHistoryLoading(true);
      try {
        const history = await fetchEngineRunHistory(filterValue, page);
        setEngineRunHistory(history);
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [fetchEngineRunHistory, historyFilters],
  );

  const refreshRenewalWatchlist = useCallback(
    async (daysThreshold = watchlistThresholdDays) => {
      setIsWatchlistLoading(true);
      try {
        const watchlist = await fetchRenewalWatchlist(daysThreshold);
        if (watchlist) {
          setRenewalWatchlist(watchlist);
        }
      } finally {
        setIsWatchlistLoading(false);
      }
    },
    [fetchRenewalWatchlist, watchlistThresholdDays],
  );

  useEffect(() => {
    void Promise.all([
      refreshRenewalBuckets(),
      refreshEngineRunHistory(),
      refreshRenewalWatchlist(),
    ]);
  }, [refreshEngineRunHistory, refreshRenewalBuckets, refreshRenewalWatchlist]);

  const handleRunAutoRenewalEngine = useCallback(async () => {
    setIsRunningEngine(true);
    try {
      const response = await fetch("/api/premium/renewals/auto-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(engineForm),
      });
      const payload = await readApiEnvelope<AutoRenewalRunReport>(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể chạy auto-renewal engine");
        return;
      }

      setLastRunReport(payload.data ?? null);
      appToast.success(`Đã chạy engine: ${payload.data?.createdCount ?? 0} request mới`);
      await Promise.all([
        refreshRenewalBuckets("pending"),
        refreshEngineRunHistory(historyFilters, 1),
        refreshRenewalWatchlist(),
      ]);
    } catch (error) {
      console.error("[PremiumRenewalsPage] handleRunAutoRenewalEngine", error);
      appToast.error("Không thể chạy auto-renewal engine");
    } finally {
      setIsRunningEngine(false);
    }
  }, [engineForm, historyFilters, refreshEngineRunHistory, refreshRenewalBuckets, refreshRenewalWatchlist]);

  async function handleRenewalAction(
    renewalId: string,
    endpoint: "confirm" | "deny",
    successMessage: string,
    errorMessage: string,
  ) {
    setActioningRenewalId(renewalId);
    const nextStatus: RenewalStatusFilter = endpoint === "confirm" ? "completed" : "denied";
    const previousBuckets = renewalsByStatus;

    setRenewalsByStatus((current) => moveRenewalToStatus(current, renewalId, nextStatus));

    try {
      const response = await fetch(`/api/premium/renewals/${renewalId}/${endpoint}`, { method: "POST" });
      const payload = await readApiEnvelope(response);

      if (!response.ok) {
        setRenewalsByStatus(previousBuckets);
        appToast.error(payload.error ?? errorMessage);
        return;
      }

      appToast.success(successMessage);
      await Promise.all([refreshRenewalBuckets(selectedStatus), refreshRenewalWatchlist()]);
    } catch (error) {
      console.error(`[PremiumRenewalsPage] handleRenewalAction:${endpoint}`, error);
      setRenewalsByStatus(previousBuckets);
      appToast.error(errorMessage);
    } finally {
      setActioningRenewalId((current) => (current === renewalId ? null : current));
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[PremiumRenewalsPage] copyToClipboard", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  function getRenewalQuickActions(renewal: RenewalRow) {
    const renewalOrderId = renewal.renewal_order_id;

    return [
      {
        label: "Xem khách hàng",
        icon: <User className="size-4" />,
        onClick: () => router.push(`/customers/${renewal.customer_id}`),
      },
      {
        label: "Sao chép ID gia hạn",
        icon: <Copy className="size-4" />,
        onClick: () => void copyToClipboard(renewal.id, "Đã sao chép ID gia hạn"),
      },
      {
        label: "Sao chép subscription gốc",
        icon: <Copy className="size-4" />,
        onClick: () =>
          void copyToClipboard(renewal.original_subscription_id, "Đã sao chép subscription gốc"),
      },
      ...(renewalOrderId
        ? [
            {
              label: "Sao chép ID order",
              icon: <Copy className="size-4" />,
              onClick: () =>
                void copyToClipboard(renewalOrderId, "Đã sao chép ID order gia hạn"),
            },
          ]
        : []),
    ];
  }

  const columns: ColumnDef<RenewalRow>[] = [
    {
      accessorKey: "id",
      header: "Mã GH",
      cell: ({ row }) => (
        <span className="font-mono text-[10px] text-[var(--fg-muted)]">{row.original.id.slice(0, 8)}</span>
      ),
    },
    {
      accessorKey: "customer_name",
      header: "Khách hàng",
      cell: ({ row }) => (
        <span className="font-bold text-[13px] text-[var(--fg-base)]">{row.original.customer_name}</span>
      ),
    },
    {
      accessorKey: "service_name",
      header: "Dịch vụ",
      cell: ({ row }) => (
        <span className="font-bold text-[13px] text-[var(--accent)]">{row.original.service_name}</span>
      ),
    },
    {
      accessorKey: "renewal_requested_date",
      header: "Ngày tạo",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-[12px]">
          <CalendarClock className="size-3.5 text-[var(--fg-muted)]" />
          {format(new Date(row.original.renewal_requested_date), "dd/MM/yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "new_billing_cycle",
      header: "Chu kỳ",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-[var(--fg-base)]">
            {getBillingCycleLabel(row.original.new_billing_cycle ?? row.original.current_billing_cycle)}
          </span>
          <span className="text-[11px] text-[var(--fg-muted)]">
            {row.original.new_cycle_months ?? row.original.current_cycle_months ?? 1} tháng
          </span>
        </div>
      ),
    },
    {
      accessorKey: "renewal_price",
      header: "Doanh thu / lãi",
      cell: ({ row }) => {
        const finance = getRenewalFinance(row.original);

        return (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[14px] font-bold text-[var(--fg-base)]">
              <HandCoins className="size-3.5" />
              {formatMoney(finance.revenueAmount)}
            </span>
            <span className="text-[11px] text-[var(--fg-muted)]">
              Báo giá {formatMoney(finance.renewalPrice)} • Còn lại {formatMoney(finance.outstandingAmount)}
            </span>
            <span
              className={`text-[11px] font-bold ${
                finance.profitAmount >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              Lãi {formatMoney(finance.profitAmount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
            row.original.status === "pending"
              ? "bg-amber-500/10 text-amber-600"
              : row.original.status === "completed"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-[var(--danger)]/10 text-[var(--danger)]"
          }`}
        >
          {row.original.status}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Hành động",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          {row.original.status === "pending" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={actioningRenewalId === row.original.id}
                onClick={() => setConfirmingRenewal(row.original)}
                className="h-8 px-2.5 text-[12px] font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-60"
              >
                <CheckCircle className="mr-1.5 size-4" />
                Xác nhận
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={actioningRenewalId === row.original.id}
                onClick={() =>
                  void handleRenewalAction(
                    row.original.id,
                    "deny",
                    "Khách đã hủy gia hạn",
                    "Không thể hủy gia hạn",
                  )
                }
                className="h-8 px-2.5 text-[12px] font-bold text-[var(--danger)] bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 disabled:opacity-60"
              >
                <XCircle className="mr-1.5 size-4" />
                Báo hủy
              </Button>
            </>
          ) : (
            <span className="text-[11px] text-[var(--fg-muted)]">Đã khóa</span>
          )}
          <ActionMenu items={getRenewalQuickActions(row.original)} />
        </div>
      ),
    },
  ];

  const pendingCount = renewalsByStatus.pending.length;
  const completedCount = renewalsByStatus.completed.length;
  const deniedCount = renewalsByStatus.denied.length;
  const visibleRenewals = renewalsByStatus[selectedStatus];
  const visibleFinanceSummary = visibleRenewals.reduce(
    (summary, item) => {
      const finance = getRenewalFinance(item);
      summary.quoted += finance.renewalPrice;
      summary.revenue += finance.revenueAmount;
      summary.outstanding += finance.outstandingAmount;
      summary.profit += finance.profitAmount;
      return summary;
    },
    { quoted: 0, revenue: 0, outstanding: 0, profit: 0 },
  );
  const recentEngineRuns = engineRunHistory?.items ?? [];
  const engineRunMeta = engineRunHistory?.meta;
  const engineRunSummary = engineRunHistory?.summary ?? {
    manualCount: 0,
    cronCount: 0,
    systemCount: 0,
    userCount: 0,
  };
  const expiredWatchItems = renewalWatchlist.expired;
  const expiringWatchItems = renewalWatchlist.expiringSoon;

  return (
    <AppLayout>
      <ContextMenuRender />
      <RenewalConfirmModal
        renewal={confirmingRenewal}
        onClose={() => setConfirmingRenewal(null)}
        onSubmitted={async () => {
          if (!confirmingRenewal) {
            return;
          }

          await Promise.all([refreshRenewalBuckets(selectedStatus), refreshRenewalWatchlist()]);
          setConfirmingRenewal(null);
        }}
      />

      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Renewals / Auto-Renewal Engine</span>}
          title="Xử lý gia hạn"
          description="Queue gia hạn giờ có đủ chu kỳ, doanh thu, công nợ và lợi nhuận để đội vận hành duyệt chính xác hơn thay vì one-click mù số."
        />

        <SurfaceCard className="mt-6 border-[var(--warning)]/20 bg-white">
          <SectionHeader
            title="Nick hết hạn / sắp hết hạn để nhắc khách"
            description="Danh sách này gom theo ngày hết hạn thực tế để đội vận hành copy mẫu và gửi nhắc gia hạn ngay."
            action={(
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-28">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={watchlistThresholdDays}
                    onChange={(event) => {
                      const value = Number(event.target.value || 0);
                      setWatchlistThresholdDays(Number.isFinite(value) ? value : 7);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isWatchlistLoading}
                  onClick={() => void refreshRenewalWatchlist()}
                  className="rounded-full"
                >
                  <RefreshCw className={`size-4 ${isWatchlistLoading ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>
            )}
          />

          {isWatchlistLoading ? (
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/45 p-4"
                >
                  <div className="h-4 w-40 rounded bg-[var(--border-soft)]" />
                  <div className="mt-3 h-3 w-full rounded bg-[var(--border-soft)]" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-[var(--border-soft)]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div className="rounded-[1.2rem] border border-rose-100 bg-rose-50/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[12px] font-black text-rose-700">
                    <AlertCircle className="size-4" />
                    Nick đã hết hạn
                  </p>
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-700">
                    {renewalWatchlist.summary.expiredCount}
                  </span>
                </div>

                {expiredWatchItems.length === 0 ? (
                  <p className="mt-3 text-[12px] text-[var(--fg-muted)]">
                    Không có nick nào quá hạn trong phạm vi theo dõi.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {expiredWatchItems.map((item) => (
                      <div
                        key={item.subscriptionId}
                        className="rounded-[1rem] border border-rose-100 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-black text-[var(--fg-base)]">{item.customerName}</p>
                            <p className="mt-1 truncate text-[12px] text-[var(--fg-muted)]">
                              {item.serviceName} • Nick {item.nick}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                              {item.contactChannel}: {item.contactValue}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-rose-700">
                              Hạn {item.expiryDateLabel} • {getExpiryStatusLabel(item.daysUntilExpiry)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.push(`/customers/${item.customerId}`)}
                            className="h-8 rounded-full px-3 text-[11px] font-bold"
                          >
                            Khách
                          </Button>
                        </div>
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              void copyToClipboard(item.notificationMessage, "Đã sao chép mẫu nhắc gia hạn")
                            }
                            className="h-8 rounded-full px-3 text-[11px] font-bold"
                          >
                            <Copy className="mr-1.5 size-3.5" />
                            Sao chép mẫu nhắc
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[1.2rem] border border-amber-100 bg-amber-50/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[12px] font-black text-amber-700">
                    <CalendarClock className="size-4" />
                    Nick sắp hết hạn
                  </p>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">
                    {renewalWatchlist.summary.expiringSoonCount}
                  </span>
                </div>

                {expiringWatchItems.length === 0 ? (
                  <p className="mt-3 text-[12px] text-[var(--fg-muted)]">
                    Không có nick nào sắp hết hạn trong {watchlistThresholdDays} ngày tới.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {expiringWatchItems.map((item) => (
                      <div
                        key={item.subscriptionId}
                        className="rounded-[1rem] border border-amber-100 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-black text-[var(--fg-base)]">{item.customerName}</p>
                            <p className="mt-1 truncate text-[12px] text-[var(--fg-muted)]">
                              {item.serviceName} • Nick {item.nick}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                              {item.contactChannel}: {item.contactValue}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-amber-700">
                              Hạn {item.expiryDateLabel} • {getExpiryStatusLabel(item.daysUntilExpiry)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.push(`/customers/${item.customerId}`)}
                            className="h-8 rounded-full px-3 text-[11px] font-bold"
                          >
                            Khách
                          </Button>
                        </div>
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              void copyToClipboard(item.notificationMessage, "Đã sao chép mẫu nhắc gia hạn")
                            }
                            className="h-8 rounded-full px-3 text-[11px] font-bold"
                          >
                            <Copy className="mr-1.5 size-3.5" />
                            Sao chép mẫu nhắc
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="mt-6 border-[var(--accent)]/10 bg-gradient-to-br from-white via-[var(--surface-light)]/35 to-white">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--accent)]">
                  Auto-Renewal Engine
                </p>
                <h3 className="mt-2 text-[18px] font-black text-[var(--fg-base)]">
                  Tạo renewal request tự động
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-[var(--fg-muted)]">
                  Engine chỉ tạo request cho subscription đang active, chưa có request pending, không còn công nợ, không quá hạn và đạt ngưỡng reliability.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                    Days threshold
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={engineForm.daysThreshold}
                    onChange={(event) =>
                      setEngineForm((current) => ({
                        ...current,
                        daysThreshold: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                    Max created
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={engineForm.maxCreated}
                    onChange={(event) =>
                      setEngineForm((current) => ({
                        ...current,
                        maxCreated: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                    Min reliability
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={engineForm.minReliabilityScore}
                    onChange={(event) =>
                      setEngineForm((current) => ({
                        ...current,
                        minReliabilityScore: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void handleRunAutoRenewalEngine()}
                  isLoading={isRunningEngine}
                  className="rounded-full"
                >
                  <RefreshCw className="size-4" />
                  Chạy engine
                </Button>
                {lastRunReport ? (
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                    <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-[var(--accent)]">
                      {lastRunReport.createdCount} request mới
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600">
                      {lastRunReport.scannedCount} subscription quét
                    </span>
                    <span className="rounded-full bg-[var(--danger)]/10 px-3 py-1 text-[var(--danger)]">
                      {lastRunReport.skippedCount} bị bỏ qua
                    </span>
                  </div>
                ) : null}
              </div>

              {lastRunReport ? (
                <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[1.3rem] border border-[var(--border-soft)] bg-white p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      Request vừa tạo
                    </p>
                    {lastRunReport.created.length === 0 ? (
                      <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
                        Chưa có request nào được tạo trong lần chạy này.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {lastRunReport.created.slice(0, 4).map((item) => (
                          <div
                            key={item.renewalId}
                            className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/45 px-4 py-3"
                          >
                            <p className="text-[12px] font-bold text-[var(--fg-base)]">{item.customerName}</p>
                            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                              Subscription {item.subscriptionId.slice(0, 8)} • Renewal {item.renewalId.slice(0, 8)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-[1.3rem] border border-[var(--border-soft)] bg-white p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      Lý do bỏ qua
                    </p>
                    {Object.entries(lastRunReport.skippedReasons).length === 0 ? (
                      <p className="mt-2 text-[12px] text-[var(--fg-muted)]">Không có subscription nào bị loại.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(lastRunReport.skippedReasons).map(([reason, count]) => (
                          <span
                            key={reason}
                            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]"
                          >
                            {formatSkipReason(reason)}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--accent)]">
                    Audit trail
                  </p>
                  <h4 className="mt-2 text-[16px] font-black text-[var(--fg-base)]">
                    Lịch sử chạy engine
                  </h4>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void refreshEngineRunHistory()}
                  disabled={isHistoryLoading}
                  className="rounded-full"
                >
                  <RefreshCw className={`size-4 ${isHistoryLoading ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
                  {engineRunSummary.manualCount} manual
                </span>
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
                  {engineRunSummary.cronCount} cron
                </span>
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
                  {engineRunSummary.systemCount} system
                </span>
              </div>

              <div className="mt-4">
                <AdminHistoryFilters
                  value={historyDraft}
                  onChange={setHistoryDraft}
                  onApply={() => {
                    setHistoryFilters(historyDraft);
                    void refreshEngineRunHistory(historyDraft, 1);
                  }}
                  onReset={() => {
                    setHistoryDraft(DEFAULT_HISTORY_FILTERS);
                    setHistoryFilters(DEFAULT_HISTORY_FILTERS);
                    void refreshEngineRunHistory(DEFAULT_HISTORY_FILTERS, 1);
                  }}
                  isLoading={isHistoryLoading}
                />
              </div>

              {isHistoryLoading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="animate-pulse rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/45 p-4"
                    >
                      <div className="h-4 w-32 rounded bg-[var(--border-soft)]" />
                      <div className="mt-3 h-3 w-full rounded bg-[var(--border-soft)]" />
                    </div>
                  ))}
                </div>
              ) : recentEngineRuns.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    icon={<CalendarClock className="size-6" />}
                    title="Chưa có lịch sử chạy"
                    description="Chạy engine một lần để bắt đầu ghi nhận audit trail."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentEngineRuns.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/40 p-4"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <p className="text-[12px] font-black text-[var(--fg-base)]">
                            {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm")}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                            {entry.mode === "cron" ? "Cron" : "Manual"} • {entry.createdBy ?? "system"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-bold text-[var(--accent)]">
                            {entry.createdCount} created
                          </span>
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600">
                            {entry.scannedCount} scanned
                          </span>
                          <span className="rounded-full bg-[var(--danger)]/10 px-3 py-1 text-[11px] font-bold text-[var(--danger)]">
                            {entry.skippedCount} skipped
                          </span>
                        </div>
                      </div>

                      {Object.entries(entry.skippedReasons).length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(entry.skippedReasons).map(([reason, count]) => (
                            <span
                              key={reason}
                              className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]"
                            >
                              {formatSkipReason(reason)}: {count}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {engineRunMeta ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white px-4 py-3 text-[12px] text-[var(--fg-muted)]">
                      <span>
                        Trang {engineRunMeta.page}/{Math.max(engineRunMeta.totalPages, 1)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={engineRunMeta.page <= 1}
                          onClick={() => void refreshEngineRunHistory(historyFilters, engineRunMeta.page - 1)}
                        >
                          Trang trước
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={engineRunMeta.page >= Math.max(engineRunMeta.totalPages, 1)}
                          onClick={() => void refreshEngineRunHistory(historyFilters, engineRunMeta.page + 1)}
                        >
                          Trang sau
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </SurfaceCard>

        <StatsGrid className="mt-6">
          <FilterCard
            label="Chờ thanh toán"
            count={pendingCount}
            color="rgb(245 158 11)"
            icon={<AlertCircle className="size-5" />}
            onClick={() => setSelectedStatus("pending")}
          />
          <FilterCard
            label="Đã duyệt"
            count={completedCount}
            color="rgb(34 197 94)"
            icon={<CheckCircle className="size-5" />}
            onClick={() => setSelectedStatus("completed")}
          />
          <FilterCard
            label="Khách từ chối"
            count={deniedCount}
            color="rgb(239 68 68)"
            icon={<XCircle className="size-5" />}
            onClick={() => setSelectedStatus("denied")}
          />
        </StatsGrid>

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Danh sách xử lý"
            description={`Queue ${selectedStatus} hiển thị luôn báo giá, số tiền đã thu, công nợ còn lại và lợi nhuận của từng renewal request.`}
          />

          <div className="mt-4 flex flex-wrap gap-2 px-4 sm:px-6">
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
              Báo giá {formatMoney(visibleFinanceSummary.quoted)}
            </span>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
              Doanh thu {formatMoney(visibleFinanceSummary.revenue)}
            </span>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
              Công nợ {formatMoney(visibleFinanceSummary.outstanding)}
            </span>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
              visibleFinanceSummary.profit >= 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}>
              Lãi {formatMoney(visibleFinanceSummary.profit)}
            </span>
          </div>

          {isLoading ? (
            <div className="p-6">
              <div className="flex justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-white/70 p-12">
                <div className="size-8 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
              </div>
            </div>
          ) : visibleRenewals.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<CalendarClock className="size-6" />}
                title="Không có renewal request nào"
                description="Thử chuyển bộ lọc hoặc chạy engine để tạo thêm request mới."
              />
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              <DataTable
                isLoading={isLoading}
                onRowContextMenu={(event, row) => {
                  const renewal = row as RenewalRow;
                  openContextMenu(event, [
                    ...getRenewalQuickActions(renewal),
                    ...(renewal.status === "pending"
                      ? [
                          {
                            label: "Xác nhận gia hạn",
                            icon: <CheckCircle className="size-4" />,
                            onClick: () => setConfirmingRenewal(renewal),
                          },
                          {
                            label: "Báo hủy",
                            icon: <XCircle className="size-4" />,
                            danger: true,
                            onClick: () =>
                              void handleRenewalAction(
                                renewal.id,
                                "deny",
                                "Khách đã hủy gia hạn",
                                "Không thể hủy gia hạn",
                              ),
                          },
                        ]
                      : []),
                  ]);
                }}
                emptyMessage="Không có renewal request nào trong bộ lọc này."
                columns={columns}
                data={visibleRenewals}
              />
            </div>
          )}
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}
