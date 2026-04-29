"use client";

import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, Wallet } from "lucide-react";
import { useOrderPayment } from "@/widgets/pages/customers/hooks/use-customer-detail";
import { appToast } from "@/shared/ui/app-toast";
import { Input } from "@/shared/ui/input";
import {
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import { formatMoney } from "@/lib/utils";
import type { CustomerOrder } from "@/shared/types/customers";
import { vi } from "@/shared/messages/vi";

interface CustomerOrderPaymentModalProps {
  customerId: string;
  order: CustomerOrder;
  onClose: () => void;
}

export function CustomerOrderPaymentModal({
  customerId,
  order,
  onClose,
}: CustomerOrderPaymentModalProps) {
  const paymentMutation = useOrderPayment(customerId);
  const remainingAmount = Math.max(order.total_amount - order.total_paid, 0);
  const [paymentAmount, setPaymentAmount] = useState(String(remainingAmount));

  useEffect(() => {
    setPaymentAmount(String(remainingAmount));
  }, [remainingAmount, order.id]);

  async function handlePayment() {
    const amount = Number(paymentAmount);
    if (amount <= 0) {
      appToast.error(vi.customers.paymentModal.errorPositive);
      return;
    }

    if (amount > remainingAmount) {
      appToast.error(vi.customers.paymentModal.errorRemaining(formatMoney(remainingAmount)));
      return;
    }

    try {
      const result = await paymentMutation.mutateAsync({
        orderId: order.id,
        amount,
      });
      const payment = result.payment;
      appToast.success(
        payment?.fully_paid
          ? vi.customers.paymentModal.successFull
          : vi.customers.paymentModal.successPartial(formatMoney(amount)),
      );
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : vi.customers.paymentModal.errorRecord;
      console.error("[CustomerOrderPaymentModal]", message);
      appToast.error(message);
    }
  }

  return (
    <CreateFlowDialog
      isOpen
      onClose={onClose}
      size="lg"
      title={vi.customers.paymentModal.title}
      description="Xử lý thanh toán trực tiếp ngay trong hồ sơ khách hàng với phần còn lại, số tiền thu thêm và kết quả công nợ rõ ràng trước khi xác nhận."
      footer={
        <CreateActionFooter
          primaryLabel={vi.customers.paymentModal.confirm}
          onPrimary={() => {
            void handlePayment();
          }}
          onCancel={onClose}
          pending={paymentMutation.isPending}
        />
      }
      contentClassName="gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <CreateFormSection
        title="Khoản thanh toán"
        description="Chỉ giữ các trường cần thiết để thao tác nhanh từ customer detail mà không làm rối màn."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              <Wallet className="size-3.5 text-[var(--accent)]" />
              Tổng đơn
            </div>
            <p className="text-lg font-black text-[var(--fg-base)]">{formatMoney(order.total_amount)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Đã thu
            </div>
            <p className="text-lg font-black text-emerald-600">{formatMoney(order.total_paid)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              <Banknote className="size-3.5 text-[var(--danger)]" />
              Còn lại
            </div>
            <p className="text-lg font-black text-[var(--danger)]">{formatMoney(remainingAmount)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
            <Banknote className="size-3.5 text-emerald-500" />
            {vi.customers.paymentModal.amountLabel}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[var(--fg-muted)]">
              ₫
            </span>
            <Input
              type="number"
              min={1}
              max={remainingAmount}
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              className="h-12 pl-10 text-base font-black"
              placeholder="0"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: vi.customers.paymentModal.quickFull, value: remainingAmount },
              { label: vi.customers.paymentModal.quickHalf, value: remainingAmount / 2 },
            ].map((quickAmount) => (
              <button
                key={quickAmount.label}
                type="button"
                onClick={() => setPaymentAmount(String(Math.round(quickAmount.value)))}
                className="rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/10 px-3 py-1.5 text-[11px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
              >
                {quickAmount.label}
              </button>
            ))}
          </div>
        </div>
      </CreateFormSection>

      <CreateFormSection
        title="Tác động sau khi lưu"
        description="Dùng panel phụ để kiểm tra nhanh tình trạng thanh toán trước khi ghi nhận."
      >
        <div className="grid gap-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Sau lần thu này</div>
            <p className="mt-1 text-lg font-black text-[var(--fg-base)]">
              {formatMoney(Math.min(order.total_paid + Number(paymentAmount || 0), order.total_amount))}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Công nợ còn lại</div>
            <p className="mt-1 text-lg font-black text-[var(--danger)]">
              {formatMoney(Math.max(remainingAmount - Number(paymentAmount || 0), 0))}
            </p>
          </div>
        </div>
      </CreateFormSection>
    </CreateFlowDialog>
  );
}
