"use client";

import { TrendingUp, Package, Loader2 } from "lucide-react";
import { useProductProfit } from "../hooks/use-product-profit";
import { formatMoney } from "@/lib/utils";
import { SlideUp } from "@/shared/ui/animations";

export function ProductProfitTable({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useProductProfit(days);

  if (isLoading) {
    return (
      <div className="glass-card rounded-ios border border-[var(--border-soft)] shadow-sm p-8 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!data || data.data.length === 0) return null;

  const summary = data.summary ?? { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgRoi: null };

  return (
    <SlideUp delay={0.5} className="glass-card rounded-ios border border-[var(--border-soft)] shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5 border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[15px] tracking-tight text-[var(--fg-base)] flex items-center gap-2">
            <TrendingUp className="size-4 text-[var(--accent)]" />
            Lợi nhuận theo Sản phẩm
          </h3>
          <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">{days} ngày gần nhất</p>
        </div>
        {summary.avgRoi !== null && (
          <span className={`text-[12px] font-black px-3 py-1 rounded-full ${
            summary.avgRoi >= 20 ? 'bg-emerald-100 text-emerald-600'
            : summary.avgRoi >= 10 ? 'bg-amber-100 text-amber-600'
            : 'bg-red-100 text-red-600'
          }`}>
            ROI TB: {summary.avgRoi}%
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 text-center border-b border-[var(--border-soft)] bg-[var(--surface-light)]">
        <div className="p-3 border-r border-[var(--border-soft)]">
          <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Doanh thu</p>
          <p className="text-[14px] font-black text-[var(--fg-base)]">{formatMoney(summary.totalRevenue)}</p>
        </div>
        <div className="p-3 border-r border-[var(--border-soft)]">
          <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Vốn nhập</p>
          <p className="text-[14px] font-black text-[var(--fg-base)]">{formatMoney(summary.totalCost)}</p>
        </div>
        <div className="p-3">
          <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Lợi nhuận</p>
          <p className={`text-[14px] font-black ${summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(summary.totalProfit)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-app)]/30">
              <th className="text-left px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">Sản phẩm</th>
              <th className="text-right px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">SL</th>
              <th className="text-right px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">Doanh thu</th>
              <th className="text-right px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">Vốn</th>
              <th className="text-right px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">LN</th>
              <th className="text-right px-4 py-3 font-bold text-[var(--fg-muted)] text-[11px] uppercase tracking-wider">ROI</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((row) => (
              <tr key={row.productId} className="border-b border-[var(--border-soft)]/50 hover:bg-[var(--surface-light)] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package className="size-3.5 text-[var(--accent)] shrink-0" />
                    <span className="font-bold text-[var(--fg-base)] truncate max-w-[200px]">{row.productName}</span>
                  </div>
                </td>
                <td className="text-right px-4 py-3 font-medium text-[var(--fg-muted)]">{row.totalQuantity}</td>
                <td className="text-right px-4 py-3 font-bold text-[var(--fg-base)]">{formatMoney(row.totalRevenue)}</td>
                <td className="text-right px-4 py-3 font-medium text-[var(--fg-muted)]">{formatMoney(row.totalCost)}</td>
                <td className={`text-right px-4 py-3 font-bold ${row.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatMoney(row.totalProfit)}
                </td>
                <td className="text-right px-4 py-3">
                  {row.roiPercent !== null ? (
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                      row.roiPercent >= 20 ? 'bg-emerald-100 text-emerald-600'
                      : row.roiPercent >= 10 ? 'bg-amber-100 text-amber-600'
                      : 'bg-red-100 text-red-600'
                    }`}>
                      {row.roiPercent}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--fg-muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SlideUp>
  );
}
