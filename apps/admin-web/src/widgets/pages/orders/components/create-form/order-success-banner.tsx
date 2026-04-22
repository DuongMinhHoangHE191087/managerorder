"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Copy, FileText, MessageSquare, X } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { formatMoney } from "@/lib/utils";
import {
  buildOrderCustomerSuccessMessage,
  buildOrderInvoiceSummaryMessage,
  type OrderSuccessSnapshot,
} from "@/lib/orders/order-share";

interface OrderSuccessBannerProps {
  snapshot: OrderSuccessSnapshot;
  onClear?: () => void;
}

async function copyToClipboard(text: string, successLabel: string) {
  try {
    await navigator.clipboard.writeText(text);
    appToast.success(successLabel);
  } catch {
    appToast.error("Không thể copy nội dung");
  }
}

export function OrderSuccessBanner({ snapshot, onClear }: OrderSuccessBannerProps) {
  const router = useRouter();
  const customerMessage = buildOrderCustomerSuccessMessage(snapshot);
  const invoiceMessage = buildOrderInvoiceSummaryMessage(snapshot);
  const totalQuantity = snapshot.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section className="overflow-hidden rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-emerald-200/70 px-5 py-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white">
            <CheckCircle2 className="size-3.5" />
            Thành công
          </div>
          <h3 className="mt-3 text-[16px] font-bold text-[var(--fg-base)]">
            Đơn hàng vừa tạo đã sẵn sàng để gửi khách
          </h3>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            Mã đơn #{snapshot.orderCode} • {formatMoney(snapshot.totalVnd)} • {snapshot.paymentMethodLabel}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            className="h-9 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.16em] shadow-none"
            onClick={() => router.push(`/orders/${snapshot.orderId}`)}
          >
            <ArrowRight className="mr-1.5 size-3.5" />
            Xem đơn vừa tạo
          </Button>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--fg-muted)] transition-colors hover:border-emerald-300 hover:text-[var(--fg-base)]"
            >
              <X className="size-3.5" />
              Ẩn
            </button>
          ) : null}
        </div>
      </div>

      {snapshot.warning ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-[12px] font-medium text-amber-700">
          {snapshot.warning}
        </div>
      ) : null}

      <div className="space-y-4 p-5">
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-widest text-[var(--accent)]">
                  <MessageSquare className="size-4" />
                  Tin nhắn gửi khách
                </div>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Nội dung gọn, dễ copy và gửi ngay cho khách hàng.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-9 shrink-0 rounded-xl px-3 text-[12px] font-bold"
                onClick={() => void copyToClipboard(customerMessage, "Đã copy tin nhắn gửi khách")}
              >
                <Copy className="mr-1.5 size-3.5" />
                Copy
              </Button>
            </div>
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3 text-[12px] leading-6 text-[var(--fg-base)]">
              {customerMessage}
            </pre>
          </section>

          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-widest text-[var(--accent-strong)]">
                  <FileText className="size-4" />
                  Tóm tắt hoá đơn
                </div>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Mẫu tóm tắt để lưu nội bộ hoặc gửi khi cần đối soát.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-9 shrink-0 rounded-xl px-3 text-[12px] font-bold"
                onClick={() => void copyToClipboard(invoiceMessage, "Đã copy tóm tắt hoá đơn")}
              >
                <Copy className="mr-1.5 size-3.5" />
                Copy
              </Button>
            </div>
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3 text-[12px] leading-6 text-[var(--fg-base)]">
              {invoiceMessage}
            </pre>
          </section>
        </div>

        <div className="grid gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-[12px] text-[var(--fg-muted)] sm:grid-cols-3">
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-700">Hoá đơn</span>
            <span className="mt-1 block font-mono font-bold text-[var(--fg-base)]">{snapshot.invoiceNumber}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-700">Khách hàng</span>
            <span className="mt-1 block truncate font-bold text-[var(--fg-base)]">{snapshot.customerName ?? "Khách lẻ"}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-700">Tổng số lượng</span>
            <span className="mt-1 block font-bold text-[var(--fg-base)]">{totalQuantity} sản phẩm</span>
          </div>
        </div>
      </div>
    </section>
  );
}
