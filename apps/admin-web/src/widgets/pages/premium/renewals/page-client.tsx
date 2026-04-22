"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { AlertCircle, CalendarClock, CheckCircle, Copy, HandCoins, RefreshCw, User, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { AppLayout } from "@/widgets/layout/app-layout";
import { ActionMenu } from "@/shared/ui/action-menu";
import { PageContainer, PageHeader, SurfaceCard, StatsGrid, SectionHeader, EmptyState } from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
import { useContextMenu } from "@/shared/ui/context-menu";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { formatMoney } from "@/lib/utils";
import type { SubscriptionRenewal } from "@/lib/domain/premium-types";

type RenewalRow = SubscriptionRenewal & {
  customer_name: string;
  account_email: string;
  service_name: string;
};

type RenewalStatusFilter = "pending" | "completed" | "denied";

const RENEWAL_STATUSES: RenewalStatusFilter[] = ["pending", "completed", "denied"];

const EMPTY_RENEWAL_BUCKETS: Record<RenewalStatusFilter, RenewalRow[]> = {
  pending: [],
  completed: [],
  denied: [],
};

type DynamicDataTableComponent = <TData, TValue>(props: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: TData) => void;
  defaultPageSize?: number;
  serverSide?: boolean;
  pageCount?: number;
  pageIndex?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  totalElements?: number;
}) => ReactElement;

const DataTable = dynamic(
  () => import("@/shared/ui/data-table").then((m) => ({ default: m.DataTable })),
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
              <div className="h-4 w-24 rounded bg-[var(--border-soft)]" />
            </div>
          </div>
        ))}
      </div>
    ),
  },
) as unknown as DynamicDataTableComponent;

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
      <div className="flex size-12 items-center justify-center rounded-[1rem] bg-[var(--surface-light)] text-[var(--fg-base)] shadow-sm" style={{ color }}>
        {icon}
      </div>
    </button>
  );
}

export default function PremiumRenewalsPage() {
  const router = useRouter();
  const { openContextMenu, ContextMenuRender } = useContextMenu();
  const [selectedStatus, setSelectedStatus] = useState<RenewalStatusFilter>("pending");
  const [renewalsByStatus, setRenewalsByStatus] = useState<Record<RenewalStatusFilter, RenewalRow[]>>(EMPTY_RENEWAL_BUCKETS);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningRenewalId, setActioningRenewalId] = useState<string | null>(null);

  const fetchRenewalsByStatus = useCallback(async (statusFilter: RenewalStatusFilter): Promise<RenewalRow[]> => {
    try {
      const res = await fetch(`/api/premium/renewals?status=${statusFilter}`);
      const payload = await readApiEnvelope<RenewalRow[]>(res);
      if (res.ok) {
        return payload.data ?? [];
      }

      appToast.error(`Lỗi tải yêu cầu gia hạn: ${payload.error ?? "Lỗi không xác định"}`);
      return [];
    } catch (err) {
      console.error("[fetchRenewalsByStatus]", err);
      appToast.error("Lỗi kết nối");
      return [];
    }
  }, []);

  const refreshRenewalBuckets = useCallback(async (nextStatus?: RenewalStatusFilter) => {
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
  }, [fetchRenewalsByStatus]);

  useEffect(() => {
    void refreshRenewalBuckets();
  }, [refreshRenewalBuckets]);

  async function handleRenewalAction(
    renewalId: string,
    endpoint: "confirm" | "deny",
    successMessage: string,
    errorMessage: string,
  ) {
    setActioningRenewalId(renewalId);

    try {
      const response = await fetch(`/api/premium/renewals/${renewalId}/${endpoint}`, { method: "POST" });
      const payload = await readApiEnvelope(response);

      if (response.ok) {
        appToast.success(successMessage);
        await refreshRenewalBuckets(selectedStatus);
        return;
      }

      appToast.error(payload.error || errorMessage);
    } catch (error) {
      console.error(`[handleRenewalAction:${endpoint}]`, error);
      appToast.error("Lỗi mạng");
    } finally {
      setActioningRenewalId((current) => (current === renewalId ? null : current));
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[copyRenewalValue]", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  function getRenewalQuickActions(renewal: RenewalRow) {
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
        onClick: () => void copyToClipboard(renewal.original_subscription_id, "Đã sao chép subscription gốc"),
      },
      {
        label: "Sao chép ID order",
        icon: <Copy className="size-4" />,
        onClick: () => void copyToClipboard(renewal.renewal_order_id, "Đã sao chép ID order gia hạn"),
      },
    ];
  }

  const columns: ColumnDef<RenewalRow>[] = [
    { accessorKey: "id", header: "Mã GH", cell: ({ row }) => <span className="font-mono text-[10px] text-[var(--fg-muted)]">{row.original.id.slice(0, 8)}</span> },
    { accessorKey: "customer_name", header: "Khách hàng", cell: ({ row }) => <span className="font-bold text-[13px] text-[var(--fg-base)]">{row.original.customer_name}</span> },
    { accessorKey: "service_name", header: "Dịch vụ đang dùng", cell: ({ row }) => <span className="font-bold text-[13px] text-[var(--accent)]">{row.original.service_name}</span> },
    { accessorKey: "renewal_requested_date", header: "Ngày nhắc gốc", cell: ({ row }) => <span className="flex items-center gap-1.5 text-[12px]"><CalendarClock className="size-3.5 text-[var(--fg-muted)]" /> {format(new Date(row.original.renewal_requested_date), "dd/MM/yyyy")}</span> },
    { accessorKey: "renewal_price", header: "Phí gia hạn", cell: ({ row }) => <span className="flex items-center gap-1 text-[14px] font-bold text-[var(--fg-base)]"><HandCoins className="size-3.5" /> {formatMoney(row.original.renewal_price || row.original.original_price)}</span> },
    {
      accessorKey: "status",
      header: "Trạng thái hiện tại",
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
                onClick={() => void handleRenewalAction(row.original.id, "confirm", "Gia hạn thành công!", "Lỗi xác nhận gia hạn")}
                className="h-8 px-2.5 text-[12px] font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-60"
              >
                <CheckCircle className="mr-1.5 size-4" />
                Đã thu tiền
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={actioningRenewalId === row.original.id}
                onClick={() => void handleRenewalAction(row.original.id, "deny", "Khách đã hủy gia hạn", "Lỗi hủy gia hạn")}
                className="h-8 px-2.5 text-[12px] font-bold text-[var(--danger)] bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 disabled:opacity-60"
              >
                <XCircle className="mr-1.5 size-4" />
                Báo huỷ
              </Button>
            </>
          ) : (
            <span className="text-[11px] text-[var(--fg-muted)]">Đã khoá</span>
          )}
          <ActionMenu items={getRenewalQuickActions(row.original)} />
        </div>
      ),
    },
  ];

  const pendingCount = renewalsByStatus.pending.length;
  const completedCount = renewalsByStatus.completed.length;
  const deniedCount = renewalsByStatus.denied.length;
  const totalCount = pendingCount + completedCount + deniedCount;
  const reviewQueueCount = pendingCount;
  const visibleRenewals = renewalsByStatus[selectedStatus];

  return (
    <AppLayout>
      <ContextMenuRender />
      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Renewals / Auto-Renewal Engine</span>}
          title="Xử lý gia hạn"
          description="Hàng đợi gia hạn do engine sinh ra. Duyệt, từ chối, hoặc lọc nhanh theo trạng thái ngay trên cùng một surface."
        />

        <SurfaceCard className="mt-6 border-[var(--accent)]/10 bg-gradient-to-br from-white via-[var(--surface-light)]/35 to-white">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--accent)]">
                Auto-Renewal Engine
              </p>
              <h3 className="mt-2 text-[18px] font-black text-[var(--fg-base)]">
                Hàng đợi review cho renewal request
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-[var(--fg-muted)]">
                Engine chỉ tạo request cho subscription đang active, chưa có renewal pending,
                không còn công nợ, không quá hạn và đạt ngưỡng reliability. Các request mới sẽ
                xuất hiện ở tab pending để đội vận hành duyệt hoặc từ chối.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/5 px-3 py-1 text-[11px] font-bold text-[var(--accent)]">
                  Active only
                </span>
                <span className="rounded-full border border-[var(--danger)]/15 bg-[var(--danger)]/5 px-3 py-1 text-[11px] font-bold text-[var(--danger)]">
                  Debt-free
                </span>
                <span className="rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1 text-[11px] font-bold text-emerald-600">
                  Reliability threshold
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 xl:items-end">
              <Button
                type="button"
                onClick={() => void refreshRenewalBuckets()}
                className="inline-flex items-center gap-2 rounded-full"
              >
                <RefreshCw className="size-4" />
                Làm mới hàng đợi
              </Button>
              <p className="max-w-sm text-right text-[11px] leading-5 text-[var(--fg-muted)]">
                Cập nhật đồng thời pending, completed và denied để giữ overview nhất quán trước khi duyệt.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tổng yêu cầu</p>
              <p className="mt-2 text-3xl font-black text-[var(--fg-base)]">{totalCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Chờ duyệt</p>
              <p className="mt-2 text-3xl font-black text-amber-600">{reviewQueueCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Đã duyệt</p>
              <p className="mt-2 text-3xl font-black text-emerald-600">{completedCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Từ chối</p>
              <p className="mt-2 text-3xl font-black text-[var(--danger)]">{deniedCount}</p>
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
                description={`Bấm chuột phải vào dòng để mở nhanh khách hàng, sao chép ID, hoặc cập nhật trạng thái gia hạn trong hàng đợi ${selectedStatus}.`}
              />

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
                title="Không có yêu cầu gia hạn nào"
                description="Thử chuyển sang bộ lọc khác hoặc kiểm tra lại trạng thái đồng bộ của engine."
              />
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              <DataTable
                isLoading={isLoading}
                onRowContextMenu={(e, row) => {
                  const renewal = row as RenewalRow;
                  openContextMenu(e, [
                    ...getRenewalQuickActions(renewal),
                    ...(renewal.status === "pending"
                      ? [
                          {
                            label: "Đã thu tiền",
                            icon: <CheckCircle className="size-4" />,
                            onClick: () => void handleRenewalAction(renewal.id, "confirm", "Gia hạn thành công!", "Lỗi xác nhận gia hạn"),
                          },
                          {
                            label: "Báo huỷ",
                            icon: <XCircle className="size-4" />,
                            danger: true,
                            onClick: () => void handleRenewalAction(renewal.id, "deny", "Khách đã hủy gia hạn", "Lỗi hủy gia hạn"),
                          },
                        ]
                      : []),
                  ]);
                }}
                emptyMessage="Không có yêu cầu gia hạn nào trong bộ lọc này."
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
