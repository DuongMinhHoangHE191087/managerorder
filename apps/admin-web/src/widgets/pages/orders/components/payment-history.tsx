"use client";

import { memo } from "react";
import { usePayments } from "@/widgets/pages/orders/hooks/use-payments";
import type { PaymentRecord } from "@/shared/types/orders";
import { CreditCard, Image as ImageIcon, Loader2, Receipt } from "lucide-react";
import { formatMoney, formatDateLabel } from "@/lib/utils";
import { formatPaymentMethodLabel } from "@/lib/domain/financial";

// ============================================================
// Payment History — displays all individual payments for an order
// ============================================================

type PaymentCardProps = {
  payment: PaymentRecord;
};

const PaymentCard = memo(function PaymentCard({ payment }: PaymentCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-soft)]
                     bg-gradient-to-br from-white to-slate-50
                     hover:shadow-sm transition-shadow">
      {/* Icon */}
      <div className="shrink-0 size-9 rounded-full bg-emerald-100
                      flex items-center justify-center">
        <CreditCard className="size-4 text-emerald-600" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-[var(--fg-base)]">
            +{formatMoney(payment.amount)}
          </span>
          <span className="text-[11px] text-[var(--fg-muted)] shrink-0">
            {formatDateLabel(payment.paid_at)}
          </span>
        </div>

        {/* Method + Note */}
        <div className="flex items-center gap-2 mt-1">
          {payment.payment_method && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5
                             rounded-full bg-blue-50 text-blue-700">
              {formatPaymentMethodLabel(payment.payment_method) || payment.payment_method}
            </span>
          )}
          {payment.note && (
            <span className="text-[11px] text-[var(--fg-muted)] truncate" title={payment.note}>
              {payment.note}
            </span>
          )}
        </div>

        {/* Proof image indicator */}
        {payment.proof_image_url && (
          <a
            href={payment.proof_image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-[var(--accent)]
                       hover:underline"
          >
            <ImageIcon className="size-3" />
            Xem ảnh chứng từ
          </a>
        )}
      </div>
    </div>
  );
});

export function PaymentHistory({ orderId }: { orderId: string }) {
  const { data: payments, isLoading, error } = usePayments(orderId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-[var(--fg-muted)]">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-[12px]">Đang tải...</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center text-[12px] text-red-500 py-4">
        Không thể tải lịch sử thanh toán
      </p>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-[var(--fg-muted)]">
        <Receipt className="size-8 mb-2 opacity-30" />
        <p className="text-[12px]">Chưa có khoản thanh toán nào</p>
      </div>
    );
  }

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="flex items-center justify-between text-[11px] text-[var(--fg-muted)] px-1 mb-2">
        <span>{payments.length} khoản thanh toán</span>
        <span className="font-medium text-emerald-600">
          Tổng: {formatMoney(total)}
        </span>
      </div>

      {/* Payment cards */}
      {payments.map((p) => (
        <PaymentCard key={p.id} payment={p} />
      ))}
    </div>
  );
}
