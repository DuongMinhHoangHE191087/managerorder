"use client";

import React, { useMemo } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ListFilter,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { vi } from "@/shared/messages/vi";
import { appToast } from "@/shared/ui/app-toast";
import { ScaleButton, StaggerContainer, StaggerItem } from "@/shared/ui/animations";
import { RenewalCard, RenewalEmptyState } from "@/widgets/pages/calendar/components/renewal-card";
import type { RenewalItem } from "@/shared/types/premium";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";

const text = vi.calendar.renewalPanel;

const URGENCY_TABS = [
  { key: "all", label: text.tabs.all },
  { key: "expired", label: text.tabs.expired },
  { key: "3d", label: text.tabs.urgent3 },
  { key: "7d", label: text.tabs.urgent7 },
  { key: "30d", label: text.tabs.urgent30 },
] as const;

type UrgencyKey = (typeof URGENCY_TABS)[number]["key"];

interface RenewalPanelProps {
  renewals: RenewalItem[];
  isLoading: boolean;
  error: string | null;
  onRefetch: () => void;
  onRequestRenewal: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  onManualCancel: (id: string) => void;
}

export const RenewalPanel = React.memo(function RenewalPanel({
  renewals,
  isLoading,
  error,
  onRefetch,
  onRequestRenewal,
  onMarkAsPaid,
  onManualCancel,
}: RenewalPanelProps) {
  const [renewalSearch, setRenewalSearch] = React.useState("");
  const [urgencyFilter, setUrgencyFilter] = React.useState<UrgencyKey>("all");

  const stats = useMemo(
    () => ({
      expired: renewals.filter((item) => item.days_remaining <= 0).length,
      urgent: renewals.filter((item) => item.days_remaining > 0 && item.days_remaining <= 3).length,
      soon: renewals.filter((item) => item.days_remaining > 3 && item.days_remaining <= 7).length,
      total: renewals.length,
    }),
    [renewals],
  );

  const filteredRenewals = useMemo(() => {
    let items = renewals;

    if (urgencyFilter === "expired") {
      items = items.filter((item) => item.days_remaining <= 0);
    } else if (urgencyFilter === "3d") {
      items = items.filter((item) => item.days_remaining > 0 && item.days_remaining <= 3);
    } else if (urgencyFilter === "7d") {
      items = items.filter((item) => item.days_remaining > 0 && item.days_remaining <= 7);
    } else if (urgencyFilter === "30d") {
      items = items.filter((item) => item.days_remaining > 0 && item.days_remaining <= 30);
    }

    if (hasSearchTokens(renewalSearch)) {
      items = items.filter(
        (item) =>
          matchesSearchQuery(
            renewalSearch,
            item.customer_name,
            item.customer_email,
            item.service_name,
            item.package_name,
          ),
      );
    }

    return items;
  }, [renewals, urgencyFilter, renewalSearch]);

  return (
    <div
      className="glass-card flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white"
      style={{ minHeight: 320 }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-soft)] bg-[var(--bg-app)]/50 px-4 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-[#ff9500]" />
          <h3 className="text-[13px] font-black text-[var(--fg-base)]">{text.title}</h3>
          {stats.total > 0 && (
            <span className="rounded-full bg-[#ff9500]/15 px-2 py-0.5 text-[10px] font-black text-[#ff9500]">
              {stats.total}
            </span>
          )}
        </div>
        <ScaleButton
          onClick={onRefetch}
          aria-label={text.refresh}
          className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-light)]"
        >
          <RefreshCw className={`size-3.5 text-[var(--fg-muted)] ${isLoading ? "animate-spin" : ""}`} />
        </ScaleButton>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2">
        <button
          type="button"
          onClick={() => appToast.success(text.bulkReminderSuccess(filteredRenewals.length))}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
        >
          <Bell className="size-3" />
          {text.bulkReminder}
        </button>
        <button
          type="button"
          onClick={() => appToast.info(text.exportDemoInfo)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--surface-strong)] px-2 py-1 text-[10px] font-bold text-[var(--fg-base)] transition-colors hover:bg-gray-200"
        >
          {text.exportExcel}
        </button>
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border-soft)] px-3 py-2">
        {URGENCY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setUrgencyFilter(tab.key)}
            className={`cursor-pointer shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
              urgencyFilter === tab.key
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--fg-muted)] hover:bg-[var(--surface-light)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="shrink-0 border-b border-[var(--border-soft)] px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="search"
            value={renewalSearch}
            onChange={(event) => setRenewalSearch(event.target.value)}
            placeholder={text.searchPlaceholder}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)]/50 py-1.5 pl-7 pr-3 text-[11px] outline-none transition-colors focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 px-3 py-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-[92px] rounded-xl bg-[var(--surface-light)] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <AlertTriangle className="size-8 text-[var(--danger)] opacity-60" />
            <p className="text-[12px] font-bold text-[var(--danger)]">{error}</p>
            <button
              type="button"
              onClick={onRefetch}
              className="mt-1 cursor-pointer text-[11px] text-[var(--accent)] hover:underline"
            >
              {text.retry}
            </button>
          </div>
        ) : filteredRenewals.length === 0 ? (
          <RenewalEmptyState />
        ) : (
          <StaggerContainer staggerDelay={0.04} className="space-y-2">
            {filteredRenewals.map((item) => (
              <StaggerItem key={item.id}>
                <div className="group relative">
                  <RenewalCard item={item} onRequestRenewal={onRequestRenewal} />
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onMarkAsPaid(item.id)}
                      title={text.markPaidTitle}
                      className="cursor-pointer rounded-md bg-green-100 p-1.5 text-green-700 hover:bg-green-200"
                    >
                      <CheckCircle2 className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onManualCancel(item.id)}
                      title={text.manualCancelTitle}
                      className="cursor-pointer rounded-md bg-red-100 p-1.5 text-red-700 hover:bg-red-200"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>

      {filteredRenewals.length > 0 && !isLoading && (
        <div className="shrink-0 border-t border-[var(--border-soft)] px-4 py-2">
          <p className="flex items-center gap-1 text-[10px] font-medium text-[var(--fg-muted)]">
            <ListFilter className="size-3" />
            {text.footerPrefix} {filteredRenewals.length} / {renewals.length} {text.footerSuffix}
          </p>
        </div>
      )}
    </div>
  );
});
