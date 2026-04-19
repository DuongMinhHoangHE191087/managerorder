"use client";

import { ShoppingCart, Loader2, TrendingDown } from "lucide-react";
import { useImportSummary } from "../hooks/use-import-summary";
import { formatMoney } from "@/lib/utils";
import { SlideUp } from "@/shared/ui/animations";

export function ImportSummaryTable({ months = 6 }: { months?: number }) {
  const { data, isLoading } = useImportSummary(months);

  if (isLoading) {
    return (
      <div className="glass-card rounded-ios border border-[var(--border-soft)] shadow-sm p-8 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!data || data.data.length === 0) return null;

  const summary = data.summary ?? { totalOrders: 0, totalAmountVnd: 0, avgPerOrder: 0 };

  return (
    <SlideUp delay={0.55} className="glass-card rounded-ios border border-[var(--border-soft)] shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5 border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 backdrop-blur-sm">
        <h3 className="font-bold text-[15px] tracking-tight text-[var(--fg-base)] flex items-center gap-2">
          <ShoppingCart className="size-4 text-amber-500" />
          Nhập hàng theo Tháng
        </h3>
        <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">{months} tháng gần nhất</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 text-center border-b border-[var(--border-soft)] bg-[var(--surface-light)]">
        <div className="p-3 border-r border-[var(--border-soft)]">
          <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Tổng đơn nhập</p>
          <p className="text-[14px] font-black text-[var(--fg-base)]">{summary.totalOrders}</p>
        </div>
        <div className="p-3 border-r border-[var(--border-soft)]">
          <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Tổng chi nhập</p>
          <p className="text-[14px] font-black text-amber-600">{formatMoney(summary.totalAmountVnd)}</p>
        </div>
        <div className="p-3">
          <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">TB/đơn</p>
          <p className="text-[14px] font-black text-[var(--fg-base)]">{formatMoney(summary.avgPerOrder)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-app)]/30">
              <th className="text-left px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">Tháng</th>
              <th className="text-right px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">Số đơn</th>
              <th className="text-right px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">Tổng nhập</th>
              <th className="text-right px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">TB/đơn</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((row) => (
              <tr key={row.month} className="border-b border-[var(--border-soft)]/50 hover:bg-[var(--surface-light)] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="size-3.5 text-amber-500 shrink-0" />
                    <span className="font-bold text-[var(--fg-base)]">{row.label}</span>
                  </div>
                </td>
                <td className="text-right px-4 py-3 font-bold text-[var(--fg-base)]">{row.orderCount}</td>
                <td className="text-right px-4 py-3 font-black text-amber-600">{formatMoney(row.totalAmountVnd)}</td>
                <td className="text-right px-4 py-3 font-medium text-[var(--fg-muted)]">{formatMoney(row.avgPerOrder)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SlideUp>
  );
}
