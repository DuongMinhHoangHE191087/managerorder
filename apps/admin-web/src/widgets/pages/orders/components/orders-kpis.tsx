"use client";

import React from "react";
import { formatMoney } from "@/lib/utils";
import { useOrderStats } from "@/widgets/pages/orders/hooks/use-orders";

interface OrdersKPIsProps {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}

function KpiSkeleton() {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 animate-pulse">
      <div>
        <div className="h-2 w-14 bg-[var(--border-soft)] rounded mb-2" />
        <div className="h-5 w-20 bg-[var(--border-soft)] rounded mb-1.5" />
        <div className="h-2.5 w-24 bg-[var(--border-soft)] rounded" />
      </div>
      <div className="h-7 w-7 rounded-lg bg-[var(--border-soft)] shrink-0" />
    </div>
  );
}

export const OrdersKPIs = React.memo(function OrdersKPIs({
  search,
  status,
  date_from,
  date_to,
}: OrdersKPIsProps) {
  const { data: stats, isLoading } = useOrderStats({
    search,
    status,
    date_from,
    date_to,
  });

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      {/* Card: Tổng đơn hàng */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
        <div className="min-w-0">
          <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">Tổng đơn</p>
          <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{stats.total_orders}</p>
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded bg-emerald-50 text-emerald-600 px-1.5 py-px text-[9px] font-bold font-mono border border-emerald-100">{stats.active_count} Active</span>
            <span className="rounded bg-blue-50 text-blue-600 px-1.5 py-px text-[9px] font-bold font-mono border border-blue-100">{stats.paid_count} Paid</span>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
          <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
        </span>
      </div>

      {/* Card: Đơn chờ xử lý */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200/60 bg-amber-50/30 p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
        <div className="min-w-0">
          <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">Chờ xử lý</p>
          <p className="text-lg font-black tracking-tight font-mono leading-none mb-1.5 text-amber-600">{stats.pending_count}</p>
          <div className="flex flex-wrap items-center gap-1">
            {stats.expired_count > 0 ? (
              <span className="rounded bg-red-50 text-red-600 px-1.5 py-px text-[9px] font-bold font-mono border border-red-100">{stats.expired_count} Hết hạn</span>
            ) : null}
            {stats.total_debt > 0 ? (
              <span className="text-[var(--danger)] bg-red-50 px-1.5 py-px rounded border border-red-100 text-[9px] font-bold font-mono">Nợ: {formatMoney(stats.total_debt)}</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-amber-100 p-1.5 text-amber-600">
          <span className="material-symbols-outlined text-[14px]">pending_actions</span>
        </span>
      </div>

      {/* Card: Doanh thu */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
        <div className="min-w-0">
          <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">Doanh thu</p>
          <p className="text-[var(--fg-base)] text-lg font-black tracking-tight font-mono leading-none mb-1.5">{formatMoney(stats.total_revenue)}</p>
          <div className="flex items-center gap-1">
            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-px rounded border border-emerald-100 text-[9px] font-bold font-mono">Thu: {formatMoney(stats.total_paid_amount)}</span>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
          <span className="material-symbols-outlined text-[14px]">payments</span>
        </span>
      </div>

      {/* Card: Lợi nhuận */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-[0_1px_3px_rgba(22,60,30,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(22,60,30,0.07)]">
        <div className="min-w-0">
          <p className="text-[var(--fg-muted)] text-[9px] font-bold uppercase tracking-widest mb-1">Lợi nhuận</p>
          <p className={`text-lg font-black tracking-tight font-mono leading-none mb-1.5 ${stats.total_profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {formatMoney(stats.total_profit)}
          </p>
          <div className="flex items-center gap-1">
            <span className="bg-slate-50 px-1.5 py-px rounded border border-slate-100 text-[9px] font-bold font-mono text-[var(--fg-muted)]">
              Biên: <span className="font-extrabold text-[var(--accent)]">{stats.total_revenue > 0 ? Math.round((stats.total_profit / stats.total_revenue) * 100) : 0}%</span>
            </span>
          </div>
        </div>
        <span className={`shrink-0 rounded-lg p-1.5 ${stats.total_profit >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
          <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
        </span>
      </div>
    </div>
  );
});
