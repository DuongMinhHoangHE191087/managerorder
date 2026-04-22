"use client";

import dynamic from "next/dynamic";
import type { ReactElement, MouseEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  RefreshCw,
  Zap,
} from "lucide-react";
import { ActionMenu } from "@/shared/ui/action-menu";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/lib/toast";
import type { HealthCheckLogRow, PremiumServiceOption } from "../types";
import {
  formatConnectionStatus,
  formatHealthCheckStatus,
  formatHealthCheckTimestamp,
  formatHealthCheckType,
  formatPremiumAccountStatus,
  getCheckTypePillClass,
  getConnectionStatusClass,
  getStatusPillClass,
} from "../utils";

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

function StatusPill({ status }: { status: HealthCheckLogRow["current_status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${getStatusPillClass(status)}`}
    >
      {status === "working" ? (
        <CheckCircle2 className="size-3.5" />
      ) : status === "error" ? (
        <AlertCircle className="size-3.5" />
      ) : (
        <Clock3 className="size-3.5" />
      )}
      {formatHealthCheckStatus(status)}
    </span>
  );
}

function TypePill({ type }: { type: HealthCheckLogRow["check_type"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${getCheckTypePillClass(type)}`}
    >
      <Zap className="size-3.5" />
      {formatHealthCheckType(type)}
    </span>
  );
}

function ConnectionPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${getConnectionStatusClass(status)}`}
    >
      {formatConnectionStatus(status)}
    </span>
  );
}

export function HealthChecksTable({
  logs,
  serviceMap,
  isLoading,
  pageIndex,
  pageSize,
  pageCount,
  totalElements,
  runningAccountId,
  onPaginationChange,
  onRunAccount,
  onOpenLogDetail,
}: {
  logs: HealthCheckLogRow[];
  serviceMap: Record<string, PremiumServiceOption>;
  isLoading: boolean;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  totalElements: number;
  runningAccountId: string | null;
  onPaginationChange: (pageIndex: number, pageSize: number) => void;
  onRunAccount: (accountId: string) => void;
  onOpenLogDetail?: (log: HealthCheckLogRow) => void;
}) {
  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[copyHealthCheckValue]", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  };

  const columns: ColumnDef<HealthCheckLogRow>[] = [
    {
      accessorKey: "premium_account_id",
      header: "Tài khoản",
      enableSorting: false,
      cell: ({ row }) => {
        const account = row.original.premium_accounts;

        return (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">
              {account?.primary_email ?? row.original.premium_account_id}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--fg-muted)]">
              <span>Kho: {formatPremiumAccountStatus(account?.status)}</span>
              <ConnectionPill status={account?.connection_status ?? null} />
            </p>
            {row.original.notes ? (
              <p className="mt-1 line-clamp-1 text-[11px] text-[var(--fg-muted)]">{row.original.notes}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: "service_type_id",
      header: "Dịch vụ",
      enableSorting: false,
      cell: ({ row }) => {
        const service = serviceMap[row.original.service_type_id];

        return (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">
              {service?.name ?? row.original.service_type_id}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[var(--fg-muted)]">
              {service ? service.category : "Chưa có thông tin dịch vụ"}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "current_status",
      header: "Trạng thái",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="space-y-2">
          <StatusPill status={row.original.current_status} />
          <p className="text-[11px] font-medium text-[var(--fg-muted)]">
            Trước: {row.original.previous_status ?? "N/A"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "check_type",
      header: "Kiểu kiểm tra",
      enableSorting: false,
      cell: ({ row }) => <TypePill type={row.original.check_type} />,
    },
    {
      accessorKey: "check_timestamp",
      header: "Kiểm tra lúc",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-[13px] font-semibold text-[var(--fg-base)]">
          {formatHealthCheckTimestamp(row.original.check_timestamp)}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Thao tác",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={runningAccountId === row.original.premium_account_id}
            onClick={() => onRunAccount(row.original.premium_account_id)}
            className="rounded-full px-3.5 text-[12px] font-bold"
          >
            <RefreshCw className="size-4" />
            Chạy lại
          </Button>
          <ActionMenu
            items={[
              {
                label: "Xem chi tiết",
                icon: <Eye className="size-4" />,
                onClick: () => onOpenLogDetail?.(row.original),
              },
              {
                label: "Sao chép email",
                icon: <Copy className="size-4" />,
                onClick: () =>
                  void copyToClipboard(
                    row.original.premium_accounts?.primary_email ?? row.original.premium_account_id,
                    "Đã sao chép email tài khoản",
                  ),
              },
              {
                label: "Sao chép ID log",
                icon: <Copy className="size-4" />,
                onClick: () => void copyToClipboard(row.original.id, "Đã sao chép ID log"),
                dividerBefore: true,
              },
              {
                label: "Sao chép ID tài khoản",
                icon: <Copy className="size-4" />,
                onClick: () => void copyToClipboard(row.original.premium_account_id, "Đã sao chép ID tài khoản"),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={logs}
      isLoading={isLoading}
      emptyMessage="Không có log health check nào phù hợp bộ lọc hiện tại."
      defaultPageSize={pageSize}
      serverSide
      pageCount={pageCount}
      pageIndex={pageIndex}
      totalElements={totalElements}
      onPaginationChange={onPaginationChange}
      onRowClick={onOpenLogDetail}
    />
  );
}
