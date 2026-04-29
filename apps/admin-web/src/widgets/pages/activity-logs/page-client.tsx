"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactElement } from "react";
import dynamic from "next/dynamic";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  Clock,
  Database,
  Edit3,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Search,
  Server,
  Trash2,
  User,
} from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { useActivityLogs } from "@/widgets/pages/activity-logs/hooks/use-activity-logs";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import {
  FiltersBar,
  PageContainer,
  PageHeader,
  SectionHeader,
  StatsGrid,
  SurfaceCard,
} from "@/shared/ui/page-layout";
import { useContextMenu } from "@/shared/ui/context-menu";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import { hasSearchTokens } from "@/shared/lib/filtering/search";
import {
  formatActivityPrimitive,
  humanizeActivityDetailKey,
  parseActivityDetailValue,
} from "@/widgets/pages/activity-logs/lib/details";

function getActionBadge(type?: string | null) {
  if (!type) {
    return {
      label: vi.common.notAvailable,
      color: "bg-gray-100 text-gray-700 border-gray-200",
      icon: <Activity className="mr-1 size-3.5" />,
    };
  }

  const normalized = type.toUpperCase();
  if (normalized.includes("CREATE")) {
    return {
      label: vi.activityLogs.badges.create,
      color: "bg-green-100 text-green-700 border-green-200",
      icon: <PlusCircle className="mr-1 size-3.5" />,
    };
  }
  if (normalized.includes("UPDATE")) {
    return {
      label: vi.activityLogs.badges.update,
      color: "bg-blue-100 text-blue-700 border-blue-200",
      icon: <Edit3 className="mr-1 size-3.5" />,
    };
  }
  if (normalized.includes("DELETE")) {
    return {
      label: vi.activityLogs.badges.delete,
      color: "bg-red-100 text-red-700 border-red-200",
      icon: <Trash2 className="mr-1 size-3.5" />,
    };
  }
  if (normalized.includes("ALLOCATE") || normalized.includes("PROCESS")) {
    return {
      label: vi.activityLogs.badges.process,
      color: "bg-purple-100 text-purple-700 border-purple-200",
      icon: <PlayCircle className="mr-1 size-3.5" />,
    };
  }
  if (normalized.includes("RENEW")) {
    return {
      label: "Gia hạn",
      color: "bg-emerald-100 text-emerald-700 border-emerald-200",
      icon: <RefreshCw className="mr-1 size-3.5" />,
    };
  }
  if (normalized.includes("REFUND")) {
    return {
      label: "Hoàn tiền",
      color: "bg-amber-100 text-amber-700 border-amber-200",
      icon: <RefreshCw className="mr-1 size-3.5" />,
    };
  }

  return {
    label: type,
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: <Activity className="mr-1 size-3.5" />,
  };
}

type LogRow = {
  created_at?: string;
  created_by?: string | null;
  action_type?: string;
  customers?: { full_name: string } | null;
  orders?: { id: string } | null;
  inventory_accounts?: { email: string } | null;
  details?: Record<string, unknown> | null;
};

type DynamicDataTableComponent = <TData, TValue>(props: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  onRowContextMenu?: (e: MouseEvent, row: TData) => void;
  defaultPageSize?: number;
  serverSide?: boolean;
  pageCount?: number;
  pageIndex?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  totalElements?: number;
}) => ReactElement;

const DataTable = dynamic(
  () => import("@/shared/ui/data-table").then((module) => ({ default: module.DataTable })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-[var(--border-soft)] bg-white/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-4 w-36 rounded bg-gray-200" />
              <div className="h-4 w-40 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    ),
  },
) as unknown as DynamicDataTableComponent;

const ACTION_FILTER_OPTIONS = [
  { value: "", label: vi.activityLogs.page.allActions },
  { value: "CUSTOMER_CREATED", label: vi.activityLogs.actionLabels.CUSTOMER_CREATED },
  { value: "CUSTOMER_UPDATED", label: vi.activityLogs.actionLabels.CUSTOMER_UPDATED },
  { value: "CUSTOMER_DELETED", label: vi.activityLogs.actionLabels.CUSTOMER_DELETED },
  { value: "ORDER_CREATED", label: vi.activityLogs.actionLabels.ORDER_CREATED },
  { value: "ORDER_UPDATED", label: vi.activityLogs.actionLabels.ORDER_UPDATED },
  { value: "ORDER_DELETED", label: vi.activityLogs.actionLabels.ORDER_DELETED },
  { value: "ORDER_CANCELLED", label: vi.activityLogs.actionLabels.ORDER_CANCELLED },
  { value: "PAYMENT_ADDED", label: vi.activityLogs.actionLabels.PAYMENT_ADDED },
  { value: "INVENTORY_ASSIGNED", label: vi.activityLogs.actionLabels.INVENTORY_ASSIGNED },
  { value: "WARRANTY_REASSIGNED", label: vi.activityLogs.actionLabels.WARRANTY_REASSIGNED },
  { value: "PRODUCT_CREATED", label: vi.activityLogs.actionLabels.PRODUCT_CREATED },
  { value: "PRODUCT_UPDATED", label: vi.activityLogs.actionLabels.PRODUCT_UPDATED },
  { value: "PRODUCT_DELETED", label: vi.activityLogs.actionLabels.PRODUCT_DELETED },
  { value: "CALENDAR_EVENT_CREATED", label: vi.activityLogs.actionLabels.CALENDAR_EVENT_CREATED },
  { value: "CALENDAR_EVENT_UPDATED", label: vi.activityLogs.actionLabels.CALENDAR_EVENT_UPDATED },
  { value: "CALENDAR_EVENT_DELETED", label: vi.activityLogs.actionLabels.CALENDAR_EVENT_DELETED },
  { value: "SYSTEM_SETTINGS_UPDATED", label: vi.activityLogs.actionLabels.SYSTEM_SETTINGS_UPDATED },
  { value: "PAYMENT_SOURCE_CREATED", label: vi.activityLogs.actionLabels.PAYMENT_SOURCE_CREATED },
  { value: "PAYMENT_SOURCE_UPDATED", label: vi.activityLogs.actionLabels.PAYMENT_SOURCE_UPDATED },
  { value: "PAYMENT_SOURCE_DELETED", label: vi.activityLogs.actionLabels.PAYMENT_SOURCE_DELETED },
] as const;

export default function ActivityLogsPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const hasSearchQuery = hasSearchTokens(debouncedQuery);

  const { openContextMenu, ContextMenuRender } = useContextMenu();
  const { data: pageData, isLoading, isFetching, refetch } = useActivityLogs({
    page: pageIndex + 1,
    limit: pageSize,
    search: hasSearchQuery ? debouncedQuery.trim() : undefined,
    actionType: actionTypeFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const logs = useMemo(() => (pageData?.data ?? []) as LogRow[], [pageData?.data]);
  const meta = pageData?.meta || { count: 0, totalPages: 0 };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const hasFilters = Boolean(hasSearchTokens(searchQuery) || actionTypeFilter || startDate || endDate);

  const summary = useMemo(() => {
    let createCount = 0;
    let updateCount = 0;
    let deleteCount = 0;
    let systemCount = 0;

    for (const log of logs) {
      const action = log.action_type?.toUpperCase() ?? "";
      if (action.includes("CREATE")) createCount += 1;
      if (action.includes("UPDATE")) updateCount += 1;
      if (action.includes("DELETE")) deleteCount += 1;
      if (!log.customers && !log.orders && !log.inventory_accounts) systemCount += 1;
    }

    return { createCount, updateCount, deleteCount, systemCount };
  }, [logs]);

  const columns = useMemo<ColumnDef<LogRow>[]>(() => [
    {
      id: "created_at",
      header: vi.activityLogs.page.columns.time,
      cell: ({ row }) => {
        const data = row.original;
        return (
          <div className="flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">
            <Clock className="size-3.5 text-gray-400" />
            {data.created_at ? formatDateLabel(data.created_at) : vi.common.notAvailable}
          </div>
        );
      },
    },
    {
      id: "action_type",
      header: vi.activityLogs.page.columns.action,
      cell: ({ row }) => {
        const data = row.original;
        const badge = getActionBadge(data.action_type);
        return (
          <div className="flex flex-col gap-1">
            <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${badge.color}`}>
              {badge.icon}
              {badge.label}
            </span>
            <span className="text-[10px] font-mono text-gray-400">{data.action_type}</span>
          </div>
        );
      },
    },
    {
      id: "target",
      header: vi.activityLogs.page.columns.target,
      cell: ({ row }) => {
        const data = row.original;
        return (
          <div className="flex flex-col gap-1.5 text-[13px]">
            {data.customers ? (
              <div className="flex w-fit items-center gap-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-blue-600">
                <User className="size-3" />
                <span className="font-semibold">{data.customers.full_name}</span>
              </div>
            ) : null}
            {data.orders ? (
              <div className="flex w-fit items-center gap-1.5 rounded-md bg-orange-50 px-2 py-0.5 text-orange-600">
                <Database className="size-3" />
                <span className="font-mono font-medium">Order #{data.orders.id.slice(0, 6)}</span>
              </div>
            ) : null}
            {data.inventory_accounts ? (
              <div className="flex w-fit items-center gap-1.5 rounded-md bg-purple-50 px-2 py-0.5 text-purple-600">
                <Server className="size-3" />
                <span className="font-medium">{data.inventory_accounts.email}</span>
              </div>
            ) : null}
            {data.created_by ? (
              <div className="flex w-fit items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                <User className="size-3" />
                <span className="font-medium">{data.created_by}</span>
              </div>
            ) : null}
            {!data.customers && !data.orders && !data.inventory_accounts ? (
              <span className="italic text-gray-400">{vi.activityLogs.page.system}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "details",
      header: vi.activityLogs.page.columns.details,
      cell: ({ row }) => {
        const data = row.original;
        if (!data.details || Object.keys(data.details).length === 0) {
          return <span className="text-[11px] italic text-gray-400">{vi.activityLogs.page.noDetails}</span>;
        }

        const labelMap: Record<string, string> = vi.activityLogs.details.labels;

        return (
          <div className="custom-scrollbar max-h-[132px] max-w-[420px] overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
            {data.action_type === "WARRANTY_REASSIGNED" &&
            data.details.old_account &&
            data.details.new_account ? (
              <div className="flex flex-col gap-1.5 text-[12px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-all text-slate-500 line-through">
                    {String(data.details.old_account)}
                  </span>
                  <span className="break-all font-bold text-emerald-500">
                    → {String(data.details.new_account)}
                  </span>
                </div>
                {"reason" in data.details ? (
                  <span className="mt-0.5 text-[11px] text-slate-500">
                    Lý do: {String(data.details.reason)}
                  </span>
                ) : null}
              </div>
            ) : data.action_type === "PAYMENT_ADDED" ? (
              <div className="flex flex-col gap-1 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{vi.activityLogs.timeline.paymentLabel}</span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-600">
                    {formatMoney(Number(data.details.amount || 0))}
                  </span>
                </div>
                {"note" in data.details ? (
                  <div className="mt-1 border-t border-slate-200 pt-1 text-[11px] italic text-slate-500">
                    {String(data.details.note)}
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(data.details).map(([key, value]) => (
                  <li key={key} className="flex items-start justify-between gap-4 text-[11px] font-mono">
                    <span className="whitespace-nowrap capitalize text-slate-500">
                      {humanizeActivityDetailKey(key, labelMap)}:
                    </span>
                    <span className="break-all text-right font-semibold text-slate-700">
                      {(() => {
                        const parsed = parseActivityDetailValue(value);
                        if (Array.isArray(parsed)) {
                          return `${parsed.length} mục`;
                        }
                        if (parsed && typeof parsed === "object") {
                          return Object.entries(parsed)
                            .slice(0, 3)
                            .map(([childKey, childValue]) => `${humanizeActivityDetailKey(childKey, labelMap)}: ${formatActivityPrimitive(childKey, childValue)}`)
                            .join(" • ");
                        }

                        return formatActivityPrimitive(key, parsed);
                      })()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      },
    },
  ], []);

  const handleCopyDetails = async (log: LogRow) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log.details || {}, null, 2));
      appToast.success("Đã sao chép payload log");
    } catch {
      appToast.error("Không thể sao chép payload log");
    }
  };

  return (
    <AppLayout>
      <ContextMenuRender />
      <PageContainer variant="wide" className="relative pb-20">
        <PageHeader
          title={vi.activityLogs.page.title}
          description="Một workspace audit chung để rà lịch sử thay đổi, tra payload thao tác và đối chiếu các sự kiện vận hành theo cùng một nhịp filter và bảng dữ liệu."
          eyebrow={
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
                Audit Workspace
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                <Activity className="size-3.5" />
                {meta.count} log
              </span>
              {hasFilters ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-700">
                  Đang lọc dữ liệu
                </span>
              ) : null}
            </>
          }
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void refetch();
              }}
              disabled={isFetching}
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          }
          className="mt-2"
        />

        <StatsGrid className="xl:grid-cols-4">
          <div className="app-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Tạo mới</div>
            <div className="mt-2 text-2xl font-black text-emerald-600">{summary.createCount}</div>
            <p className="mt-1 text-[12px] text-[var(--fg-muted)]">Số event create trong dataset hiện tại.</p>
          </div>
          <div className="app-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Cập nhật</div>
            <div className="mt-2 text-2xl font-black text-sky-600">{summary.updateCount}</div>
            <p className="mt-1 text-[12px] text-[var(--fg-muted)]">Các thao tác sửa đổi đã ghi lại.</p>
          </div>
          <div className="app-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Xóa / huỷ</div>
            <div className="mt-2 text-2xl font-black text-rose-600">{summary.deleteCount}</div>
            <p className="mt-1 text-[12px] text-[var(--fg-muted)]">Phù hợp để review các thao tác nhạy cảm.</p>
          </div>
          <div className="app-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">System</div>
            <div className="mt-2 text-2xl font-black text-[var(--fg-base)]">{summary.systemCount}</div>
            <p className="mt-1 text-[12px] text-[var(--fg-muted)]">Log không gắn trực tiếp khách, đơn hoặc kho.</p>
          </div>
        </StatsGrid>

        <FiltersBar sticky className="px-4 py-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_220px_260px_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                className="h-11 pl-9"
                placeholder={vi.activityLogs.page.searchPlaceholder}
                autoComplete="off"
                name="search-logs"
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPageIndex(0);
                }}
              />
            </div>

            <Select
              value={actionTypeFilter}
              onChange={(event) => {
                setActionTypeFilter(event.target.value);
                setPageIndex(0);
              }}
              className="h-11"
            >
              {ACTION_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setPageIndex(0);
                }}
                className="h-11"
                title={vi.activityLogs.page.fromDate}
              />
              <Input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setPageIndex(0);
                }}
                className="h-11"
                title={vi.activityLogs.page.toDate}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                disabled={!hasFilters}
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedQuery("");
                  setActionTypeFilter("");
                  setStartDate("");
                  setEndDate("");
                  setPageIndex(0);
                }}
              >
                Xóa lọc
              </Button>
            </div>
          </div>
        </FiltersBar>

        <SurfaceCard className={isFetching && !isLoading ? "pointer-events-none opacity-60" : undefined}>
          <SectionHeader
            title="Dòng sự kiện"
            description="Click chuột phải để sao chép payload chi tiết. Bảng này giữ server-side pagination để log dài vẫn tải nhanh."
            action={
              <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Trang {pageIndex + 1}/{Math.max(meta.totalPages, 1)}
              </span>
            }
          />
          <div className="p-4">
            <DataTable
              serverSide
              onRowContextMenu={(event, row) => {
                const log = row as LogRow;
                openContextMenu(event, [
                  {
                    label: vi.activityLogs.page.copyData,
                    icon: <Database className="size-4" />,
                    onClick: () => {
                      void handleCopyDetails(log);
                    },
                  },
                ]);
              }}
              isLoading={isLoading}
              pageCount={meta.totalPages}
              pageIndex={pageIndex}
              totalElements={meta.count}
              onPaginationChange={(newPageIndex, newPageSize) => {
                setPageIndex(newPageIndex);
                setPageSize(newPageSize);
              }}
              columns={columns}
              data={logs}
              emptyMessage={isLoading ? vi.activityLogs.page.loading : vi.activityLogs.page.empty}
            />
          </div>
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}
