"use client";

import { Package, ShoppingCart, Truck } from "lucide-react";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import type { ProviderPurchaseOrder } from "@/shared/types/providers";

interface ProviderPurchaseOrdersPanelProps {
  purchaseOrders: ProviderPurchaseOrder[];
  isLoading: boolean;
  onPayPurchaseOrder: (order: ProviderPurchaseOrder) => void;
}

const text = vi.providers.purchaseOrdersPanel;

function getPurchaseOrderNames(order: ProviderPurchaseOrder, fallbackLabel: string) {
  return order.items
    .map((item) => item.productName ?? item.product_name ?? fallbackLabel)
    .filter(Boolean)
    .join(", ");
}

export function ProviderPurchaseOrdersPanel({
  purchaseOrders,
  isLoading,
  onPayPurchaseOrder,
}: ProviderPurchaseOrdersPanelProps) {
  return (
    <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-[var(--fg-base)]">
            <ShoppingCart className="size-5 text-[var(--accent)]" />
            {text.title}
          </h3>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{text.description}</p>
        </div>
        <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
          {purchaseOrders.length} {text.countSuffix}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4 p-6 animate-pulse">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.7)] p-4"
            >
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="mt-3 h-2 rounded-full bg-gray-200" />
              <div className="mt-4 h-9 rounded-[0.95rem] bg-gray-200/80" />
            </div>
          ))}
        </div>
      ) : purchaseOrders.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="mx-auto mb-3 size-10 text-[var(--fg-muted)] opacity-30" />
          <p className="text-[13px] text-[var(--fg-muted)]">{text.emptyTitle}</p>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{text.emptyDescription}</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)]">
          {purchaseOrders.map((order) => {
            const remaining = Math.max(order.total_amount - order.total_paid, 0);
            const paidPercent =
              order.total_amount > 0
                ? Math.min((order.total_paid / order.total_amount) * 100, 100)
                : 0;
            const statusLabel =
              text.statusLabels[order.status as keyof typeof text.statusLabels] ??
              (order.status === "cancelled" ? "Đã hủy" : order.status);
            const isClosedOrder =
              order.status === "cancelled" ||
              order.status === "received" ||
              order.status === "completed";

            return (
              <div
                key={order.id}
                className="group p-5 transition-colors hover:bg-[var(--surface-light)]/55"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold tracking-tight text-[var(--fg-base)] group-hover:text-[var(--accent)] transition-colors">
                      {getPurchaseOrderNames(order, text.productLabel) || text.orderLabel}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
                      <Truck className="size-3" />
                      {formatDateLabel(order.created_at)} · #{order.id.slice(0, 8)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      order.status === "cancelled"
                        ? "bg-rose-100 text-rose-600"
                        : order.status === "completed" || order.status === "received"
                        ? "bg-emerald-100 text-emerald-600"
                        : order.status === "partial" || remaining > 0
                          ? "bg-amber-100 text-amber-600"
                          : "bg-[var(--border-soft)] text-[var(--fg-muted)]"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="mb-3 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-[var(--fg-muted)]">{text.paymentLabel}</span>
                      <span className={paidPercent >= 100 ? "text-emerald-500" : "text-[var(--fg-base)]"}>
                        {formatMoney(order.total_paid)} / {formatMoney(order.total_amount)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          paidPercent >= 100
                            ? "bg-emerald-500"
                            : paidPercent > 0
                              ? "bg-amber-500"
                              : "bg-[var(--border-soft)]"
                        }`}
                        style={{ width: `${paidPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-[12px]">
                  <div className="text-[var(--fg-muted)]">
                    {order.items.length} {vi.providers.purchaseOrdersPanel.itemCountSuffix ?? "dòng hàng"}
                  </div>
                  {isClosedOrder ? (
                    <span
                      className={`font-bold ${
                        order.status === "cancelled"
                          ? "text-rose-500"
                          : "text-emerald-500"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  ) : remaining > 0 ? (
                    <button
                      type="button"
                      onClick={() => onPayPurchaseOrder(order)}
                      className="inline-flex items-center gap-1.5 rounded-[0.95rem] bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
                    >
                      {text.payButton(formatMoney(remaining))}
                    </button>
                  ) : (
                    <span className="font-bold text-emerald-500">{text.fullyPaid}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
