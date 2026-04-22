"use client";

import React, { useCallback, useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Download,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { Customer } from "@/lib/domain/types";
import { formatMoney } from "@/lib/utils";
import type { DebtSummary } from "@/widgets/pages/customers/hooks/use-customers";
import {
  buildCustomerStatsDashboardModel,
  formatSegmentLabel,
} from "@/widgets/pages/customers/lib/customer-stats-dashboard";
import { buildCustomerDebtSummaryCsv } from "@/widgets/pages/customers/lib/customer-debt-export";

interface CustomerStatsDashboardProps {
  customers: Customer[];
  groups: { id: string; name: string; color: string; member_count?: number }[];
  debtSummary?: DebtSummary | null;
  isDebtSummaryLoading?: boolean;
  onOpenCustomer?: (customerId: string) => void;
}

export const CustomerStatsDashboard = React.memo(function CustomerStatsDashboard({
  customers,
  groups,
  debtSummary,
  isDebtSummaryLoading = false,
  onOpenCustomer,
}: CustomerStatsDashboardProps) {
  const model = useMemo(
    () => buildCustomerStatsDashboardModel({ customers, debtSummary }),
    [customers, debtSummary],
  );

  const handleExportCsv = useCallback(() => {
    const csv = buildCustomerDebtSummaryCsv(model);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customer-debt-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [model]);

  return (
    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
      {isDebtSummaryLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/70 px-4 py-3 text-[12px] font-medium text-[var(--fg-muted)]">
          <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
          Đồng bộ debt dashboard từ dữ liệu tenant...
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-4 text-[var(--accent)]" />
            <h4 className="text-[13px] font-bold text-[var(--fg-base)]">Phân bổ tệp khách</h4>
          </div>
          <div className="space-y-3">
            {model.typeBars.map((bar) => (
              <div key={bar.label}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="font-bold text-[var(--fg-base)]">{bar.label}</span>
                  <span className="font-medium text-[var(--fg-muted)]">
                    {bar.value} ({bar.percent.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${bar.percent}%`, backgroundColor: bar.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-[var(--danger)]" />
              <h4 className="text-[13px] font-bold text-[var(--fg-base)]">Debt overview</h4>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/5 px-3 py-1.5 text-[11px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10"
            >
              <Download className="size-3.5" />
              Xuất CSV
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--fg-muted)]">Tổng công nợ</span>
              <span className="text-[15px] font-black text-[var(--danger)]">{formatMoney(model.totalDebt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--fg-muted)]">Khách còn nợ</span>
              <span className="text-[14px] font-bold text-[var(--fg-base)]">{model.customersWithDebt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--fg-muted)]">Nợ trung bình</span>
              <span className="text-[14px] font-bold text-[var(--fg-base)]">{formatMoney(model.avgDebt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[12px] text-[var(--fg-muted)]">
                <AlertTriangle className="size-3 text-[var(--danger)]" />
                Khách quá hạn
              </span>
              <span className="text-[14px] font-bold text-[var(--danger)]">{model.overdueCount}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-soft)]">
              <span className="flex items-center gap-1 text-[12px] text-[var(--fg-muted)]">
                <ShieldCheck className="size-3 text-emerald-500" />
                Reliability trung bình
              </span>
              <span className="text-[14px] font-bold text-emerald-600">{model.avgReliabilityScore}/100</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-[var(--warning)]" />
            <h4 className="text-[13px] font-bold text-[var(--fg-base)]">Top debtors</h4>
          </div>
          {model.topDebtors.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-[var(--fg-muted)]">Chưa có khách nào phát sinh công nợ.</p>
          ) : (
            <div className="space-y-2">
              {model.topDebtors.slice(0, 6).map((customer, index) => {
                const content = (
                  <>
                    <span className="w-5 shrink-0 text-[11px] font-bold text-[var(--fg-muted)]">#{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-[var(--fg-base)]">{customer.name}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">
                        {customer.overdueDays > 0 ? `Quá hạn ${customer.overdueDays} ngày` : "Chưa quá hạn"}
                        {customer.segment ? ` • ${formatSegmentLabel(customer.segment)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-black text-[var(--danger)]">
                      {formatMoney(customer.debtAmountVnd)}
                    </span>
                    {onOpenCustomer ? <ArrowUpRight className="size-3.5 shrink-0 text-[var(--accent)]" /> : null}
                  </>
                );

                return onOpenCustomer ? (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => onOpenCustomer(customer.id)}
                    className="flex w-full items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/50 px-3 py-2.5 text-left transition-colors hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={customer.id}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/50 px-3 py-2.5"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-5 md:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="size-4 text-[var(--accent)]" />
            <h4 className="text-[13px] font-bold text-[var(--fg-base)]">Aging buckets</h4>
          </div>
          <div className="space-y-3">
            {model.agingBuckets.map((bucket) => (
              <div key={bucket.key}>
                <div className="mb-1 flex justify-between gap-3 text-[12px]">
                  <span className="font-bold text-[var(--fg-base)]">{bucket.label}</span>
                  <span className="text-right text-[var(--fg-muted)]">
                    {formatMoney(bucket.amount)} ({bucket.percent.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${bucket.percent}%`, backgroundColor: bucket.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-4 text-[#6366f1]" />
            <h4 className="text-[13px] font-bold text-[var(--fg-base)]">Debt by segment</h4>
          </div>
          {model.segmentBreakdown.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-[var(--fg-muted)]">Chưa có dữ liệu phân khúc.</p>
          ) : (
            <div className="space-y-2.5">
              {model.segmentBreakdown.slice(0, 6).map((segment) => (
                <div key={segment.segment} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-bold text-[var(--fg-base)]">{segment.segment}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">{segment.count} khách</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-black text-[var(--danger)]">{formatMoney(segment.totalDebt)}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">{segment.share}% dư nợ</p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]"
                      style={{ width: `${segment.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {groups.length > 0 ? (
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-5 md:col-span-2 xl:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <Users className="size-4 text-[#6366f1]" />
              <h4 className="text-[13px] font-bold text-[var(--fg-base)]">Phân bổ theo group</h4>
            </div>
            <div className="flex flex-wrap gap-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] px-3 py-2"
                >
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                  <span className="text-[12px] font-bold text-[var(--fg-base)]">{group.name}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
                    {group.member_count ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});
