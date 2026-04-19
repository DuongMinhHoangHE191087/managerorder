"use client";

import React from "react";
import {
  Clock,
  ArrowRight,
  Loader2,
  FileText,
  CircleDot,
  CheckCircle2,
  CreditCard,
  Shield,
  Play,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useOrderStatusHistory } from "@/widgets/pages/orders/hooks/use-order-status-history";
import { formatDateLabel } from "@/lib/utils";

interface OrderStatusTimelineProps {
  orderId: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  draft: {
    label: "Nháp",
    icon: FileText,
    color: "text-slate-400",
    bg: "bg-slate-500/20",
  },
  pending_payment: {
    label: "Chờ TT",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/20",
  },
  paid: {
    label: "Đã TT",
    icon: CreditCard,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
  },
  provisioning: {
    label: "Đang cấp",
    icon: Play,
    color: "text-blue-400",
    bg: "bg-blue-500/20",
  },
  active: {
    label: "Hoạt động",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/20",
  },
  expired: {
    label: "Hết hạn",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/20",
  },
  refunded: {
    label: "Hoàn tiền",
    icon: RotateCcw,
    color: "text-violet-400",
    bg: "bg-violet-500/20",
  },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status] ?? {
      label: status,
      icon: CircleDot,
      color: "text-slate-400",
      bg: "bg-slate-500/20",
    }
  );
}

function formatDateTime(iso: string) {
  return formatDateLabel(iso);
}

/**
 * Visual timeline showing every status transition for an order.
 * Displays: who changed it, when, from what to what, and why (if provided).
 */
export function OrderStatusTimeline({ orderId }: OrderStatusTimelineProps) {
  const { data: history, isLoading, isError, error } = useOrderStatusHistory(orderId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-6">
        <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
        {error instanceof Error ? error.message : "Lỗi tải lịch sử trạng thái"}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-4 text-[var(--fg-muted)] text-xs italic">
        Chưa có thay đổi trạng thái nào được ghi nhận.
      </div>
    );
  }

  return (
    <div className="relative pl-3">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border-soft)]" />

      <div className="space-y-3">
        {history.map((entry, idx) => {
          const newCfg = getStatusConfig(entry.new_status);
          const oldCfg = entry.old_status ? getStatusConfig(entry.old_status) : null;
          const Icon = newCfg.icon;
          const isLatest = idx === history.length - 1;

          return (
            <div key={entry.id} className="relative flex gap-3">
              {/* Dot */}
              <div
                className={`mt-1 flex-none w-4 h-4 rounded-full flex items-center justify-center z-10 -ml-0.5 ring-2 ring-[var(--bg-surface)] ${
                  isLatest ? newCfg.bg + " ring-[var(--accent)]/30" : newCfg.bg
                }`}
              >
                <Icon className={`w-2.5 h-2.5 ${newCfg.color}`} />
              </div>

              {/* Card */}
              <div
                className={`flex-1 p-2.5 rounded-lg border transition-colors ${
                  isLatest
                    ? "bg-[var(--accent)]/5 border-[var(--accent)]/20"
                    : "bg-[var(--surface-light)] border-[var(--border-soft)]/50"
                }`}
              >
                {/* Header: status transition + timestamp */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {oldCfg && (
                      <>
                        <span className={`text-[11px] font-bold ${oldCfg.color}`}>
                          {oldCfg.label}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--fg-muted)]" />
                      </>
                    )}
                    <span className={`text-[11px] font-black ${newCfg.color}`}>
                      {newCfg.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--fg-muted)] whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>

                {/* Who changed + reason */}
                <div className="flex flex-col gap-0.5">
                  {entry.changed_by && (
                    <span className="text-[10px] text-[var(--fg-muted)] flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />
                      {entry.changed_by}
                    </span>
                  )}
                  {entry.change_reason && (
                    <span className="text-[10px] text-[var(--fg-muted)] italic">
                      &quot;{entry.change_reason}&quot;
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
