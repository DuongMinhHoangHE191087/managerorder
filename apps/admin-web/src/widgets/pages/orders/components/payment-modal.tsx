"use client";

import { useState } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { Banknote, CreditCard } from "lucide-react";

import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SmartSelector } from "@/shared/ui/smart-selector";
import { formatMoney } from "@/lib/utils";
import { usePaymentSources } from "@/widgets/pages/settings/hooks/use-settings";
import { useUpdateOrder } from "@/widgets/pages/orders/hooks/use-orders";
import {
  PAYMENT_TERM_DISPLAY_LABELS,
  normalizePaymentTerms,
  toLegacyPaymentMethod,
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
  const { mutateAsync: updateOrder, isPending } = useUpdateOrder();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const paidAmount = Number(paidInput) || 0;
    const newTotalPaid = totalPaid + paidAmount;

    let newStatus: string | undefined;
    if (newTotalPaid >= totalAmountVnd) {
      newStatus = "paid";
    }

    try {
      await updateOrder({
        id: orderId,
        total_paid: newTotalPaid,
        payment_terms: paymentTerms,
        payment_method: toLegacyPaymentMethod(paymentTerms) || undefined,
        payment_source_id: sourceId || undefined,
        sales_note: note || undefined,
        ...(newStatus ? { status: newStatus } : {}),
      });
      appToast.success("Ghi nhận thanh toán thành công");
      onClose();
      onSuccess?.();
    } catch {
      appToast.error("Có lỗi xảy ra khi ghi nhận thanh toán");
    }
  };

  const sourcesItems = paymentSources.map((source) => ({
    id: source.id,
    label: `${source.icon} ${source.name}`,
  }));

  const remaining = Math.max(totalAmountVnd - totalPaid, 0);

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
              className="text-lg font-bold"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] font-medium">VND</div>
          </div>
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
            Ghi chú bộ phận kế toán
          </label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Chuyển khoản / Thu tiền mặt, v.v..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending} disabled={isPending}>
            Xác nhận
          </Button>
        </div>
      </form>
    </Modal>
  );
}
