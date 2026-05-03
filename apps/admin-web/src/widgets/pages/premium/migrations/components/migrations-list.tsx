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
        <div className="space-y-3 p-4 sm:p-5">
          <div className="hidden grid-cols-12 gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-5 py-4 lg:grid">
            <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{copy.list.columns.customerStatus}</div>
            <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{copy.list.columns.sourceTarget}</div>
            <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{copy.list.columns.reasonNotes}</div>
            <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{copy.list.columns.createdAt}</div>
            <div className="col-span-1 text-right text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{copy.list.columns.actions}</div>
          </div>

          {migrations.map((migration) => (
            <article
              key={migration.id}
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] transition-shadow hover:shadow-sm"
            >
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:items-center lg:px-5 lg:py-4">
                <div className="col-span-1 lg:col-span-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">{copy.list.mobileColumns.customerStatus}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--accent)]">
                      <User className="size-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-[14px] font-extrabold text-[var(--fg-base)]">{migration.customer_name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {renderStatusPill(getMigrationStatusLabel(migration), "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20")}
                        {getMigrationPhaseLabel(typeof migration.details?.phase === "string" ? migration.details.phase : null)
                          ? renderStatusPill(
                              getMigrationPhaseLabel(
                                typeof migration.details?.phase === "string" ? migration.details.phase : null,
                              ) ?? "",
                            )
                          : null}
                        {getTerminalReasonLabel(
                          migration.terminal_reason ??
                            (typeof migration.details?.terminal_reason === "string" ? migration.details.terminal_reason : null),
                        )
                          ? renderStatusPill(
                              getTerminalReasonLabel(
                                migration.terminal_reason ??
                                  (typeof migration.details?.terminal_reason === "string"
                                    ? migration.details.terminal_reason
                                    : null),
                              ) ?? "",
                            )
                          : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 lg:col-span-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">{copy.list.mobileColumns.sourceTarget}</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
                      <Warehouse className="size-4 text-[var(--accent)]" />
                      <span className="truncate">{migration.source_account_email ?? "N/A"}</span>
                    </div>
                    <p className="truncate text-[11px] font-medium text-[var(--fg-muted)]">
                      {migration.source_account?.used_slots ?? 0}/
                      {migration.source_account?.total_slots ?? 0} slot · còn{" "}
                      {calculateAvailableSlots(
                        migration.source_account?.total_slots ?? 0,
                        migration.source_account?.used_slots ?? 0,
                      )} slot
                    </p>
                    <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
                      <ArrowRightLeft className="size-4 text-[var(--fg-muted)]" />
                      <span className="truncate">{migration.target_account_email ?? "N/A"}</span>
                    </div>
                    <p className="truncate text-[11px] font-medium text-[var(--fg-muted)]">
                      {migration.target_account?.used_slots ?? 0}/
                      {migration.target_account?.total_slots ?? 0} slot · còn{" "}
                      {calculateAvailableSlots(
                        migration.target_account?.total_slots ?? 0,
                        migration.target_account?.used_slots ?? 0,
                      )} slot
                    </p>
                  </div>
                </div>

                <div className="col-span-1 lg:col-span-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">{copy.list.mobileColumns.reasonNotes}</p>
                  <p className="line-clamp-2 text-[13px] font-medium text-[var(--fg-base)]">{migration.reason ?? "N/A"}</p>
                  {migration.notes ? (
                    <p className="mt-2 line-clamp-1 text-[12px] text-[var(--fg-muted)]">{migration.notes}</p>
                  ) : null}
                </div>

                <div className="col-span-1 lg:col-span-2">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">{copy.list.mobileColumns.createdAt}</p>
                  <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-base)]">
                    <CalendarClock className="size-4 text-[var(--fg-muted)]" />
                    <span>{formatDateTime(migration.created_at)}</span>
                  </div>
                </div>

                <div className="col-span-1 flex flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void onOpenDetail(migration.id);
                    }}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold"
                  >
                    <ClipboardList className="size-4" />
                    {copy.list.viewDetail}
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
          ))}
        </div>
      )}
    </div>
  );
}
