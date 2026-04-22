"use client";

import { useState } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { RefreshCw, Calendar } from "lucide-react";

import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { formatDateShort } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";

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

  const { mutateAsync: renewOrder, isPending } = useMutation({
    mutationFn: async (payload: { durationMonths: number; addAmountVnd: number; addPaidVnd: number; note?: string; proofUrls: string[] }) => {
      const res = await fetch(`/api/orders/${orderId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Lỗi gia hạn");
      }
      return res.json();
    }
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
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
        proofUrls: []
      };

      await renewOrder(payload);
      appToast.success("Gia hạn đơn hàng thành công");
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Có lỗi xảy ra khi gia hạn đơn hàng");
    }
  };

  const calculateNewDatePreview = () => {
    const baseDate = currentExpiresAt ? new Date(currentExpiresAt) : new Date();
    baseDate.setMonth(baseDate.getMonth() + (Number(durationMonths) || 0));
    return formatDateShort(baseDate);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Gia hạn đơn hàng: #${orderId.slice(0, 8)}`} size="md">
      <form onSubmit={handleUpdate} className="space-y-4 py-2">
        <div className="bg-[var(--surface-light)] p-4 rounded-xl border border-[var(--border-soft)] mb-4 flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[var(--fg-muted)]">Hạn hiện tại:</span>
            <span className="font-bold">
              {currentExpiresAt ? formatDateShort(currentExpiresAt) : "Khách chưa có hạn"}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2 border-t border-[var(--border-soft)]">
            <span className="text-[var(--fg-muted)]">Hạn mới (Dự kiến):</span>
            <span className="font-bold text-[var(--warning)] flex items-center gap-1">
              <Calendar className="size-3.5" />
              {calculateNewDatePreview()}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">
            Số tháng gia hạn
          </label>
          <div className="relative">
            <Input
              type="number"
              min="1"
              required
              value={durationMonths.toString()}
              onChange={(e) => setDurationMonths(parseInt(e.target.value) || 0)}
              className="font-bold"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] font-medium">Tháng</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">
              Phí gia hạn
            </label>
            <Input
              type="number"
              min="0"
              required
              value={addAmountVnd}
              onChange={(e) => setAddAmountVnd(e.target.value)}
            />
            <p className="text-[10px] text-[var(--fg-muted)] mt-1">Cộng thêm vào tổng đơn</p>
          </div>
          <div>
             <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">
              Khách đã thanh toán
            </label>
            <Input
              type="number"
              min="0"
              required
              value={addPaidVnd}
              onChange={(e) => setAddPaidVnd(e.target.value)}
            />
            <p className="text-[10px] text-[var(--fg-muted)] mt-1">Ghi nhận tiền thanh toán</p>
          </div>
        </div>

        <div>
           <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest">
            Ghi chú bộ phận kế toán / Sale
          </label>
          <Input 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Khách CK qua Zalo..." 
          />
        </div>

        <div className="flex justify-end gap-3 pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending} disabled={isPending}>
            <RefreshCw className="size-4 mr-2" />
            Xác nhận Gia hạn
          </Button>
        </div>
      </form>
    </Modal>
  );
}
