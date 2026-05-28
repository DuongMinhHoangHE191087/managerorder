"use client";

import {
  ArrowRightLeft,
  CalendarClock,
  ClipboardList,
  Copy,
  Database,
  ExternalLink,
  User,
  Warehouse,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { calculateAvailableSlots } from "@/lib/domain/premium-account-math";
import { ActionMenu } from "@/shared/ui/action-menu";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/lib/toast";
import { PREMIUM_MIGRATION_COPY as copy } from "../copy";
import {
  formatDateTime,
  getMigrationPhaseLabel,
  getMigrationStatusLabel,
  getTerminalReasonLabel,
} from "../utils";
import type { MigrationListMeta, MigrationListRow } from "../types";

export function MigrationsList({
  migrations,
  activeAccountsCount,
  activeSubscriptionsCount,
  isLoading,
  onOpenDetail,
  pagination,
  onPreviousPage,
  onNextPage,
}: {
  migrations: MigrationListRow[];
  activeAccountsCount: number;
  activeSubscriptionsCount: number;
  isLoading: boolean;
  onOpenDetail: (migrationId: string) => void;
  pagination: MigrationListMeta;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  const router = useRouter();

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[copyMigrationValue]", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  function renderStatusPill(label: string, className = "bg-[var(--surface-light)] text-[var(--fg-muted)] border-[var(--border-soft)]") {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{copy.list.title}</h2>
          <p className="text-[12px] text-[var(--fg-muted)]">
            {copy.list.subtitle(activeAccountsCount, activeSubscriptionsCount)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-1 text-[11px] font-bold text-[var(--fg-base)]">
            {copy.list.totalLabel(pagination.total)}
          </span>
          <Button variant="secondary" disabled={pagination.page <= 1} onClick={onPreviousPage}>
            {copy.list.pagePrevious}
          </Button>
          <Button
            variant="secondary"
            disabled={pagination.page >= Math.max(pagination.totalPages, 1)}
            onClick={onNextPage}
          >
            {copy.list.pageNext}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12">
          <div className="size-9 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
          <p className="text-[13px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            {copy.list.loading}
          </p>
        </div>
      ) : migrations.length === 0 ? (
        <div className="p-12 text-center">
          <Database className="mx-auto mb-3 size-12 text-[var(--fg-muted)] opacity-20" />
          <p className="text-[15px] font-bold text-[var(--fg-base)]">{copy.list.emptyTitle}</p>
          <p className="mt-1 text-[13px] text-[var(--fg-muted)]">{copy.list.emptyDescription}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-4 sm:p-5">
          {migrations.map((migration) => {
            const sourceSlotsRemaining = calculateAvailableSlots(
              migration.source_account?.total_slots ?? 0,
              migration.source_account?.used_slots ?? 0,
            );
            const targetSlotsRemaining = calculateAvailableSlots(
              migration.target_account?.total_slots ?? 0,
              migration.target_account?.used_slots ?? 0,
            );

            return (
              <article
                key={migration.id}
                className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.03)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.07)]"
              >
                {/* Header card: Customer & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-lime-700">
                      <User className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-black text-[var(--fg-base)]">
                        {migration.customer_name}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-[var(--fg-muted)]">
                        <CalendarClock className="size-3.5" />
                        {formatDateTime(migration.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {renderStatusPill(
                      getMigrationStatusLabel(migration),
                      "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20 font-black"
                    )}
                  </div>
                </div>

                {/* Body card: Flow Source -> Target */}
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-3">
                  {/* Source account */}
                  <div className="min-w-0 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nguồn</p>
                    <p className="mt-1 truncate text-[12px] font-extrabold text-[var(--fg-base)]" title={migration.source_account_email ?? "N/A"}>
                      {migration.source_account_email ?? "N/A"}
                    </p>
                    <span className="mt-1 inline-flex rounded-lg bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 border border-slate-200">
                      còn {sourceSlotsRemaining} slot
                    </span>
                  </div>

                  {/* Flow Arrow */}
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-[var(--border-soft)] text-[var(--fg-muted)] group-hover:text-[var(--accent)] transition-colors">
                    <ArrowRightLeft className="size-3.5" />
                  </div>

                  {/* Target account */}
                  <div className="min-w-0 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Đích</p>
                    <p className="mt-1 truncate text-[12px] font-extrabold text-[var(--fg-base)]" title={migration.target_account_email ?? "N/A"}>
                      {migration.target_account_email ?? "N/A"}
                    </p>
                    <span className="mt-1 inline-flex rounded-lg bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100">
                      còn {targetSlotsRemaining} slot
                    </span>
                  </div>
                </div>

                {/* Reason / Notes block */}
                <div className="mt-3.5 rounded-xl border border-[var(--border-soft)] bg-white px-3.5 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Lý do chuyển</p>
                  <p className="mt-1 line-clamp-2 text-[12px] font-medium text-[var(--fg-base)] leading-relaxed">
                    {migration.reason ?? "Không có lý do ghi nhận."}
                  </p>
                  {migration.notes ? (
                    <p className="mt-1.5 line-clamp-1 border-t border-[var(--border-soft)] pt-1.5 text-[11px] text-[var(--fg-muted)] italic">
                      Ghi chú: {migration.notes}
                    </p>
                  ) : null}
                </div>

                {/* Actions footer */}
                <div className="mt-4 flex items-center justify-between border-t border-[var(--border-soft)] pt-3.5">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void onOpenDetail(migration.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold h-8"
                  >
                    <ClipboardList className="size-3.5" />
                    {copy.list.viewDetail}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.push(`/customers/${migration.customer_id}`)}
                      className="inline-flex items-center justify-center size-8 rounded-full p-0"
                      title={copy.list.viewCustomer}
                    >
                      <User className="size-4 text-[var(--fg-muted)]" />
                    </Button>
                    <ActionMenu
                      items={[
                        {
                          label: copy.list.viewCustomer,
                          icon: <User className="size-4" />,
                          onClick: () => router.push(`/customers/${migration.customer_id}`),
                        },
                        ...(migration.source_account?.id
                          ? [
                              {
                                label: copy.list.openSource,
                                icon: <Warehouse className="size-4" />,
                                onClick: () => router.push(`/premium/accounts/${migration.source_account?.id}`),
                              },
                            ]
                          : []),
                        ...(migration.target_account?.id
                          ? [
                              {
                                label: copy.list.openTarget,
                                icon: <ExternalLink className="size-4" />,
                                onClick: () => router.push(`/premium/accounts/${migration.target_account?.id}`),
                              },
                            ]
                          : []),
                        {
                          label: copy.list.copyId,
                          icon: <Copy className="size-4" />,
                          onClick: () => void copyToClipboard(migration.id, copy.list.copyIdSuccess),
                          dividerBefore: true,
                        },
                        {
                          label: copy.list.copySubscription,
                          icon: <Copy className="size-4" />,
                          onClick: () => void copyToClipboard(migration.subscription_id, copy.list.copySubscriptionSuccess),
                        },
                      ]}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
