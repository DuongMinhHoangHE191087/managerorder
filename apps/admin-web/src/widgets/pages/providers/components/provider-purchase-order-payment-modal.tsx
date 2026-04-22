"use client";

import { useState } from "react";
import { Banknote, CheckCircle2 } from "lucide-react";
import { usePurchaseOrderPayment } from "@/widgets/pages/providers/hooks/use-provider-detail";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import type { ProviderPurchaseOrder } from "@/shared/types/providers";

interface ProviderPurchaseOrderPaymentModalProps {
  providerId: string;
  purchaseOrder: ProviderPurchaseOrder;
  onClose: () => void;
}

export function ProviderPurchaseOrderPaymentModal({
  providerId,
  purchaseOrder,
  onClose,
}: ProviderPurchaseOrderPaymentModalProps) {
  const text = vi.providers.paymentModal;
  const paymentMutation = usePurchaseOrderPayment(providerId);
  const remainingAmount = Math.max(purchaseOrder.total_amount - purchaseOrder.total_paid, 0);
  const isClosedOrder =
    purchaseOrder.status === "cancelled" ||
    purchaseOrder.status === "received" ||
    purchaseOrder.status === "completed";
  const [paymentAmount, setPaymentAmount] = useState(String(remainingAmount));

  async function handlePayment() {
    const amount = Number(paymentAmount);
    if (amount <= 0) {
      appToast.error(text.errorPositive);
      return;
    }

    if (amount > remainingAmount) {
      appToast.error(text.errorRemaining(formatMoney(remainingAmount)));
      return;
    }

    try {
      const result = await paymentMutation.mutateAsync({
        purchaseOrderId: purchaseOrder.id,
        amount,
      });
      appToast.success(
        result.fully_paid
          ? text.successFull
          : text.successPartial(formatMoney(amount)),
      );
      onClose();
    } catch {
      appToast.error(text.errorRecord);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={text.title}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {text.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={handlePayment}
            disabled={paymentMutation.isPending || isClosedOrder}
          >
            <CheckCircle2 className="size-4" />
            {paymentMutation.isPending ? text.processing : text.confirm}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-[var(--surface-light)] p-4">
          <div className="mb-2 flex justify-between text-[12px]">
            <span className="font-bold text-[var(--fg-muted)]">{text.totalOrder}</span>
            <span className="font-black text-[var(--fg-base)]">
              {formatMoney(purchaseOrder.total_amount)}
            </span>
          </div>
          <div className="mb-2 flex justify-between text-[12px]">
            <span className="font-bold text-[var(--fg-muted)]">{text.paid}</span>
            <span className="font-black text-emerald-500">
              {formatMoney(purchaseOrder.total_paid)}
            </span>
          </div>
          <div className="mt-2 border-t border-[var(--border-soft)] pt-2">
            <div className="flex justify-between text-[13px]">
              <span className="font-bold text-red-500">{text.remaining}</span>
              <span className="font-black text-red-500">
                {formatMoney(remainingAmount)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            <Banknote className="size-3.5 text-emerald-500" />
            {text.amountLabel}
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
              className="pl-8 !py-3 font-mono text-lg font-bold"
              placeholder="0"
            />
          </div>
          <div className="mt-2 flex gap-2">
            {[
              { label: text.quickFull, value: remainingAmount },
              { label: text.quickHalf, value: remainingAmount / 2 },
            ].map((quickAmount) => (
              <button
                key={quickAmount.label}
                type="button"
                onClick={() => setPaymentAmount(String(Math.round(quickAmount.value)))}
                className="cursor-pointer rounded-lg bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
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
