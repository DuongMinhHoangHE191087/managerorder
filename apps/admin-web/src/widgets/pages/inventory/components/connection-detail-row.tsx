"use client";

import { memo } from "react";
import {
  User, Package, Calendar, Phone, AtSign,
  ExternalLink, Hash,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn, formatDateLabel } from "@/lib/utils";
import type { EnrichedConnection } from "@/lib/domain/types";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  confirmed: { label: "Xác nhận", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  processing: { label: "Đang xử lý", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  completed: { label: "Hoàn tất", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Hủy", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  refunded: { label: "Hoàn tiền", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
};

interface ConnectionDetailRowProps {
  connection: EnrichedConnection;
  productMap?: Map<string, string>;
  className?: string;
}

export const ConnectionDetailRow = memo(function ConnectionDetailRow({
  connection,
  productMap,
  className,
}: ConnectionDetailRowProps) {
  const router = useRouter();
  const statusConfig = STATUS_CONFIG[connection.orderStatus] ?? {
    label: connection.orderStatus,
    color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  const productName = productMap?.get(connection.productId) ?? connection.productNameSnapshot;

  return (
    <div className={cn(
      "group relative rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.96)] p-3.5",
      "shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)] hover:border-[var(--accent)]/30 transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-200",
      className
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/customers/${connection.customerId}`);
            }}
            className="text-[13px] font-bold text-[var(--fg-base)] hover:text-[var(--accent)] truncate transition-colors"
            title={`Xem khách: ${connection.customerName}`}
          >
            {connection.customerName}
          </button>
          {connection.customerNickUsed && (
            <span className="text-[10px] font-bold bg-[var(--accent)]/10 text-[var(--accent)] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 shrink-0">
              <AtSign className="w-2.5 h-2.5" />
              {connection.customerNickUsed}
            </span>
          )}
        </div>

        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
          statusConfig.color
        )}>
          {statusConfig.label}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[var(--fg-muted)] flex-wrap">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/orders/${connection.orderId}`);
          }}
          className="inline-flex items-center gap-1 hover:text-[var(--accent)] transition-colors"
          title="Xem đơn hàng"
        >
          <Hash className="w-3 h-3" />
          <span className="font-mono">{connection.orderId.split("-")[0]}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <span className="inline-flex items-center gap-1">
          <Package className="w-3 h-3" />
          <span className="truncate max-w-[120px]">{productName}</span>
          <span className="font-bold">×{connection.quantity}</span>
        </span>

        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDateLabel(connection.orderCreatedAt)}
        </span>

        {connection.customerContact && (
          <span className="inline-flex items-center gap-1 text-indigo-400/70">
            <Phone className="w-3 h-3" />
            <span className="truncate max-w-[100px]">{connection.customerContact}</span>
          </span>
        )}
      </div>
    </div>
  );
});
