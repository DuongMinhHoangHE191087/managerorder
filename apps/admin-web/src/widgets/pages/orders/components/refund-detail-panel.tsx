"use client";

import { useState } from "react";
import {
  RotateCcw, Banknote,
  CheckCircle2, Clock, XCircle, ArrowRight,
  Copy, MessageSquare, Loader2, Zap, Ban,
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";

import { useRefunds, useUpdateRefundStatus, useCreateRefund } from "@/widgets/pages/orders/hooks/use-refunds";
import { formatMoney } from "@/lib/utils";
import type { RefundRequest } from "@/shared/types/orders";

/* ─── Status config (simplified 3-step flow) ───────────── */

const StatusConfig: Record<string, { label: string; color: string; icon: typeof Clock; step: number }> = {
  requested:  { label: "Chờ duyệt",     color: "text-amber-500 bg-amber-50",      icon: Clock,        step: 1 },
  approved:   { label: "Đã duyệt",      color: "text-blue-500 bg-blue-50",         icon: CheckCircle2, step: 2 },
  processing: { label: "Đang xử lý",    color: "text-purple-500 bg-purple-50",   icon: Loader2,      step: 2 },
  completed:  { label: "Đã hoàn tiền",  color: "text-emerald-500 bg-emerald-50", icon: CheckCircle2, step: 3 },
  rejected:   { label: "Từ chối",       color: "text-red-500 bg-red-50",            icon: XCircle,      step: 0 },
  cancelled:  { label: "Đã hủy",        color: "text-orange-500 bg-orange-50",    icon: Ban,          step: 0 },
};

// Simplified: each step can go directly to completed
const NEXT_ACTIONS: Record<string, { label: string; next: string; color: string; icon: typeof ArrowRight }[]> = {
  requested: [
    { label: "Đang xử lý", next: "processing", color: "bg-purple-500 hover:bg-purple-600 text-white", icon: ArrowRight },
    { label: "Hoàn tiền ngay", next: "completed", color: "bg-emerald-500 hover:bg-emerald-600 text-white", icon: Zap },
    { label: "Từ chối", next: "rejected", color: "bg-red-100 hover:bg-red-200 text-red-600", icon: XCircle },
    { label: "Huỷ yêu cầu", next: "cancelled", color: "bg-orange-100 hover:bg-orange-200 text-orange-600", icon: Ban },
  ],
  approved: [
    { label: "Đang xử lý", next: "processing", color: "bg-purple-500 hover:bg-purple-600 text-white", icon: ArrowRight },
    { label: "Hoàn tiền ngay", next: "completed", color: "bg-emerald-500 hover:bg-emerald-600 text-white", icon: Zap },
    { label: "Huỷ yêu cầu", next: "cancelled", color: "bg-orange-100 hover:bg-orange-200 text-orange-600", icon: Ban },
  ],
  processing: [
    { label: "Đã hoàn tiền", next: "completed", color: "bg-emerald-500 hover:bg-emerald-600 text-white", icon: CheckCircle2 },
    { label: "Huỷ yêu cầu", next: "cancelled", color: "bg-orange-100 hover:bg-orange-200 text-orange-600", icon: Ban },
  ],
  completed: [
    { label: "Huỷ hoàn tiền (thu lại)", next: "cancelled", color: "bg-orange-500 hover:bg-orange-600 text-white", icon: Ban },
  ],
  rejected: [],
  cancelled: [],
};

/* ─── Timeline steps (simplified) ──────────────────────── */
const TIMELINE_STEPS = [
  { key: "requested", label: "Chờ duyệt" },
  { key: "processing", label: "Đang xử lý" },
  { key: "completed", label: "Đã hoàn tiền" },
];

/* ─── Main Component ──────────────────────────────────── */
interface Props {
  orderId: string;
  orderStatus: string;
  orderTotalPaid?: number;
  productName: string;
  customerName: string;
}

export function RefundDetailPanel({ orderId, orderStatus, orderTotalPaid, productName, customerName }: Props) {
  const { data: refundsData, isLoading } = useRefunds(orderId);
  const { mutateAsync: updateRefundStatus, isPending: isUpdating } = useUpdateRefundStatus();
  const { mutateAsync: createRefund, isPending: isCreating } = useCreateRefund();
  const [adminNote, setAdminNote] = useState("");
  const [customAmount, setCustomAmount] = useState<string>("");

  const refunds = (refundsData as RefundRequest[] | undefined) ?? [];
  const latestRefund = refunds[0];

  if (isLoading) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-soft)] overflow-hidden p-6 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--fg-muted)]" />
      </div>
    );
  }

  // No refunds yet — show create form with adjustable amount
  if (refunds.length === 0) {
    if (orderStatus === "refunded" || orderStatus === "paid" || orderStatus === "active") {
      const defaultAmount = orderTotalPaid ?? 0;
      const refundAmount = customAmount ? Number(customAmount) : defaultAmount;

      return (
        <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-purple-200 overflow-hidden">
          <div className="p-5 border-b border-[var(--border-soft)] bg-purple-50/50">
            <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
              <RotateCcw className="size-5 text-purple-500" /> Tạo hoàn tiền
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {/* Amount display & edit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--fg-muted)] font-bold">Đã thanh toán:</span>
                <span className="font-black text-[var(--fg-base)]">{formatMoney(defaultAmount)}</span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1.5">
                  Số tiền hoàn (điều chỉnh nếu cần)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={customAmount || defaultAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={String(defaultAmount)}
                    className="w-full px-4 py-3 text-[16px] font-black border border-purple-200 rounded-xl bg-purple-50/50 text-purple-600 placeholder:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[var(--fg-muted)]">VNĐ</span>
                </div>
                {refundAmount !== defaultAmount && refundAmount > 0 && (
                  <p className="text-[11px] text-purple-500 mt-1 font-medium">
                    Hoàn {Math.round((refundAmount / defaultAmount) * 100)}% số tiền đã thanh toán
                  </p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1.5">
                  Lý do (tùy chọn)
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Lý do hoàn tiền..."
                  className="w-full px-3 py-2 text-[13px] border border-[var(--border-soft)] rounded-lg bg-[var(--bg-surface)] text-[var(--fg-base)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await createRefund({
                      orderId,
                      refund_mode: "full",
                      reason: adminNote || undefined,
                    });
                    setAdminNote("");
                    setCustomAmount("");
                    appToast.success("Đã tạo yêu cầu hoàn tiền");
                  } catch {
                    appToast.error("Không thể tạo yêu cầu hoàn tiền");
                  }
                }}
                disabled={isCreating}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white text-[13px] font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Tạo yêu cầu hoàn tiền
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Build customer message
  function buildMessage(r: RefundRequest): string {
    const lines = [
      `📋 THÔNG TIN HOÀN TIỀN`,
      `━━━━━━━━━━━━━━━━━━`,
      `👤 Khách hàng: ${customerName}`,
      `📦 Sản phẩm: ${productName}`,
      ``,
      `💰 Số tiền đã thanh toán: ${formatMoney(r.paid_amount_vnd)}`,
      `💸 SỐ TIỀN HOÀN: ${formatMoney(r.refundable_amount_vnd)}`,
      ``,
      r.reason ? `📝 Lý do: ${r.reason}` : "",
      `━━━━━━━━━━━━━━━━━━`,
      `Trạng thái: ${StatusConfig[r.status]?.label ?? r.status}`,
    ].filter(Boolean);
    return lines.join("\n");
  }

  async function handleTransition(refund: RefundRequest, nextStatus: string) {
    try {
      await updateRefundStatus({
        orderId,
        refundId: refund.id,
        status: nextStatus,
        admin_note: adminNote || undefined,
      });
      setAdminNote("");
      appToast.success(`Đã chuyển sang "${StatusConfig[nextStatus]?.label ?? nextStatus}"`);
    } catch {
      appToast.error("Lỗi cập nhật trạng thái hoàn tiền");
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[var(--border-soft)] bg-purple-50/50 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
          <RotateCcw className="size-5 text-purple-500" /> Hoàn tiền
          <span className="text-[11px] font-medium text-[var(--fg-muted)]">({refunds.length} yêu cầu)</span>
        </h3>
        {latestRefund && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(buildMessage(latestRefund));
              appToast.success("Đã copy tin nhắn cho khách!");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <MessageSquare className="size-3.5" /> Copy gửi khách
          </button>
        )}
      </div>

      {/* Latest refund detail */}
      {latestRefund && (
        <div className="p-6 space-y-5">
          {/* Simplified timeline (3 steps) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {TIMELINE_STEPS.map((step, i) => {
              const rStatus = latestRefund.status;
              const rStep = StatusConfig[rStatus]?.step ?? 0;
              const stepNum = i + 1;
              // approved counts as step 1 done
              const isActive = (step.key === "processing" && (rStatus === "processing" || rStatus === "approved"))
                || step.key === rStatus;
              const isPast = rStatus === "rejected" ? false : rStep > stepNum;
              const cfg = StatusConfig[step.key];
              const Icon = cfg?.icon ?? Clock;

              return (
                <div key={step.key} className="flex items-center gap-2 shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${
                    isActive ? (cfg?.color ?? "") + " ring-2 ring-current/20" :
                    isPast ? "text-emerald-500 bg-emerald-50 line-through" :
                    "text-[var(--fg-muted)] bg-[var(--border-soft)]"
                  }`}>
                    <Icon className={`size-3.5 ${step.key === "processing" && isActive ? "animate-spin" : ""}`} />
                    {step.label}
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && <ArrowRight className="size-3 text-[var(--fg-muted)] shrink-0" />}
                </div>
              );
            })}
            {latestRefund.status === "rejected" && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ring-2 ring-red-200 text-red-500 bg-red-50">
                <XCircle className="size-3.5" /> Từ chối
              </div>
            )}
            {latestRefund.status === "cancelled" && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ring-2 ring-orange-200 text-orange-500 bg-orange-50">
                <Ban className="size-3.5" /> Đã hủy
              </div>
            )}
          </div>

          {/* Financial summary — simplified */}
          <div className="grid grid-cols-2 gap-3">
            <div className="px-4 py-3 rounded-xl border bg-[var(--surface-light)] border-[var(--border-soft)]">
              <div className="flex items-center gap-1.5 mb-1">
                <Banknote className="size-3.5 text-[var(--fg-muted)]" />
                <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Đã thanh toán</span>
              </div>
              <p className="text-[15px] font-black text-[var(--fg-base)]">{formatMoney(latestRefund.paid_amount_vnd)}</p>
            </div>
            <div className="px-4 py-3 rounded-xl border bg-purple-50 border-purple-200">
              <div className="flex items-center gap-1.5 mb-1">
                <RotateCcw className="size-3.5 text-purple-500" />
                <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Số tiền hoàn</span>
              </div>
              <p className="text-[15px] font-black text-purple-600">{formatMoney(latestRefund.refundable_amount_vnd)}</p>
              <p className="text-[10px] text-[var(--fg-muted)] mt-0.5">
                {latestRefund.refund_mode === "full" ? "Hoàn toàn bộ" : `Pro-rata (${latestRefund.consumed_days}/${latestRefund.total_days} ngày)`}
              </p>
            </div>
          </div>

          {/* Reason */}
          {latestRefund.reason && (
            <div className="px-4 py-3 bg-[var(--surface-light)] rounded-xl border border-[var(--border-soft)]">
              <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">Lý do</p>
              <p className="text-[13px] text-[var(--fg-base)]">{latestRefund.reason}</p>
            </div>
          )}

          {/* Actions — simplified with "Hoàn tiền ngay" option */}
          {(NEXT_ACTIONS[latestRefund.status] ?? []).length > 0 && (
            <div className="pt-4 border-t border-[var(--border-soft)] space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1.5">Ghi chú (tùy chọn)</label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ghi chú khi chuyển trạng thái..."
                  className="w-full px-3 py-2 text-[13px] border border-[var(--border-soft)] rounded-lg bg-[var(--bg-surface)] text-[var(--fg-base)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(NEXT_ACTIONS[latestRefund.status] ?? []).map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.next}
                      disabled={isUpdating}
                      onClick={() => handleTransition(latestRefund, action.next)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-bold rounded-xl transition-[background-color,border-color,box-shadow,color,opacity,transform,width] shadow-sm disabled:opacity-50 ${action.color}`}
                    >
                      {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Copy full detail */}
          <div className="pt-3 border-t border-[var(--border-soft)]">
            <button
              onClick={() => {
                navigator.clipboard.writeText(buildMessage(latestRefund));
                appToast.success("Đã copy tin nhắn cho khách!");
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-[13px] font-bold rounded-xl transition-[background-color,border-color,box-shadow,color,opacity,transform,width] shadow-sm active:scale-[0.98]"
            >
              <Copy className="size-4" />
              Copy tin nhắn hoàn tiền cho khách
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
