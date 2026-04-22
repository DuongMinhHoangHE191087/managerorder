"use client";

import React, { useMemo } from "react";
import { Users, TrendingUp, AlertTriangle, Wallet } from "lucide-react";
import type { Customer } from "@/lib/domain/types";
import { formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

interface CustomerStatsDashboardProps {
  customers: Customer[];
  groups: { id: string; name: string; color: string; member_count?: number }[];
}

interface StatBar {
  label: string;
  value: number;
  color: string;
  percent: number;
}

export const CustomerStatsDashboard = React.memo(function CustomerStatsDashboard({ customers, groups }: CustomerStatsDashboardProps) {
  const stats = useMemo(() => {
    const total = customers.length;
    const byType = {
      retail: customers.filter(c => c.customerType === "retail").length,
      wholesale: customers.filter(c => c.customerType === "wholesale").length,
      agency: customers.filter(c => c.customerType === "agency").length,
    };

    const withDebt = customers.filter(c => c.debtAmountVnd > 0);
    const totalDebt = customers.reduce((sum, c) => sum + c.debtAmountVnd, 0);
    const avgDebt = withDebt.length > 0 ? totalDebt / withDebt.length : 0;
    const overdueCount = customers.filter(c => c.debtOverdueDays > 7).length;

    // Top 5 debtors
    const topDebtors = [...customers]
      .filter(c => c.debtAmountVnd > 0)
      .sort((a, b) => b.debtAmountVnd - a.debtAmountVnd)
      .slice(0, 5);

    // Type distribution bars
    const typeBars: StatBar[] = [
      { label: vi.customers.filters.retail, value: byType.retail, color: "#6366f1", percent: total ? (byType.retail / total) * 100 : 0 },
      { label: vi.customers.filters.wholesale, value: byType.wholesale, color: "#f59e0b", percent: total ? (byType.wholesale / total) * 100 : 0 },
      { label: vi.customers.filters.agency, value: byType.agency, color: "#10b981", percent: total ? (byType.agency / total) * 100 : 0 },
    ];

    return { total, byType, withDebt: withDebt.length, totalDebt, avgDebt, overdueCount, topDebtors, typeBars };
  }, [customers]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
      {/* Type Distribution */}
      <div className="bg-white border border-[var(--border-soft)] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="size-4 text-[var(--accent)]" />
          <h4 className="text-[13px] font-bold text-[var(--fg-base)]">{vi.customers.stats.typeDistribution}</h4>
        </div>
        <div className="space-y-3">
          {stats.typeBars.map(bar => (
            <div key={bar.label}>
              <div className="flex justify-between text-[12px] mb-1">
                <span className="font-bold text-[var(--fg-base)]">{bar.label}</span>
                <span className="text-[var(--fg-muted)] font-medium">{bar.value} ({bar.percent.toFixed(0)}%)</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${bar.percent}%`, backgroundColor: bar.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debt Overview */}
      <div className="bg-white border border-[var(--border-soft)] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="size-4 text-[var(--danger)]" />
          <h4 className="text-[13px] font-bold text-[var(--fg-base)]">{vi.customers.stats.debtOverview}</h4>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[var(--fg-muted)]">{vi.customers.stats.debtTotal}</span>
            <span className="text-[14px] font-black text-[var(--danger)]">{formatMoney(stats.totalDebt)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[var(--fg-muted)]">{vi.customers.stats.customersWithDebt}</span>
            <span className="text-[14px] font-bold text-[var(--fg-base)]">{stats.withDebt}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[var(--fg-muted)]">{vi.customers.stats.avgDebt}</span>
            <span className="text-[14px] font-bold text-[var(--fg-base)]">{formatMoney(stats.avgDebt)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[var(--fg-muted)] flex items-center gap-1">
              <AlertTriangle className="size-3 text-[var(--danger)]" />{vi.customers.stats.overdue}
            </span>
            <span className="text-[14px] font-bold text-[var(--danger)]">{stats.overdueCount}</span>
          </div>
        </div>
      </div>

      {/* Top Debtors */}
      <div className="bg-white border border-[var(--border-soft)] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-4 text-[var(--warning)]" />
          <h4 className="text-[13px] font-bold text-[var(--fg-base)]">{vi.customers.stats.topDebtors}</h4>
        </div>
        {stats.topDebtors.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-muted)] text-center py-4">{vi.customers.stats.noneDebtors}</p>
        ) : (
          <div className="space-y-2">
            {stats.topDebtors.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold text-[var(--fg-muted)] w-4 shrink-0">#{i + 1}</span>
                <span className="text-[12px] font-bold text-[var(--fg-base)] flex-1 truncate">{c.name}</span>
                <span className="text-[12px] font-bold text-[var(--danger)] shrink-0">{formatMoney(c.debtAmountVnd)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Group Distribution */}
      {groups.length > 0 && (
        <div className="bg-white border border-[var(--border-soft)] rounded-2xl p-5 md:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <Users className="size-4 text-[#6366f1]" />
            <h4 className="text-[13px] font-bold text-[var(--fg-base)]">{vi.customers.stats.groupDistribution}</h4>
          </div>
          <div className="flex flex-wrap gap-3">
            {groups.map(g => (
              <div
                key={g.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-soft)]"
              >
                <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                <span className="text-[12px] font-bold text-[var(--fg-base)]">{g.name}</span>
                <span className="text-[11px] font-medium text-[var(--fg-muted)] bg-gray-100 px-1.5 py-0.5 rounded">
                  {g.member_count ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
