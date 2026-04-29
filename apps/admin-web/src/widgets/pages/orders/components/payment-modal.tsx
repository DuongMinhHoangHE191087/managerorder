"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, TrendingUp, Wallet } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SmartSelector } from "@/shared/ui/smart-selector";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
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
  const initialTerms = normalizePaymentTerms(currentPaymentTerms) || "prepaid";
  const initialPaidValue = Math.max(totalAmountVnd - totalPaid, 0).toString();

  const [paymentTerms, setPaymentTerms] = useState<string>(initialTerms);
  const [sourceId, setSourceId] = useState<string>(currentSourceId || "");
  const [paidInput, setPaidInput] = useState<string>(initialPaidValue);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPaymentTerms(normalizePaymentTerms(currentPaymentTerms) || "prepaid");
    setSourceId(currentSourceId || "");
    setPaidInput(Math.max(totalAmountVnd - totalPaid, 0).toString());
    setNote("");
  }, [currentPaymentTerms, currentSourceId, isOpen, totalAmountVnd, totalPaid]);

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

  const handleSubmit = async () => {
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
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`Ghi nhận thanh toán #${orderId.slice(0, 8)}`}
      description="Luồng thanh toán được gom về một surface rõ ràng: xem số còn lại, chọn nguồn tiền, preview công nợ sau khi ghi nhận và lưu ngay."
      footer={
        <CreateActionFooter
          primaryLabel="Xác nhận thanh toán"
          onPrimary={() => {
            void handleSubmit();
          }}
          onCancel={onClose}
          pending={isPending}
          disabled={Boolean(amountError) || remaining <= 0}
        />
      }
      contentClassName="gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]"
    >
      <CreateFormSection
        title="Thông tin thanh toán"
        description="Điền đúng số tiền thu thêm và nguồn tiền để order, công nợ và báo cáo quỹ đồng bộ ngay sau khi lưu."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              <Wallet className="size-3.5 text-[var(--accent)]" />
              Tổng đơn
            </div>
            <p className="text-lg font-black text-[var(--fg-base)]">{formatMoney(totalAmountVnd)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              <CreditCard className="size-3.5 text-emerald-500" />
              Đã thanh toán
            </div>
            <p className="text-lg font-black text-emerald-600">{formatMoney(totalPaid)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              <Banknote className="size-3.5 text-[var(--danger)]" />
              Còn lại
            </div>
            <p className="text-lg font-black text-[var(--danger)]">{formatMoney(remaining)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
            Số tiền thu thêm
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              required
              value={paidInput}
              onChange={(event) => setPaidInput(event.target.value)}
              error={Boolean(amountError)}
              className="h-12 pr-16 text-base font-black"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              VND
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
          {amountError ? <p className="text-[12px] font-medium text-[var(--danger)]">{amountError}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              Điều khoản thanh toán
            </label>
            <Select value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} className="h-12">
              {PAYMENT_TERM_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              Nguồn tiền
            </label>
            <SmartSelector
              items={sourcesItems}
              value={sourceId}
              onSelect={(item) => setSourceId(item.id)}
              placeholder="Chọn tài khoản thanh toán..."
            />
          </div>
        </div>

        <AdvancedOptionsDisclosure title="Ghi chú giao dịch">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              Nội dung đối soát
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: đợt 2, đối chiếu công nợ, thu tiền mặt..."
              rows={3}
              className="min-h-[104px] w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
            />
          </div>
        </AdvancedOptionsDisclosure>
      </CreateFormSection>

      <CreateFormSection
        title="Preview sau khi ghi nhận"
        description="Các con số dưới đây phản ánh ngay tác động lên công nợ để đội vận hành kiểm tra trước khi lưu."
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              <TrendingUp className="size-3.5 text-[var(--accent)]" />
              Tóm tắt tài chính
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Đã thu</div>
                <p className="mt-1 text-[18px] font-black text-[var(--fg-base)]">{formatMoney(projectedPaid)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Còn lại</div>
                <p className="mt-1 text-[18px] font-black text-[var(--danger)]">{formatMoney(projectedSummary.balance_due_vnd)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Trạng thái</div>
                <p className="mt-1 text-[18px] font-black text-[var(--fg-base)]">
                  {projectedSummary.is_fully_paid ? "Đủ thanh toán" : "Còn công nợ"}
                </p>
                <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                  {PAYMENT_TERM_DISPLAY_LABELS[normalizePaymentTerms(paymentTerms) || "prepaid"]}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CreateFormSection>
    </CreateFlowDialog>
  );
}
