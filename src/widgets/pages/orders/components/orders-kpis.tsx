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
      <div className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
        <div className="flex justify-between items-start">
          <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-wider">Tổng đơn hàng</p>
          <span className="rounded-2xl bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
            <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
          </span>
        </div>
        <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight">{stats.total_orders}</p>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-600">{stats.active_count} active</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-bold text-blue-600">{stats.paid_count} paid</span>
        </div>
      </div>

      <div className="app-card flex h-full flex-col gap-2 border border-[var(--warning)]/20 bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
        <div className="flex justify-between items-start">
          <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-wider">Đơn chờ xử lý</p>
          <span className="rounded-2xl bg-[var(--warning)]/10 p-1.5 text-[var(--warning)]">
            <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          </span>
        </div>
        <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight">{stats.pending_count}</p>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {stats.expired_count > 0 ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-600">{stats.expired_count} hết hạn</span>
          ) : null}
          {stats.total_debt > 0 ? (
            <span className="font-bold text-[var(--danger)]">Công nợ: {formatMoney(stats.total_debt)}</span>
          ) : null}
        </div>
      </div>

      <div className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
        <div className="flex justify-between items-start">
          <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-wider">Tổng Doanh thu</p>
          <span className="rounded-2xl bg-[var(--accent)]/10 p-1.5 text-[var(--accent)]">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </span>
        </div>
        <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight">{formatMoney(stats.total_revenue)}</p>
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className="font-bold text-emerald-500">Đã thu: {formatMoney(stats.total_paid_amount)}</span>
        </div>
      </div>

      <div className="app-card flex h-full flex-col gap-2 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
        <div className="flex justify-between items-start">
          <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-wider">Tổng Lợi nhuận</p>
          <span className={`rounded-2xl p-1.5 ${stats.total_profit >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </span>
        </div>
        <p className={`text-3xl font-black tracking-tight ${stats.total_profit >= 0 ? "text-emerald-500" : "text-[var(--danger)]"}`}>
          {formatMoney(stats.total_profit)}
        </p>
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className="text-[var(--fg-muted)]">
            Vốn: {formatMoney(stats.total_cost)} | Biên: {stats.total_revenue > 0 ? Math.round((stats.total_profit / stats.total_revenue) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
});
