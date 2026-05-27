"use client";

import { memo } from "react";
import { Clock, User, Phone, Mail, MessageCircle, Globe, Package, Store, Wallet, TrendingUp, CreditCard, DollarSign, RefreshCw, Printer, Trash2, History } from "lucide-react";
import { CreateFlowDialog } from "@/shared/ui/create-flow-shell";
import { ActivityTimeline } from "@/widgets/pages/activity-logs/components/activity-timeline";
import { OrderStatusTimeline } from "@/widgets/pages/orders/components/order-status-timeline";
import { PaymentHistory } from "@/widgets/pages/orders/components/payment-history";
import { formatMoney } from "@/lib/utils";
import { formatPaymentTermsLabel } from "@/lib/domain/financial";
import type { OrderContact, OrderRow } from "./orders-table";
import { getStatusLabel, getStatusStyle } from "@/widgets/pages/orders/lib/status";
import { getOrderNextStatuses } from "@/lib/domain/order-state-machine";
import type { OrderStatus } from "@/lib/domain/types";

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderRow | null;
  onPaymentClick: () => void;
  onRenewClick: () => void;
  onPrintClick: () => void;
  onDeleteClick: () => void;
  onStatusChange: (orderId: string, status: string) => void;
}

type OrderContactRowProps = {
  contact: OrderContact;
};

function getOrderContactIcon(channel: string) {
  switch (channel) {
    case "phone":
      return <Phone className="size-3.5" />;
    case "email":
      return <Mail className="size-3.5" />;
    case "zalo":
    case "telegram":
      return <MessageCircle className="size-3.5" />;
    case "facebook":
      return <Globe className="size-3.5" />;
    default:
      return <User className="size-3.5" />;
  }
}

function getOrderContactLabel(channel: string) {
  switch (channel) {
    case "phone":
      return "SĐT";
    case "email":
      return "Email";
    case "zalo":
      return "Zalo";
    case "facebook":
      return "Facebook";
    case "telegram":
      return "Telegram";
    default:
      return channel;
  }
}

const OrderContactRow = memo(function OrderContactRow({ contact }: OrderContactRowProps) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--surface-light)] border border-[var(--border-soft)]/50 hover:border-[var(--accent)]/30 transition-colors">
      <span className="w-7 h-7 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
        {getOrderContactIcon(contact.channel)}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-bold text-[var(--fg-base)] block truncate">{contact.value}</span>
        <span className="text-[10px] text-[var(--fg-muted)] font-medium">{getOrderContactLabel(contact.channel)}</span>
      </div>
      {contact.is_verified && (
        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">Chính</span>
      )}
    </div>
  );
});

type ProofImageThumbProps = {
  url: string;
  index: number;
};

const ProofImageThumb = memo(function ProofImageThumb({ url, index }: ProofImageThumbProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg overflow-hidden border border-[var(--border-soft)] hover:border-[var(--accent)] transition-colors aspect-square bg-[var(--surface-light)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Proof ${index + 1}`} className="w-full h-full object-cover" />
    </a>
  );
});

export function OrderDetailModal({
  isOpen,
  onClose,
  order,
  onPaymentClick,
  onRenewClick,
  onPrintClick,
  onDeleteClick,
  onStatusChange,
}: OrderDetailModalProps) {
  if (!order) return null;
  const paymentLabel = formatPaymentTermsLabel(order.payment_terms ?? order.payment_method);
  const currentStatus = order.status as OrderStatus;
  const nextStatuses = getOrderNextStatuses(currentStatus);
  const customerContacts = order.customerContacts ?? [];
  const proofImageUrls = order.proof_image_urls ?? [];

  return (
    <CreateFlowDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Chi tiết Đơn hàng: ${order.order_code || order.id.slice(0, 8)}`}
      description={`${order.customerName} • ${order.productName} • Tổng tiền ${formatMoney(order.total_amount_vnd)}`}
      size="2xl"
      footer={
        <div className="flex gap-3 w-full">
          <button
            onClick={onDeleteClick}
            className="flex-[0.4] bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] font-bold py-2.5 rounded-lg hover:bg-[var(--danger)]/20 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="size-4" />
            Xóa đơn hàng
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-white font-bold py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-[background-color,border-color,box-shadow,color,opacity,transform,width]"
          >
            Đóng
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onPaymentClick}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <DollarSign className="size-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ghi TT</span>
          </button>
          <button
            onClick={onRenewClick}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="size-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Gia hạn</span>
          </button>
          <button
            onClick={onPrintClick}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors"
          >
            <Printer className="size-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">In HĐ</span>
          </button>
        </div>

        {/* Customer Info */}
        <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <User className="size-4 text-[var(--accent)]" />
            Thông tin Khách hàng
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[var(--fg-muted)] font-medium">Tên khách hàng:</span>
              <span className="font-bold text-[var(--fg-base)]">{order.customerName}</span>
            </div>

            {/* All contacts */}
            <div>
              <span className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-2">Liên hệ ({customerContacts.length})</span>
              {customerContacts.length === 0 ? (
                <p className="text-[12px] text-[var(--fg-muted)] italic py-2">Chưa có thông tin liên hệ</p>
              ) : (
                <div className="space-y-2">
                  {customerContacts.map((contact, idx) => (
                    <OrderContactRow
                      key={contact.id || `${contact.channel}-${contact.value}-${idx}`}
                      contact={contact}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Contact Snapshot */}
            {order.contact_snapshot && (
              <div className="pt-2 border-t border-[var(--border-soft)]">
                <span className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider block mb-1">Liên hệ lúc đặt hàng</span>
                <p className="text-[13px] font-medium text-[var(--fg-base)] bg-[var(--surface-light)] px-3 py-2 rounded-lg border border-[var(--border-soft)]/50 whitespace-pre-wrap">
                  {order.contact_snapshot}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Product & Price */}
        <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package className="size-4 text-[var(--accent)]" />
            Sản phẩm & Chi phí
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[var(--fg-muted)] font-medium">Sản phẩm:</span>
              <span className="font-bold text-[var(--fg-base)] text-right max-w-[60%] truncate">
                {order.productName}
              </span>
            </div>
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[var(--fg-muted)] font-medium">Số lượng:</span>
              <span className="font-bold text-[var(--fg-base)]">{order.quantity}</span>
            </div>
            {order.unit_price_vnd != null && (
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-[var(--fg-muted)] font-medium">Đơn giá:</span>
                <span className="font-bold text-[var(--fg-base)]">{formatMoney(order.unit_price_vnd)}</span>
              </div>
            )}
            {order.cost_price_vnd != null && order.cost_price_vnd > 0 && (
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-[var(--fg-muted)] font-medium">Giá vốn /sp:</span>
                <span className="font-bold text-orange-500">{formatMoney(order.cost_price_vnd)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Store className="size-4 text-[var(--accent)]" />
            Kênh bán & Nguồn tiền
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[var(--fg-muted)] font-medium">Kênh bán:</span>
              <span className="font-bold text-[var(--fg-base)] text-right max-w-[60%] truncate">
                {order.salesChannelName || "Chưa gán kênh bán"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[var(--fg-muted)] font-medium">Nguồn tiền:</span>
              <span className="font-bold text-[var(--fg-base)] text-right max-w-[60%] truncate">
                {order.paymentSourceName || "Chưa gán nguồn tiền"}
              </span>
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Wallet className="size-4 text-[var(--accent)]" />
            Chi tiết Tài chính
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-[var(--fg-muted)] font-medium">Tổng tiền:</span>
              <span className="font-black text-[var(--accent)] text-[16px]">{formatMoney(order.total_amount_vnd)}</span>
            </div>
            {/* Payment progress bar */}
            {order.total_amount_vnd > 0 && (() => {
              const pct = Math.min((order.total_paid ?? 0) / order.total_amount_vnd * 100, 100);
              const remaining = Math.max(order.total_amount_vnd - (order.total_paid ?? 0), 0);
              return (
                <div className="pt-1">
                  <div className="h-2 bg-[var(--border-soft)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${pct >= 100 ? 'bg-emerald-500' : 'bg-[var(--warning)]'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-[11px] text-[var(--fg-muted)]">Đã TT: <span className={`font-bold ${pct >= 100 ? 'text-emerald-500' : 'text-[var(--warning)]'}`}>{formatMoney(order.total_paid ?? 0)}</span></span>
                    {remaining > 0 && <span className="text-[11px] text-[var(--danger)] font-bold">Còn nợ: {formatMoney(remaining)}</span>}
                  </div>
                </div>
              );
            })()}
            {paymentLabel && (
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-[var(--fg-muted)] font-medium">Điều khoản thanh toán:</span>
                <span className="font-bold text-[var(--fg-base)] flex items-center gap-1.5">
                  <CreditCard className="size-3.5" />
                  {paymentLabel}
                </span>
              </div>
            )}

            {/* Cost & Profit */}
            {order.total_cost_vnd != null && order.total_cost_vnd > 0 && (
              <>
                <div className="border-t border-dashed border-[var(--border-soft)] my-2" />
                <div className="flex justify-between items-center text-[14px]">
                  <span className="text-[var(--fg-muted)] font-medium">Tổng giá vốn:</span>
                  <span className="font-bold text-orange-500">{formatMoney(order.total_cost_vnd)}</span>
                </div>
                <div className="flex justify-between items-center text-[14px]">
                  <span className="text-[var(--fg-muted)] font-medium flex items-center gap-1"><TrendingUp className="size-3.5" /> Lợi nhuận:</span>
                  {(() => {
                    const profit = order.total_amount_vnd - (order.total_cost_vnd ?? 0);
                    return <span className={`font-black text-[16px] ${profit >= 0 ? 'text-emerald-500' : 'text-[var(--danger)]'}`}>{formatMoney(profit)}</span>;
                  })()}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sales Note */}
        {order.sales_note && (
          <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
            <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              📝 Ghi chú đơn hàng
            </h3>
            <p className="text-[13px] text-[var(--fg-base)] font-medium bg-[var(--surface-light)] px-4 py-3 rounded-lg border border-[var(--border-soft)]/50 whitespace-pre-wrap">
              {order.sales_note}
            </p>
          </div>
        )}

        {/* Proof Images */}
        {order.proof_image_urls && order.proof_image_urls.length > 0 && (
          <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
            <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              📸 Ảnh xác minh ({proofImageUrls.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {proofImageUrls.map((url, idx) => (
                <ProofImageThumb key={`${url}-${idx}`} url={url} index={idx} />
              ))}
            </div>
          </div>
        )}

        {/* Status change with state machine enforcement */}
        <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-3">Đổi trạng thái nhanh</h3>
          <div className="mb-3">
            <div className={`px-3 py-2 rounded-lg text-[11px] font-bold text-center ${getStatusStyle(currentStatus)}`}>
              Hiện tại: {getStatusLabel(currentStatus)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {nextStatuses.map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(order.id, s)}
                className="px-3 py-2 rounded-lg text-[11px] font-bold border transition-[background-color,border-color,box-shadow,color,opacity,transform,width] border-[var(--border-soft)] text-[var(--fg-muted)] hover:border-[var(--accent)]/40 bg-white"
              >
                → {getStatusLabel(s)}
              </button>
            ))}
            {nextStatuses.length === 0 && (
              <p className="col-span-2 text-[12px] text-[var(--fg-muted)] italic text-center py-2">Trạng thái cuối — không thể chuyển tiếp.</p>
            )}
          </div>
        </div>
        {/* Order Status Timeline */}
        <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <History className="size-4 text-[var(--accent)]" />
            Timeline trạng thái
          </h3>
          <div className="max-h-[250px] overflow-y-auto custom-scrollbar -mx-1 px-1">
            <OrderStatusTimeline orderId={order.id} />
          </div>
        </div>

        {/* Payment History */}
        <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <CreditCard className="size-4 text-[var(--accent)]" />
            Lịch sử thanh toán
          </h3>
          <div className="max-h-[250px] overflow-y-auto custom-scrollbar -mx-1 px-1">
            <PaymentHistory orderId={order.id} />
          </div>
        </div>

        {/* Activity History Timeline */}
        <div className="glass-card p-5 rounded-xl border border-[var(--border-soft)] bg-white">
          <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="size-4 text-[var(--accent)]" />
            Lịch sử hoạt động
          </h3>
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar -mx-2 px-2">
            <ActivityTimeline orderId={order.id} />
          </div>
        </div>
      </div>
    </CreateFlowDialog>
  );
}
