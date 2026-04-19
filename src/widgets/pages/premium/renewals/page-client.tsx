"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { AlertCircle, CalendarClock, CheckCircle, HandCoins, XCircle } from "lucide-react";

import { AppLayout } from "@/widgets/layout/app-layout";
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
  const { openContextMenu, ContextMenuRender } = useContextMenu();
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetchRenewals("pending");
  }, []);

  async function fetchRenewals(statusFilter: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/premium/renewals?status=${statusFilter}`);
      const payload = await readApiEnvelope<RenewalRow[]>(res);
      if (res.ok) setRenewals(payload.data ?? []);
      else appToast.error(`Loi tai yeu cau gia han: ${payload.error ?? "Loi khong xac dinh"}`);
    } catch (err) {
      console.error("[fetchRenewals]", err);
      appToast.error("Loi ket noi");
    } finally {
      setIsLoading(false);
    }
  }

  const columns: ColumnDef<RenewalRow>[] = [
    { accessorKey: "id", header: "Ma GH", cell: ({ row }) => <span className="font-mono text-[10px] text-[var(--fg-muted)]">{row.original.id.slice(0, 8)}</span> },
    { accessorKey: "customer_name", header: "Khach hang", cell: ({ row }) => <span className="font-bold text-[13px] text-[var(--fg-base)]">{row.original.customer_name}</span> },
    { accessorKey: "service_name", header: "Dich vu dang dung", cell: ({ row }) => <span className="font-bold text-[13px] text-[var(--accent)]">{row.original.service_name}</span> },
    { accessorKey: "renewal_requested_date", header: "Ngay nhac goc", cell: ({ row }) => <span className="flex items-center gap-1.5 text-[12px]"><CalendarClock className="size-3.5 text-[var(--fg-muted)]" /> {format(new Date(row.original.renewal_requested_date), "dd/MM/yyyy")}</span> },
    { accessorKey: "renewal_price", header: "Phi gia han", cell: ({ row }) => <span className="flex items-center gap-1 text-[14px] font-bold text-[var(--fg-base)]"><HandCoins className="size-3.5" /> {formatMoney(row.original.renewal_price || row.original.original_price)}</span> },
    {
      accessorKey: "status",
      header: "Trang thai hien tai",
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
      header: "Hanh dong",
      cell: ({ row }) =>
        row.original.status === "pending" ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="h-8 px-2.5 text-[12px] font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20">
              <CheckCircle className="mr-1.5 size-4" />
              Da thu tien
            </Button>
            <Button variant="ghost" className="h-8 px-2.5 text-[12px] font-bold text-[var(--danger)] bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20">
              <XCircle className="mr-1.5 size-4" />
              Bao huy
            </Button>
          </div>
        ) : (
          <span className="flex justify-end text-[11px] text-[var(--fg-muted)]">Da khoa</span>
        ),
    },
  ];

  const pendingCount = renewals.filter((r) => r.status === "pending").length;
  const completedCount = renewals.filter((r) => r.status === "completed").length;
  const deniedCount = renewals.filter((r) => r.status === "denied").length;

  return (
    <AppLayout>
      <ContextMenuRender />
      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Renewals</span>}
          title="Xu ly gia han"
          description="Danh sach khach hang den ngay can dong tien gia han dich vu, gom nhom theo trang thai."
        />

        <StatsGrid className="mt-6">
          <FilterCard
            label="Cho thanh toan"
            count={pendingCount}
            color="rgb(245 158 11)"
            icon={<AlertCircle className="size-5" />}
            onClick={() => void fetchRenewals("pending")}
          />
          <FilterCard
            label="Da duyet"
            count={completedCount}
            color="rgb(34 197 94)"
            icon={<CheckCircle className="size-5" />}
            onClick={() => void fetchRenewals("completed")}
          />
          <FilterCard
            label="Khach tu choi"
            count={deniedCount}
            color="rgb(239 68 68)"
            icon={<XCircle className="size-5" />}
            onClick={() => void fetchRenewals("denied")}
          />
        </StatsGrid>

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Danh sach xu ly"
            description="Bam chuot phai vao dong de cap nhat trang thai gia han ngay tu danh sach."
          />

          {isLoading ? (
            <div className="p-6">
              <div className="flex justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-white/70 p-12">
                <div className="size-8 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
              </div>
            </div>
          ) : renewals.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<CalendarClock className="size-6" />}
                title="Khong co yeu cau gia han nao"
                description="Thu bo loc hien tai hoac kiem tra lai du lieu dong bo."
              />
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              <DataTable
                isLoading={isLoading}
                onRowContextMenu={(e, row) => {
                  const renewal = row as RenewalRow;
                  openContextMenu(e, [
                    {
                      label: "Da thu tien",
                      icon: <CheckCircle className="size-4" />,
                      onClick: async () => {
                        try {
                          const res = await fetch(`/api/premium/renewals/${renewal.id}/confirm`, { method: "POST" });
                          const payload = await readApiEnvelope(res);
                          if (res.ok) {
                            appToast.success("Gia han thanh cong!");
                            void fetchRenewals("pending");
                          } else {
                            appToast.error(payload.error || "Loi xac nhan gia han");
                          }
                        } catch (err) {
                          console.error(err);
                          appToast.error("Loi mang");
                        }
                      },
                    },
                    {
                      label: "Bao huy",
                      icon: <XCircle className="size-4" />,
                      danger: true,
                      onClick: async () => {
                        try {
                          const res = await fetch(`/api/premium/renewals/${renewal.id}/deny`, { method: "POST" });
                          const payload = await readApiEnvelope(res);
                          if (res.ok) {
                            appToast.success("Khach da huy gia han");
                            void fetchRenewals("pending");
                          } else {
                            appToast.error(payload.error || "Loi huy gia han");
                          }
                        } catch (err) {
                          console.error(err);
                          appToast.error("Loi mang");
                        }
                      },
                    },
                  ]);
                }}
                emptyMessage="Khong co yeu cau gia han nao trong bo loc nay."
                columns={columns}
                data={renewals}
              />
            </div>
          )}
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}
