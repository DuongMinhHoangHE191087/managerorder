"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";
import { Input } from "@/shared/ui/input";
import {
  CreateActionFooter,
  CreateFlowDialog,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import { formatDateShort, formatMoney } from "@/lib/utils";

interface RenewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  currentExpiresAt: string | null;
  onSuccess?: () => void;
}

export function RenewOrderModal({
  isOpen,
  onClose,
  orderId,
  currentExpiresAt,
  onSuccess,
}: RenewOrderModalProps) {
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [addAmountVnd, setAddAmountVnd] = useState<string>("0");
  const [addPaidVnd, setAddPaidVnd] = useState<string>("0");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDurationMonths(1);
    setAddAmountVnd("0");
    setAddPaidVnd("0");
    setNote("");
  }, [isOpen, orderId]);

  const { mutateAsync: renewOrder, isPending } = useMutation({
    mutationFn: async (payload: {
      durationMonths: number;
      addAmountVnd: number;
      addPaidVnd: number;
      note?: string;
      proofUrls: string[];
    }) => {
      const response = await fetch(`/api/orders/${orderId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Lỗi gia hạn");
      }
      return response.json();
    },
  });

  const calculateNewDatePreview = () => {
    const baseDate = currentExpiresAt ? new Date(currentExpiresAt) : new Date();
    baseDate.setMonth(baseDate.getMonth() + (Number(durationMonths) || 0));
    return formatDateShort(baseDate);
  };

  const handleUpdate = async () => {
    try {
      if (durationMonths <= 0) {
        appToast.error("Số tháng gia hạn phải lớn hơn 0");
        return;
      }

      const payload = {
        durationMonths: Number(durationMonths),
        addAmountVnd: Number(addAmountVnd) || 0,
        addPaidVnd: Number(addPaidVnd) || 0,
        note: note || undefined,
        proofUrls: [],
      };

      await renewOrder(payload);
      appToast.success("Gia hạn đơn hàng thành công");
      onClose();
      onSuccess?.();
    } catch (error: unknown) {
      appToast.error(
        error instanceof Error ? error.message : "Có lỗi xảy ra khi gia hạn đơn hàng",
      );
    }
  };

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`Gia hạn đơn hàng #${orderId.slice(0, 8)}`}
      description="Flow gia hạn được gom về một modal rõ ràng hơn để sales và kế toán nhìn ngay hạn mới, phí tăng thêm và phần khách đã thanh toán."
      footer={
        <CreateActionFooter
          primaryLabel="Xác nhận gia hạn"
          onPrimary={() => {
            void handleUpdate();
          }}
          onCancel={onClose}
          pending={isPending}
        />
      }
      contentClassName="gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <CreateFormSection
        title="Thông tin gia hạn"
        description="Điền số tháng, phí cộng thêm và khoản khách đã thanh toán trong cùng một surface."
      >
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--fg-muted)]">Hạn hiện tại</span>
            <span className="font-bold">
              {currentExpiresAt ? formatDateShort(currentExpiresAt) : "Khách chưa có hạn"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-sm">
            <span className="text-[var(--fg-muted)]">Hạn mới dự kiến</span>
            <span className="flex items-center gap-1 font-bold text-[var(--warning)]">
              <Calendar className="size-3.5" />
              {calculateNewDatePreview()}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
            Số tháng gia hạn
          </label>
          <div className="relative">
            <Input
              type="number"
              min="1"
              required
              value={durationMonths.toString()}
              onChange={(event) => setDurationMonths(parseInt(event.target.value, 10) || 0)}
              className="h-11 font-bold"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] font-medium">
              Tháng
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              Phí gia hạn
            </label>
            <Input
              type="number"
              min="0"
              required
              value={addAmountVnd}
              onChange={(event) => setAddAmountVnd(event.target.value)}
              className="h-11"
            />
            <p className="text-[11px] text-[var(--fg-muted)]">Khoản này sẽ cộng thêm vào tổng đơn.</p>
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              Khách đã thanh toán
            </label>
            <Input
              type="number"
              min="0"
              required
              value={addPaidVnd}
              onChange={(event) => setAddPaidVnd(event.target.value)}
              className="h-11"
            />
            <p className="text-[11px] text-[var(--fg-muted)]">Ghi nhận ngay phần tiền thu trong lần gia hạn này.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
            Ghi chú bộ phận kế toán / sales
          </label>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ví dụ: khách CK qua Zalo, bù công nợ tháng trước..."
            className="h-11"
          />
        </div>
      </CreateFormSection>

      <CreateFormSection
        title="Preview nhanh"
        description="Giúp đội vận hành nhìn nhanh số tháng tăng thêm và phần tiền vừa ghi nhận trước khi lưu."
      >
        <div className="grid gap-3">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Thời lượng tăng thêm</div>
            <p className="mt-1 text-lg font-black text-[var(--fg-base)]">{durationMonths} tháng</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Doanh thu cộng thêm</div>
            <p className="mt-1 text-lg font-black text-[var(--accent)]">{formatMoney(Number(addAmountVnd) || 0)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Khách đã trả</div>
            <p className="mt-1 text-lg font-black text-emerald-600">{formatMoney(Number(addPaidVnd) || 0)}</p>
          </div>
        </div>
      </CreateFormSection>
    </CreateFlowDialog>
  );
}
