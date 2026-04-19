"use client";

import { AlertTriangle, Clock, RefreshCw, User } from "lucide-react";
import { GlassHoverCard } from "@/shared/ui/animations";
import { ScaleButton } from "@/shared/ui/animations";
import type { RenewalItem } from "@/shared/types/premium";
import { formatDateLabel, formatMoney } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface RenewalCardProps {
  item: RenewalItem;
  onRequestRenewal?: (id: string) => void;
}

// ============================================
// URGENCY HELPERS
// ============================================

function getUrgency(days: number): {
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
} {
  if (days <= 0) return {
    label: "Đã hết hạn",
    badgeClass: "bg-[var(--danger)]/15 text-[var(--danger)]",
    dotClass: "bg-[var(--danger)] animate-pulse",
    borderClass: "border-l-4 border-l-[var(--danger)]",
  };
  if (days <= 3) return {
    label: `${days}n`,
    badgeClass: "bg-[#ff3b30]/15 text-[#ff3b30]",
    dotClass: "bg-[#ff3b30] animate-pulse",
    borderClass: "border-l-4 border-l-[#ff3b30]",
  };
  if (days <= 7) return {
    label: `${days}n`,
    badgeClass: "bg-[#ff9500]/15 text-[#ff9500]",
    dotClass: "bg-[#ff9500]",
    borderClass: "border-l-4 border-l-[#ff9500]",
  };
  return {
    label: `${days}n`,
    badgeClass: "bg-[var(--accent)]/15 text-[var(--accent)]",
    dotClass: "bg-[var(--accent)]",
    borderClass: "border-l-4 border-l-[var(--accent)]",
  };
}

// ============================================
// COMPONENT
// ============================================

export function RenewalCard({ item, onRequestRenewal }: RenewalCardProps) {
  const urgency = getUrgency(item.days_remaining);
  const isExpired = item.days_remaining <= 0;
  const alreadyPending = item.renewal_status === "pending" || item.renewal_status === "confirmed";

  const expiryFormatted = formatDateLabel(item.expiry_date);

  return (
    <GlassHoverCard className={`rounded-xl overflow-hidden ${urgency.borderClass}`}>
      <div className="p-3.5 space-y-2.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`size-2 rounded-full shrink-0 ${urgency.dotClass}`} />
            <p className="text-[12px] font-bold text-[var(--fg-base)] truncate leading-snug">
              {item.customer_name ?? item.customer_email ?? "—"}
            </p>
          </div>
          <span className={`shrink-0 text-[10px] font-black rounded-full px-2 py-0.5 uppercase tracking-wider ${urgency.badgeClass}`}>
            {urgency.label}
          </span>
        </div>

        {/* Service + package */}
        <div className="flex items-center gap-1.5">
          <RefreshCw className="size-3 text-[var(--fg-muted)] shrink-0" />
          <span className="text-[11px] text-[var(--fg-muted)] truncate">
            {[item.service_name, item.package_name].filter(Boolean).join(" · ")}
          </span>
        </div>

        {/* Expiry row */}
        <div className="flex items-center gap-1.5">
          <Clock className="size-3 text-[var(--fg-muted)] shrink-0" />
          <span className="text-[11px] text-[var(--fg-muted)] font-medium">
            {isExpired ? "Đã hết hạn " : "Hết hạn: "}
            <span className={`font-bold ${isExpired ? "text-[var(--danger)]" : "text-[var(--fg-base)]"}`}>
              {expiryFormatted}
            </span>
          </span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-0.5">
          {item.final_price != null ? (
            <span className="text-[11px] font-bold text-[var(--fg-muted)]">
              {formatMoney(item.final_price)}
              {item.billing_cycle ? ` / ${item.billing_cycle}` : ""}
            </span>
          ) : (
            <span />
          )}

          {!alreadyPending && onRequestRenewal && (
            <ScaleButton
              onClick={() => onRequestRenewal(item.id)}
              aria-label="Yêu cầu gia hạn"
              className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors cursor-pointer"
            >
              Gia hạn
            </ScaleButton>
          )}

          {alreadyPending && (
            <span className="text-[10px] font-black text-[#ff9500] flex items-center gap-1">
              <AlertTriangle className="size-3" /> Đang chờ
            </span>
          )}
        </div>
      </div>
    </GlassHoverCard>
  );
}

// ============================================
// EMPTY STATE
// ============================================

export function RenewalEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
      <div className="size-12 rounded-full bg-[var(--surface-light)] flex items-center justify-center">
        <User className="size-5 text-[var(--fg-muted)] opacity-50" />
      </div>
      <div>
        <p className="text-[12px] font-bold text-[var(--fg-base)]">Không có gia hạn sắp tới</p>
        <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">Tất cả subscriptions đang ổn định</p>
      </div>
    </div>
  );
}
