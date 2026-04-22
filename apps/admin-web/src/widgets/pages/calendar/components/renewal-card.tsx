"use client";

import { AlertTriangle, Clock, RefreshCw, User } from "lucide-react";
import { vi } from "@/shared/messages/vi";
import { GlassHoverCard, ScaleButton } from "@/shared/ui/animations";
import type { RenewalItem } from "@/shared/types/premium";
import { formatDateLabel, formatMoney } from "@/lib/utils";

interface RenewalCardProps {
  item: RenewalItem;
  onRequestRenewal?: (id: string) => void;
}

const text = vi.calendar.renewalCard;

function getUrgency(days: number): {
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
} {
  if (days <= 0) {
    return {
      label: text.expired,
      badgeClass: "bg-[var(--danger)]/15 text-[var(--danger)]",
      dotClass: "bg-[var(--danger)] animate-pulse",
      borderClass: "border-l-4 border-l-[var(--danger)]",
    };
  }

  if (days <= 3) {
    return {
      label: `${days}${text.shortDaysSuffix}`,
      badgeClass: "bg-[#ff3b30]/15 text-[#ff3b30]",
      dotClass: "bg-[#ff3b30] animate-pulse",
      borderClass: "border-l-4 border-l-[#ff3b30]",
    };
  }

  if (days <= 7) {
    return {
      label: `${days}${text.shortDaysSuffix}`,
      badgeClass: "bg-[#ff9500]/15 text-[#ff9500]",
      dotClass: "bg-[#ff9500]",
      borderClass: "border-l-4 border-l-[#ff9500]",
    };
  }

  return {
    label: `${days}${text.shortDaysSuffix}`,
    badgeClass: "bg-[var(--accent)]/15 text-[var(--accent)]",
    dotClass: "bg-[var(--accent)]",
    borderClass: "border-l-4 border-l-[var(--accent)]",
  };
}

export function RenewalCard({ item, onRequestRenewal }: RenewalCardProps) {
  const urgency = getUrgency(item.days_remaining);
  const isExpired = item.days_remaining <= 0;
  const alreadyPending = item.renewal_status === "pending" || item.renewal_status === "confirmed";
  const expiryFormatted = formatDateLabel(item.expiry_date);

  return (
    <GlassHoverCard className={`overflow-hidden rounded-xl ${urgency.borderClass}`}>
      <div className="space-y-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className={`size-2 shrink-0 rounded-full ${urgency.dotClass}`} />
            <p className="truncate text-[12px] font-bold leading-snug text-[var(--fg-base)]">
              {item.customer_name ?? item.customer_email ?? "—"}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${urgency.badgeClass}`}>
            {urgency.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <RefreshCw className="size-3 shrink-0 text-[var(--fg-muted)]" />
          <span className="truncate text-[11px] text-[var(--fg-muted)]">
            {[item.service_name, item.package_name].filter(Boolean).join(" · ")}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="size-3 shrink-0 text-[var(--fg-muted)]" />
          <span className="text-[11px] font-medium text-[var(--fg-muted)]">
            {isExpired ? `${text.expired} ` : text.expiryPrefix}
            <span className={`font-bold ${isExpired ? "text-[var(--danger)]" : "text-[var(--fg-base)]"}`}>
              {expiryFormatted}
            </span>
          </span>
        </div>

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
              aria-label={text.requestRenewal}
              className="cursor-pointer rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-black text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
            >
              {text.requestRenewal}
            </ScaleButton>
          )}

          {alreadyPending && (
            <span className="flex items-center gap-1 text-[10px] font-black text-[#ff9500]">
              <AlertTriangle className="size-3" /> {text.pending}
            </span>
          )}
        </div>
      </div>
    </GlassHoverCard>
  );
}

export function RenewalEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[var(--surface-light)]">
        <User className="size-5 text-[var(--fg-muted)] opacity-50" />
      </div>
      <div>
        <p className="text-[12px] font-bold text-[var(--fg-base)]">{text.emptyTitle}</p>
        <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{text.emptyDescription}</p>
      </div>
    </div>
  );
}
