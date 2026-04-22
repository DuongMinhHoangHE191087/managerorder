"use client";

import { useState } from "react";
import { Banknote, CheckCircle2 } from "lucide-react";
import { useOrderPayment } from "@/widgets/pages/customers/hooks/use-customer-detail";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
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
    <Modal
      isOpen
      onClose={onClose}
      title={vi.customers.paymentModal.title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="secondary" onClick={onClose}>
            {vi.customers.paymentModal.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={handlePayment}
            disabled={paymentMutation.isPending}
          >
            <CheckCircle2 className="size-4" />
            {paymentMutation.isPending ? vi.customers.paymentModal.processing : vi.customers.paymentModal.confirm}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="p-4 bg-[var(--surface-light)] rounded-xl">
          <div className="flex justify-between text-[12px] mb-2">
            <span className="text-[var(--fg-muted)] font-bold">{vi.customers.paymentModal.totalOrder}</span>
            <span className="font-black text-[var(--fg-base)]">
              {formatMoney(order.total_amount)}
            </span>
          </div>
          <div className="flex justify-between text-[12px] mb-2">
            <span className="text-[var(--fg-muted)] font-bold">{vi.customers.paymentModal.paid}</span>
            <span className="font-black text-emerald-500">
              {formatMoney(order.total_paid)}
            </span>
          </div>
          <div className="border-t border-[var(--border-soft)] pt-2 mt-2">
            <div className="flex justify-between text-[13px]">
            <span className="text-red-500 font-bold">{vi.customers.paymentModal.remaining}</span>
              <span className="font-black text-red-500">
                {formatMoney(remainingAmount)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">
            <Banknote className="size-3.5 text-emerald-500" />
            {vi.customers.paymentModal.amountLabel}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[var(--fg-muted)]">
              ₫
            </span>
            <Input
              type="number"
              min={1}
              max={remainingAmount}
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              className="pl-8 !py-3 font-mono font-bold text-lg"
              placeholder="0"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {[
              { label: vi.customers.paymentModal.quickFull, value: remainingAmount },
              { label: vi.customers.paymentModal.quickHalf, value: remainingAmount / 2 },
            ].map((quickAmount) => (
              <button
                key={quickAmount.label}
                type="button"
                onClick={() => setPaymentAmount(String(Math.round(quickAmount.value)))}
                className="px-3 py-1 text-[11px] font-bold bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg hover:bg-[var(--accent)]/20 transition-colors cursor-pointer"
              >
                {quickAmount.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
