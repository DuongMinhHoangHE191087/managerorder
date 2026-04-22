"use client";

import { memo } from "react";
import { Receipt, TrendingUp, Bolt, AlertTriangle, Lightbulb } from "lucide-react";
import type { ProductService, PaymentSource, SalesChannel, Customer } from "@/lib/domain/types";
import { formatMoney, formatDateShort } from "@/lib/utils";
import { SlideUp, FadeIn } from "@/shared/ui/animations";
import { Button } from "@/shared/ui/button";
import { OrderSuccessBanner } from "./order-success-banner";
import type { OrderSuccessSnapshot } from "@/lib/orders/order-share";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface FormItem {
  productId: string;
  quantity: number;
  costPriceVnd?: number;
  sellPriceVnd?: number;
  notes?: string;
  assignedSourceAccountId?: string;
  customerNickUsed?: string;
}

interface OrderSummaryPanelProps {
  formItems: FormItem[];
  products: ProductService[];
  total: number;
  customerId: string;
  selCustomer?: Customer;
  paymentMethod: string;
  paymentMethodLabel: string;
  selPaySrc?: PaymentSource;
  selChannel?: SalesChannel;
  proofUrlsCount: number;
  registeredAt: string;
  expiresAt: string;
  apiNotice: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  successSnapshot?: OrderSuccessSnapshot | null;
  onClearSuccess?: () => void;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export const OrderSummaryPanel = memo(function OrderSummaryPanel({
  formItems,
  products,
  total,
  customerId,
  selCustomer,
  paymentMethod: _paymentMethod,
  paymentMethodLabel,
  selPaySrc,
  selChannel,
  proofUrlsCount,
  registeredAt,
  expiresAt,
  apiNotice,
  isSubmitting,
  onSubmit,
  successSnapshot,
  onClearSuccess,
}: OrderSummaryPanelProps) {
  return (
    <div className="sticky top-24 space-y-6">
      {successSnapshot ? (
        <OrderSuccessBanner snapshot={successSnapshot} onClear={onClearSuccess} />
      ) : null}

      <SlideUp delay={0.6} className="glass-card rounded-ios shadow-lg border border-[var(--border-soft)] overflow-hidden">
        <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] p-4 text-white">
          <h3 className="font-bold text-[16px] flex items-center gap-2"><Receipt className="size-5" />Tóm tắt đơn hàng</h3>
        </div>
        <div className="p-6 space-y-4 bg-white/50">
          {/* Cart */}
          <div className="space-y-3 border-b border-[var(--border-soft)] pb-4">
            <span className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block">Giỏ hàng</span>
            {formItems.every(i => !i.productId) ? <p className="text-[12px] text-[var(--fg-muted)] italic">Chưa chọn sản phẩm</p>
              : formItems.map((item, i) => { const p = products.find(x => x.id === item.productId); if (!p) return null; const unitSell = item.sellPriceVnd ?? p.sellPriceVnd; return <div key={i} className="flex justify-between items-center text-[13px]"><div><span className="font-bold block truncate max-w-[130px]">{p.name}</span><span className="text-[10px] text-[var(--fg-muted)]">{item.quantity} x {formatMoney(unitSell)} ({p.durationValue} {p.durationType === 'months' ? 'tháng' : p.durationType === 'years' ? 'năm' : 'ngày'})</span></div><span className="font-bold shrink-0 text-[14px]">{formatMoney(unitSell * (item.quantity || 1))}</span></div>; })}
          </div>
          {/* Summary info */}
          {[
            { label: "Khách hàng", value: selCustomer?.name },
            { label: "Phương thức", value: paymentMethodLabel },
            { label: "Nguồn TT", value: selPaySrc ? `${selPaySrc.icon} ${selPaySrc.name}` : undefined },
            { label: "Kênh bán", value: selChannel?.name },
            { label: "Ảnh XM", value: proofUrlsCount > 0 ? `${proofUrlsCount} ảnh` : undefined },
            { label: "Đăng ký", value: registeredAt ? formatDateShort(registeredAt) : "Hôm nay" },
            { label: "Ngày HH", value: expiresAt ? formatDateShort(expiresAt) : "Tự động" },
          ].filter(r => r.value).map(r => (
            <div key={r.label} className="flex justify-between items-center text-[13px] border-b border-[var(--border-soft)] pb-2 last:border-b-0 last:pb-0">
              <span className="text-[var(--fg-muted)] font-medium">{r.label}:</span>
              <span className="font-bold text-right truncate max-w-[150px]">{r.value}</span>
            </div>
          ))}
          {/* Profit estimate */}
          {total > 0 && (() => {
            const totalCost = formItems.reduce((a, item) => {
              const p = products.find(x => x.id === item.productId);
              const cost = item.costPriceVnd ?? p?.buyPriceVnd ?? 0;
              return a + cost * (item.quantity || 1);
            }, 0);
            if (totalCost <= 0) return null;
            const profit = total - totalCost;
            const margin = Math.round(profit / total * 100);
            return (
              <div className="p-3 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="size-3.5 text-[var(--accent)]" />
                  <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-wider">Lợi nhuận ước tính</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-bold text-[var(--fg-base)]">{formatMoney(profit)}</span>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${margin >= 20 ? 'bg-emerald-100 text-emerald-600' : 'bg-[var(--warning)]/10 text-[var(--warning)]'}`}>{margin}% margin</span>
                </div>
              </div>
            );
          })()}
          {/* Total + Submit */}
          <div className="pt-3">
            <div className="flex justify-between items-end mb-5">
              <span className="text-[16px] font-bold">Tổng cộng</span>
              <div className="text-3xl font-black text-[var(--accent)] tracking-tight">{formatMoney(total)}</div>
            </div>
            {/* Checklist readiness */}
            <div className="mb-4 space-y-1.5">
              {[
                { ok: !!customerId, label: "Chọn khách hàng" },
                { ok: formItems.some(i => !!i.productId), label: "Chọn sản phẩm" },
                { ok: true, label: `Thanh toán: ${paymentMethodLabel}` },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-[11px]">
                  <span className={`size-4 rounded-full flex items-center justify-center text-white font-black text-[8px] ${item.ok ? 'bg-emerald-500' : 'bg-[var(--border-soft)]'}`}>{item.ok ? '✓' : '○'}</span>
                  <span className={item.ok ? 'text-[var(--fg-base)] font-medium' : 'text-[var(--fg-muted)]'}>{item.label}</span>
                </div>
              ))}
            </div>
            {apiNotice && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 font-medium flex items-start gap-2"><AlertTriangle className="size-4 shrink-0 mt-0.5" />{apiNotice}</div>}
            <Button onClick={onSubmit} disabled={isSubmitting} isLoading={isSubmitting} variant="primary" className="w-full py-4 h-auto text-[15px] font-black rounded-xl shadow-[0_4px_0_0_#43a002] active:translate-y-1 active:shadow-none">
              XÁC NHẬN TẠO ĐƠN {!isSubmitting && <Bolt className="size-5 ml-2" />}
            </Button>
            <p className="text-center text-[10px] text-[var(--fg-muted)] mt-4 uppercase font-bold tracking-widest">Hệ thống tự động kích hoạt</p>
          </div>
        </div>
      </SlideUp>
      <FadeIn delay={0.6} className="bg-[var(--accent)]/10 rounded-xl p-5 border border-[var(--accent)]/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--accent)]/10 rounded-bl-[100px]" />
        <div className="flex items-start gap-3 relative z-10">
          <Lightbulb className="text-[var(--accent)] size-6 shrink-0" />
          <div>
            <h4 className="font-bold text-[13px] text-[var(--accent)] mb-1">Mẹo nhanh:</h4>
            <ul className="text-[12px] text-[var(--fg-muted)] space-y-1 font-medium">
              <li>• Gõ để tìm khách hàng / sản phẩm (kết quả sau 0.5s)</li>
              <li>• Chọn nguồn TT và kênh bán để theo dõi doanh thu theo kênh</li>
              <li>• Upload ảnh chuyển khoản để xác minh thanh toán</li>
              <li>• Quản lý nguồn TT & kênh bán tại trang <a href="/settings" className="text-[var(--accent)] font-bold underline">Cài đặt</a></li>
            </ul>
          </div>
        </div>
      </FadeIn>
    </div>
  );
});
