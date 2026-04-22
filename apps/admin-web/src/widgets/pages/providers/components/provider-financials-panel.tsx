"use client";

import { Banknote } from "lucide-react";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import type { ProviderPurchaseOrder } from "@/shared/types/providers";
import { vi } from "@/shared/messages/vi";

interface ProviderFinancialStats {
  totalPurchases: number;
  totalPaid: number;
  totalDebt: number;
  completedPOs: number;
}

interface ProviderFinancialsPanelProps {
  purchaseOrders: ProviderPurchaseOrder[];
  stats: ProviderFinancialStats;
}

function getPurchaseOrderNames(order: ProviderPurchaseOrder) {
  return order.items
    .map((item) => item.productName ?? item.product_name ?? vi.providers.purchaseOrdersPanel.productLabel)
    .filter(Boolean)
    .join(", ");
}

export function ProviderFinancialsPanel({
  purchaseOrders,
  stats,
}: ProviderFinancialsPanelProps) {
  const text = vi.providers.financialsPanel;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
          <h3 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-[var(--fg-base)]">
            <Banknote className="size-5 text-[var(--accent)]" />
            {text.title}
          </h3>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{text.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5">
          <div className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase text-[var(--fg-muted)]">{text.stats.totalPurchases}</p>
            <p className="text-xl font-black text-[var(--fg-base)]">{formatMoney(stats.totalPurchases)}</p>
          </div>
          <div className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase text-[var(--fg-muted)]">{text.stats.totalPaid}</p>
            <p className="text-xl font-black text-emerald-500">{formatMoney(stats.totalPaid)}</p>
          </div>
          <div className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase text-[var(--fg-muted)]">{text.stats.totalDebt}</p>
            <p className="text-xl font-black text-red-500">{formatMoney(stats.totalDebt)}</p>
          </div>
          <div className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
            <p className="mb-1 text-[10px] font-bold uppercase text-[var(--fg-muted)]">{text.stats.completed}</p>
            <p className="text-xl font-black text-[var(--accent)]">
              {stats.completedPOs}/{purchaseOrders.length}
            </p>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{text.recentActivity}</h3>
        </div>
        <div className="space-y-3 p-5">
          {purchaseOrders.slice(0, 6).map((order) => (
            <div
              key={order.id}
              className="flex items-start justify-between gap-4 rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/70 p-4 transition-colors hover:bg-white"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">
                  {getPurchaseOrderNames(order) || text.orderLabel}
                </p>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{formatDateLabel(order.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-black text-[var(--fg-base)]">{formatMoney(order.total_amount)}</p>
                <p className="text-[11px] font-bold text-emerald-500">
                  {text.paymentPrefix}: {formatMoney(order.total_paid)}
                </p>
              </div>
            </div>
          ))}
          {purchaseOrders.length === 0 ? (
            <p className="text-[13px] text-[var(--fg-muted)]">{text.empty}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
