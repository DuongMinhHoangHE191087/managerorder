"use client";

import { Banknote, CheckCircle2, Clock, CreditCard, ShoppingCart } from "lucide-react";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import type { CustomerOrder } from "@/shared/types/customers";

interface CustomerOrdersPanelProps {
  orders: CustomerOrder[];
  isLoading: boolean;
  onOpenPayment: (order: CustomerOrder) => void;
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
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)] flex items-center gap-2">
            <ShoppingCart className="text-[var(--accent)] size-5" />
            Đơn hàng & Thanh toán
          </h3>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
            Đối soát doanh thu, công nợ và các đơn chưa hoàn tất thanh toán.
          </p>
        </div>
        <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold px-2.5 py-1 rounded-full">
          {orders.length} đơn
        </span>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-4 animate-pulse">
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
          <ShoppingCart className="size-10 text-[var(--fg-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-[13px] text-[var(--fg-muted)]">Chưa có đơn hàng nào</p>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">Tạo đơn mới để bắt đầu ghi nhận thanh toán.</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)]">
          {orders.map((order) => {
            const productNames = order.items
              .map((item) => item.productName ?? item.product_name ?? "Sản phẩm")
              .join(", ");
            const remaining = Math.max(order.total_amount - order.total_paid, 0);
            const paidPercent =
              order.total_amount > 0
                ? Math.min((order.total_paid / order.total_amount) * 100, 100)
                : 0;
            const isDebt =
              remaining > 0 &&
              order.status !== "cancelled" &&
              order.status !== "refunded";

            return (
              <div
                key={order.id}
                className="group p-5 hover:bg-[var(--surface-light)]/55 transition-colors"
              >
                <div className="mb-3 flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-[var(--fg-base)] tracking-tight group-hover:text-[var(--accent)] transition-colors">
                      {productNames || "Đơn hàng"}
                    </p>
                    <p className="text-[11px] text-[var(--fg-muted)] mt-0.5 flex items-center gap-1.5">
                      <Clock className="size-3" />
                      {formatDateLabel(order.created_at)} · #{order.id.slice(0, 8)}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0 ${
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
                    {order.status === "completed" || order.status === "active"
                      ? "Hoàn thành"
                      : order.status === "paid"
                        ? "Đã TT"
                        : order.status === "pending" || order.status === "pending_payment"
                          ? "Chờ xử lý"
                          : order.status === "provisioning"
                            ? "Đang cấp phát"
                            : order.status === "cancelled"
                              ? "Đã hủy"
                              : order.status === "refunded"
                                ? "Hoàn tiền"
                                : order.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                      <span className="text-[var(--fg-muted)]">
                        Thanh toán
                      </span>
                      <span className={paidPercent >= 100 ? "text-emerald-500" : "text-[var(--fg-base)]"}>
                        {formatMoney(order.total_paid)} / {formatMoney(order.total_amount)}
                      </span>
                    </div>
                    <div className="w-full bg-[var(--border-soft)] h-2 rounded-full overflow-hidden">
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
                  {paidPercent >= 100 && (
                    <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                  )}
                </div>

                {isDebt && (
                  <div className="flex items-center justify-between gap-3 p-3 bg-red-50/70 border border-red-200 rounded-[1rem]">
                    <div className="flex items-center gap-2">
                      <Banknote className="size-4 text-red-500" />
                      <span className="text-[12px] font-bold text-red-600">
                        Còn nợ: {formatMoney(remaining)}
                      </span>
                    </div>
                    <button
                      onClick={() => onOpenPayment(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                    >
                      <CreditCard className="size-3.5" />
                      Thanh toán
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
