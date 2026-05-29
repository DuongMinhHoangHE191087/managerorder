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
    <div className="app-card flex flex-col gap-2 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-pulse">
      <div className="flex justify-between items-start">
        <div className="h-3 w-24 bg-[var(--border-soft)] rounded" />
        <div className="h-8 w-8 bg-[var(--border-soft)] rounded-2xl" />
      </div>
      <div className="h-8 w-28 bg-[var(--border-soft)] rounded mt-2" />
      <div className="h-3 w-32 bg-[var(--border-soft)] rounded mt-1" />
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
        <div className="flex justify-between items-start">
          <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">Tổng đơn hàng</p>
          <span className="rounded-xl bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
            <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
          </span>
        </div>
        <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight font-mono">{stats.total_orders}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
          <span className="rounded-lg bg-emerald-50 text-emerald-600 px-1.5 py-0.5 font-mono font-extrabold">{stats.active_count} Active</span>
          <span className="rounded-lg bg-blue-50 text-blue-600 px-1.5 py-0.5 font-mono font-extrabold">{stats.paid_count} Paid</span>
        </div>
      </div>

      <div className="app-card flex h-full flex-col gap-2 border border-[var(--warning)]/20 bg-amber-500/[0.02] backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
        <div className="flex justify-between items-start">
          <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">Đơn chờ xử lý</p>
          <span className="rounded-xl bg-[var(--warning)]/10 p-1.5 text-[var(--warning)]">
            <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          </span>
        </div>
        <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight font-mono text-amber-600">{stats.pending_count}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          {stats.expired_count > 0 ? (
            <span className="rounded-lg bg-red-50 text-red-600 px-1.5 py-0.5 font-mono font-extrabold">{stats.expired_count} Hết Hạn</span>
          ) : null}
          {stats.total_debt > 0 ? (
            <span className="font-extrabold text-[var(--danger)] bg-red-50 px-1.5 py-0.5 rounded-lg border border-red-100 font-mono">Nợ: {formatMoney(stats.total_debt)}</span>
          ) : null}
        </div>
      </div>

      <div className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
        <div className="flex justify-between items-start">
          <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">Tổng Doanh thu</p>
          <span className="rounded-xl bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </span>
        </div>
        <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight font-mono">{formatMoney(stats.total_revenue)}</p>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
          <span className="font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg border border-emerald-100 font-mono">Đã thu: {formatMoney(stats.total_paid_amount)}</span>
        </div>
      </div>

      <div className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default">
        <div className="flex justify-between items-start">
          <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">Tổng Lợi nhuận</p>
          <span className={`rounded-xl p-1.5 ${stats.total_profit >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </span>
        </div>
        <p className={`text-3xl font-black tracking-tight font-mono ${stats.total_profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
          {formatMoney(stats.total_profit)}
        </p>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
          <span className="font-semibold bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-100 font-mono">
            Vốn: {formatMoney(stats.total_cost)} | Biên: <span className="font-extrabold text-[var(--accent)] font-mono">{stats.total_revenue > 0 ? Math.round((stats.total_profit / stats.total_revenue) * 100) : 0}%</span>
          </span>
        </div>
      </div>
    </div>
  );
});
