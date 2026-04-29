"use client";

import { useMemo, useState } from "react";
import { Banknote } from "lucide-react";

import { usePurchaseOrderPayment } from "@/widgets/pages/providers/hooks/use-provider-detail";
import { appToast } from "@/shared/ui/app-toast";
import { CreateActionFooter, CreateFlowDialog, CreateFormSection } from "@/shared/ui/create-flow-shell";
import { Input } from "@/shared/ui/input";
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
  const remainingAmount = useMemo(
    () => Math.max(purchaseOrder.total_amount - purchaseOrder.total_paid, 0),
    [purchaseOrder.total_amount, purchaseOrder.total_paid],
  );
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
      appToast.success(result.fully_paid ? text.successFull : text.successPartial(formatMoney(amount)));
      onClose();
    } catch {
      appToast.error(text.errorRecord);
    }
  }

  return (
    <CreateFlowDialog
      isOpen
      onClose={onClose}
      title={text.title}
      description="Ghi nhận thanh toán nhanh, rõ tổng tiền, đã trả và số còn lại trước khi xác nhận."
      size="md"
      footer={
        <CreateActionFooter
          primaryLabel={text.confirm}
          onPrimary={handlePayment}
          onCancel={onClose}
          cancelLabel={text.cancel}
          pending={paymentMutation.isPending}
          disabled={paymentMutation.isPending || isClosedOrder || remainingAmount <= 0}
        />
      }
    >
      <div className="grid gap-5">
        <CreateFormSection title="Tổng quan thanh toán" description="Kiểm tra số dư trước khi ghi nhận để tránh nhập nhầm.">
          <div className="grid gap-3 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-4">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-bold text-[var(--fg-muted)]">{text.totalOrder}</span>
              <span className="font-black text-[var(--fg-base)]">{formatMoney(purchaseOrder.total_amount)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-bold text-[var(--fg-muted)]">{text.paid}</span>
              <span className="font-black text-emerald-500">{formatMoney(purchaseOrder.total_paid)}</span>
            </div>
            <div className="border-t border-[var(--border-soft)] pt-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-bold text-red-500">{text.remaining}</span>
                <span className="font-black text-red-500">{formatMoney(remainingAmount)}</span>
              </div>
            </div>
          </div>
        </CreateFormSection>

        <CreateFormSection title="Số tiền thanh toán" description="Có thể nhập nhanh toàn bộ hoặc một phần rồi xác nhận.">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              <Banknote className="size-3.5 text-emerald-500" />
              {text.amountLabel}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[var(--fg-muted)]">₫</span>
              <Input
                type="number"
                min={1}
                max={remainingAmount}
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="pl-9 !py-3 font-mono text-lg font-bold"
                placeholder="0"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: text.quickFull, value: remainingAmount },
                { label: text.quickHalf, value: remainingAmount / 2 },
              ].map((quickAmount) => (
                <button
                  key={quickAmount.label}
                  type="button"
                  onClick={() => setPaymentAmount(String(Math.round(quickAmount.value)))}
                  className="cursor-pointer rounded-full bg-[var(--accent)]/10 px-3 py-1.5 text-[11px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
                >
                  {quickAmount.label}
                </button>
              ))}
            </div>
          </div>
        </CreateFormSection>
      </div>
    </CreateFlowDialog>
  );
}
