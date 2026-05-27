"use client";

import Link from "next/link";
import { Clock3, Database, LoaderCircle, Plus, Upload } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-layout";

interface OrdersPageHeaderProps {
  totalOrders: number;
  isFetching?: boolean;
  hasFilters?: boolean;
  isLocalFixture?: boolean;
}

export function OrdersPageHeader({
  totalOrders,
  isFetching = false,
  hasFilters = false,
  isLocalFixture = false,
}: OrdersPageHeaderProps) {
  return (
    <PageHeader
      title="Quản lý đơn hàng"
      description="Một workspace rộng hơn cho đội vận hành: lọc nhanh, xem KPI, mở chi tiết và xử lý thanh toán hoặc gia hạn mà không phải chuyển qua nhiều màn."
      eyebrow={
        <>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
            Order Workspace
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--fg-muted)]">
            <Clock3 className="size-3.5" />
            {totalOrders} đơn
          </span>
          {hasFilters ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-700">
              Đang lọc dữ liệu
            </span>
          ) : null}
          {isFetching ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
              <LoaderCircle className="size-3.5 animate-spin" />
              Đang đồng bộ
            </span>
          ) : null}
          {isLocalFixture ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-800">
              <Database className="size-3.5" />
              Demo data
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Link
            href="/orders/import"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-4 text-sm font-bold text-[var(--fg-base)] shadow-sm transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:border-[var(--accent)]/25 hover:bg-white"
          >
            <Upload className="size-4" />
            Import đơn
          </Link>
          <Link
            href="/orders/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-6 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
          >
            <Plus className="size-5" />
            Tạo đơn mới
          </Link>
        </>
      }
      className="mt-2"
    />
  );
}
