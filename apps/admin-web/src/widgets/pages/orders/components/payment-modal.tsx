"use client";

import { useMemo, useState } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { Banknote, CreditCard, TrendingUp, Wallet } from "lucide-react";

import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SmartSelector } from "@/shared/ui/smart-selector";
import { formatMoney } from "@/lib/utils";
import { usePaymentSources } from "@/widgets/pages/settings/hooks/use-settings";
import { useRecordOrderPayment } from "@/widgets/pages/orders/hooks/use-orders";
import {
  buildFinancialSummary,
  PAYMENT_TERM_DISPLAY_LABELS,
  normalizePaymentTerms,
} from "@/lib/domain/financial";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  totalAmountVnd: number;
  totalPaid: number;
  currentPaymentTerms?: string | null;
  currentSourceId?: string | null;
  onSuccess?: () => void;
}

const PAYMENT_TERM_OPTIONS = [
  { key: "prepaid", label: PAYMENT_TERM_DISPLAY_LABELS.prepaid, icon: CreditCard },
  { key: "credit", label: PAYMENT_TERM_DISPLAY_LABELS.credit, icon: Banknote },
  { key: "cod", label: PAYMENT_TERM_DISPLAY_LABELS.cod, icon: Banknote },
] as const;

export function PaymentModal({
  isOpen,
  onClose,
  orderId,
  totalAmountVnd,
  totalPaid,
  currentPaymentTerms,
  currentSourceId,
  onSuccess,
}: PaymentModalProps) {
  const [paymentTerms, setPaymentTerms] = useState<string>(normalizePaymentTerms(currentPaymentTerms) || "prepaid");
  const [sourceId, setSourceId] = useState<string>(currentSourceId || "");
  const [paidInput, setPaidInput] = useState<string>(
    (totalAmountVnd - totalPaid > 0 ? totalAmountVnd - totalPaid : 0).toString()
  );
  const [note, setNote] = useState<string>("");

  const { data: paymentSources = [] } = usePaymentSources();
  const { mutateAsync: recordPayment, isPending } = useRecordOrderPayment();
  const remaining = Math.max(totalAmountVnd - totalPaid, 0);
  const parsedAmount = Number(paidInput);
  const amountToRecord = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const projectedPaid = totalPaid + Math.max(amountToRecord, 0);
  const projectedSummary = useMemo(
    () =>
      buildFinancialSummary({
        total_amount_vnd: totalAmountVnd,
        total_paid: projectedPaid,
        payment_terms: paymentTerms,
      }),
    [paymentTerms, projectedPaid, totalAmountVnd],
  );
  const amountError = useMemo(() => {
    if (paidInput.trim().length === 0) {
      return "Nhập số tiền cần ghi nhận";
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return "Số tiền thanh toán phải lớn hơn 0";
    }

    if (parsedAmount > remaining) {
      return `Số tiền vượt quá phần còn lại (${formatMoney(remaining)})`;
    }

    return null;
  }, [paidInput, parsedAmount, remaining]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountError) {
      appToast.error(amountError);
      return;
    }

    try {
      const result = await recordPayment({
        orderId,
        amount: amountToRecord,
        payment_terms: paymentTerms,
        payment_source_id: sourceId || undefined,
        note: note.trim() || undefined,
      });

      appToast.success(
        result.payment.fully_paid
          ? "Đã ghi nhận thanh toán đủ và khóa công nợ"
          : `Đã ghi nhận thêm ${formatMoney(amountToRecord)}`,
      );
      onClose();
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Có lỗi xảy ra khi ghi nhận thanh toán";
      appToast.error(message);
    }
  };

  const sourcesItems = paymentSources.map((source) => ({
    id: source.id,
    label: `${source.icon} ${source.name}`,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ghi nhận thanh toán: ${orderId}`} size="md">
      <form onSubmit={handleUpdate} className="space-y-5 py-2">
        <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-soft)] flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--fg-muted)]">Tổng đơn:</span>
            <span className="font-bold">{formatMoney(totalAmountVnd)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--fg-muted)]">Đã trả:</span>
            <span className="font-bold text-[var(--accent)]">{formatMoney(totalPaid)}</span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between items-center text-sm pt-2 border-t border-[var(--border-soft)]">
              <span className="text-[var(--fg-muted)]">Còn lại:</span>
              <span className="font-bold text-[var(--danger)]">{formatMoney(remaining)}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">
            Thu thêm
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              required
              value={paidInput}
              onChange={(e) => setPaidInput(e.target.value)}
              error={Boolean(amountError)}
              className="text-lg font-bold"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] font-medium">VND</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: "25%", value: remaining * 0.25 },
              { label: "50%", value: remaining * 0.5 },
              { label: "Toàn bộ", value: remaining },
            ].map((quickAmount) => (
              <button
                key={quickAmount.label}
                type="button"
                disabled={remaining <= 0}
                onClick={() => setPaidInput(String(Math.round(quickAmount.value)))}
                className="rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/5 px-3 py-1.5 text-[11px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {quickAmount.label}
              </button>
            ))}
          </div>
          {amountError ? (
            <p className="mt-2 text-[12px] font-medium text-[var(--danger)]">{amountError}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">
              Điều khoản thanh toán
            </label>
            <Select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            >
              {PAYMENT_TERM_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">
              Nguồn tiền
            </label>
            <SmartSelector
              items={sourcesItems}
              value={sourceId}
              onSelect={(item) => setSourceId(item.id)}
              placeholder="Chọn tài khoản..."
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">
            Ghi chú giao dịch
          </label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: dot 2, doi chieu cong no, thu tien mat..."
          />
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            <TrendingUp className="size-3.5 text-[var(--accent)]" />
            Preview sau khi ghi nhận
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-soft)] bg-white px-3 py-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                <Wallet className="size-3.5 text-emerald-500" />
                Đã thu
              </div>
              <p className="text-[16px] font-black text-[var(--fg-base)]">{formatMoney(projectedPaid)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-soft)] bg-white px-3 py-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                <Banknote className="size-3.5 text-[var(--danger)]" />
                Còn lại
              </div>
              <p className="text-[16px] font-black text-[var(--danger)]">{formatMoney(projectedSummary.balance_due_vnd)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-soft)] bg-white px-3 py-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                <CreditCard className="size-3.5 text-[var(--accent)]" />
                Trạng thái
              </div>
              <p className="text-[16px] font-black text-[var(--fg-base)]">
                {projectedSummary.is_fully_paid ? "Đủ thanh toán" : "Còn công nợ"}
              </p>
              <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                {PAYMENT_TERM_DISPLAY_LABELS[normalizePaymentTerms(paymentTerms) || "prepaid"]}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending} disabled={isPending || Boolean(amountError) || remaining <= 0}>
            Xác nhận
          </Button>
        </div>
      </form>
    </Modal>
  );
}
