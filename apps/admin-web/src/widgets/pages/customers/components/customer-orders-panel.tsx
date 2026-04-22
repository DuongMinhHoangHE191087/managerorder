"use client";

import { Banknote, CheckCircle2, Clock, CreditCard, ShoppingCart } from "lucide-react";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import type { CustomerOrder } from "@/shared/types/customers";

interface CustomerOrdersPanelProps {
  orders: CustomerOrder[];
  isLoading: boolean;
  onOpenPayment: (order: CustomerOrder) => void;
}

const text = vi.customers.detail.ordersPanel;

function getOrderProductNames(order: CustomerOrder) {
  return order.items
    .map((item) => item.productName ?? item.product_name ?? text.productLabel)
    .join(", ");
}

export function CustomerOrdersPanel({
  orders,
  isLoading,
  onOpenPayment,
}: CustomerOrdersPanelProps) {
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
          {orders.length} {text.countSuffix}
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
              <div className="mt-4 h-10 rounded-[0.95rem] bg-gray-200/80" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center">
          <ShoppingCart className="mx-auto mb-3 size-10 text-[var(--fg-muted)] opacity-30" />
          <p className="text-[13px] text-[var(--fg-muted)]">{text.emptyTitle}</p>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{text.emptyDescription}</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)]">
          {orders.map((order) => {
            const productNames = getOrderProductNames(order);
            const remaining = Math.max(order.total_amount - order.total_paid, 0);
            const paidPercent =
              order.total_amount > 0
                ? Math.min((order.total_paid / order.total_amount) * 100, 100)
                : 0;
            const isDebt =
              remaining > 0 &&
              order.status !== "cancelled" &&
              order.status !== "refunded";
            const statusLabel =
              text.statusLabels[order.status as keyof typeof text.statusLabels] ?? order.status;

            return (
              <div
                key={order.id}
                className="group p-5 transition-colors hover:bg-[var(--surface-light)]/55"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold tracking-tight text-[var(--fg-base)] group-hover:text-[var(--accent)] transition-colors">
                      {productNames || text.orderLabel}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
                      <Clock className="size-3" />
                      {formatDateLabel(order.created_at)} · #{order.id.slice(0, 8)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      order.status === "completed" ||
                      order.status === "active" ||
                      order.status === "paid"
                        ? "bg-emerald-100 text-emerald-600"
                        : order.status === "pending" ||
                            order.status === "pending_payment" ||
                            order.status === "provisioning"
                          ? "bg-amber-100 text-amber-600"
                          : order.status === "cancelled" || order.status === "refunded"
                            ? "bg-red-100 text-red-500"
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
                  {paidPercent >= 100 && <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />}
                </div>

                {isDebt && (
                  <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-red-200 bg-red-50/70 p-3">
                    <div className="flex items-center gap-2">
                      <Banknote className="size-4 text-red-500" />
                      <span className="text-[12px] font-bold text-red-600">
                        Còn nợ: {formatMoney(remaining)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenPayment(order)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
                    >
                      <CreditCard className="size-3.5" />
                      {text.paymentLabel}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
