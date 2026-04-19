"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, ChevronsUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Server, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { SlideUp } from "@/shared/ui/animations";
import { cn, formatDateLabel } from "@/lib/utils";
import type { Provider, SourceAccount } from "@/lib/domain/types";

type SortField = "email" | "slots" | "expiry" | "status";
type SortDir = "asc" | "desc";

interface InventoryTableProps {
  filteredAccounts: SourceAccount[];
  providers: Provider[];
  productMap: Map<string, string>;
  onRowContextMenu: (e: React.MouseEvent, account: SourceAccount) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (visibleIds: string[]) => void;
}

const PAGE_SIZE = 10;

function getExpiryWarning(expiresAt: string): { level: "danger" | "warning" | "ok"; daysLeft: number } {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) return { level: "danger", daysLeft: 0 };
  if (daysLeft <= 7) return { level: "danger", daysLeft };
  if (daysLeft <= 30) return { level: "warning", daysLeft };
  return { level: "ok", daysLeft };
}

function getSlotBarColor(percent: number): string {
  if (percent >= 100) return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
  if (percent >= 90) return "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]";
  if (percent >= 70) return "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.4)]";
  return "bg-[var(--accent)] shadow-[0_0_8px_rgba(var(--accent-rgb),0.4)]";
}

function SortIcon({
  field,
  currentField,
  currentDir,
}: {
  field: SortField;
  currentField: SortField | null;
  currentDir: SortDir;
}) {
  if (currentField !== field) return <ChevronsUpDown className="size-3 text-[var(--fg-muted)] opacity-40" />;
  return currentDir === "asc" ? <ChevronUp className="size-3 text-[var(--accent)]" /> : <ChevronDown className="size-3 text-[var(--accent)]" />;
}

function sortAccounts(accounts: SourceAccount[], field: SortField | null, dir: SortDir): SourceAccount[] {
  if (!field) return accounts;

  const sorted = [...accounts].sort((a, b) => {
    switch (field) {
      case "email":
        return a.email.localeCompare(b.email);
      case "slots": {
        const pA = a.maxSlots > 0 ? a.usedSlots / a.maxSlots : 0;
        const pB = b.maxSlots > 0 ? b.usedSlots / b.maxSlots : 0;
        return pA - pB;
      }
      case "expiry":
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      case "status": {
        const statusScore = (acc: SourceAccount) => {
          const exp = getExpiryWarning(acc.expiresAt);
          if (exp.daysLeft === 0) return 0;
          if (acc.usedSlots >= acc.maxSlots) return 1;
          return 2;
        };

        return statusScore(a) - statusScore(b);
      }
      default:
        return 0;
    }
  });

  return dir === "desc" ? sorted.reverse() : sorted;
}

const SortableHeader = ({
  field,
  label,
  icon,
  className,
  currentField,
  currentDir,
  onSort,
}: {
  field: SortField;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  currentField: SortField | null;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) => (
  <button
    type="button"
    className={cn(
      "group flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] transition-colors hover:text-[var(--accent)]",
      className,
    )}
    onClick={() => onSort(field)}
  >
    {icon}
    <span>{label}</span>
    <SortIcon field={field} currentField={currentField} currentDir={currentDir} />
  </button>
);

export const InventoryTable = React.memo(function InventoryTable({
  filteredAccounts,
  providers,
  productMap,
  onRowContextMenu,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: InventoryTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const hasBulk = Boolean(selectedIds && onToggleSelect && onToggleSelectAll);

  const sortedAccounts = useMemo(
    () => sortAccounts(filteredAccounts, sortField, sortDir),
    [filteredAccounts, sortField, sortDir],
  );

  const totalPages = Math.max(1, Math.ceil(sortedAccounts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAccounts = sortedAccounts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const allSelected = hasBulk && paginatedAccounts.length > 0 && paginatedAccounts.every((account) => selectedIds!.has(account.id));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const handleToggleAll = () => {
    if (!onToggleSelectAll) return;
    onToggleSelectAll(paginatedAccounts.map((account) => account.id));
  };

  return (
    <SlideUp delay={0.5} className="app-card mb-6 overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {hasBulk ? (
            <label className="flex items-center gap-3 rounded-[0.9rem] border border-[var(--border-soft)] bg-white/80 px-3 py-2 shadow-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleAll}
                className="size-4 rounded border-[var(--border-soft)] text-[var(--accent)] accent-[var(--accent)]"
              />
              <span className="text-[13px] font-bold text-[var(--fg-base)]">Chon tat ca</span>
            </label>
          ) : (
            <div className="flex size-11 items-center justify-center rounded-[1rem] bg-[var(--accent)]/10 text-[var(--accent)]">
              <Server className="size-5" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">Tai khoan nguon (Pool)</h3>
            <p className="text-[12px] text-[var(--fg-muted)]">Quan ly account nguon, slot va han dung trong mot man hinh.</p>
          </div>
        </div>
        <span className="whitespace-nowrap text-[12px] font-medium text-[var(--fg-muted)]">
          Tong cong <strong className="text-[var(--accent)]">{filteredAccounts.length}</strong> tai khoan
        </span>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        {filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.82)] p-12 text-center">
            <Server className="mb-3 size-12 text-[var(--fg-muted)] opacity-50" />
            <h3 className="text-[15px] font-bold text-[var(--fg-base)]">Khong co account nguon nao</h3>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Chua co du lieu account.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                "hidden items-center gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.8)] px-4 py-3 lg:grid",
                hasBulk ? "grid-cols-[48px_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_140px_140px_100px]" : "grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_140px_140px_100px]",
              )}
            >
              {hasBulk && <div />}
              <SortableHeader field="email" label="Tai khoan" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nha cung cap</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">San pham</div>
              <SortableHeader field="slots" label="Slot" icon={<Users className="size-3" />} currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader field="expiry" label="Het han" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader field="status" label="Trang thai" className="justify-center" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
            </div>

            <div className="flex flex-col divide-y divide-[var(--border-soft)] rounded-[1.5rem] border border-[var(--border-soft)] bg-white">
              {paginatedAccounts.map((account) => {
                const percent = account.maxSlots > 0 ? (account.usedSlots / account.maxSlots) * 100 : 0;
                const freeSlots = account.maxSlots - account.usedSlots;
                const productNames = account.productIds.map((pid) => productMap.get(pid)).filter(Boolean).join(", ");
                const expiryInfo = getExpiryWarning(account.expiresAt);
                const isSelected = hasBulk && selectedIds!.has(account.id);

                return (
                  <article
                    key={account.id}
                    onContextMenu={(e) => onRowContextMenu(e, account)}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).tagName === "INPUT") return;
                      router.push(`/inventory/source-accounts/${account.id}`);
                    }}
                    className={cn(
                      "group relative flex cursor-pointer flex-col gap-4 px-4 py-4 transition-all hover:bg-[var(--surface-light)]/40 lg:grid lg:items-center lg:gap-4 lg:pr-12",
                      hasBulk ? "lg:grid-cols-[48px_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_140px_140px_100px]" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_140px_140px_100px]",
                      isSelected && "bg-[var(--accent)]/5",
                    )}
                  >
                    {hasBulk && (
                      <div className="absolute left-4 top-4 z-10 flex justify-center lg:relative lg:left-auto lg:top-auto" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(account.id)}
                          className="size-4 rounded border-[var(--border-soft)] text-[var(--accent)] accent-[var(--accent)] shadow-sm"
                        />
                      </div>
                    )}

                    <div className="flex min-w-0 items-center gap-3 pl-8 pr-8 lg:pl-0 lg:pr-0">
                      <div className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-white text-[var(--fg-muted)] shadow-sm transition-all group-hover:border-[var(--accent)]/30 group-hover:text-[var(--accent)]",
                        isSelected && "border-[var(--accent)] text-[var(--accent)]",
                      )}>
                        <Server className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-[14px] font-bold tracking-tight text-[var(--fg-base)] transition-colors group-hover:text-[var(--accent)]">
                          {account.email}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[var(--fg-muted)] lg:hidden">
                          {providers.find((p) => p.id === account.provider)?.name || account.provider}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 pl-8 lg:pl-0">
                      <span className="lg:hidden mb-1 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Nha CC</span>
                      <div className="flex w-fit items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[rgba(246,250,244,0.72)] px-2.5 py-1 text-[13px] font-medium text-[var(--fg-muted)] lg:w-full lg:border-transparent lg:bg-transparent lg:px-0 lg:py-0">
                        <Server className="size-3.5 shrink-0" />
                        <span className="truncate">{providers.find((p) => p.id === account.provider)?.name || account.provider}</span>
                      </div>
                    </div>

                    <div className="min-w-0 pl-8 lg:pl-0">
                      <span className="lg:hidden mb-1 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">San pham</span>
                      <span className="inline-flex max-w-full items-center truncate rounded-full border border-[var(--border-soft)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--fg-base)] shadow-sm transition-colors group-hover:border-[var(--accent)]/30">
                        {productNames || "N/A"}
                      </span>
                    </div>

                    <div className="pl-8 lg:pl-0">
                      <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.72)] p-3 transition-colors group-hover:bg-white lg:border-transparent lg:bg-transparent lg:p-0">
                        <div className="flex items-center justify-between text-[11px] font-bold tracking-wide">
                          <span className="text-[var(--fg-muted)] lg:hidden">SLOTS</span>
                          <span className={cn("text-[12px]", percent >= 100 ? "font-bold text-red-500" : "font-bold text-[var(--fg-base)]")}>
                            {account.usedSlots} / {account.maxSlots}
                          </span>
                          <span className={cn("text-[12px] lg:hidden", percent >= 100 ? "font-bold text-red-500" : "font-bold text-[var(--fg-base)]")}>
                            {Math.round(percent)}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", getSlotBarColor(percent))}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                        {percent >= 100 && (
                          <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-500">
                            <AlertTriangle className="size-3" />
                            Da day
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pl-8 lg:pl-0">
                      <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.72)] p-2.5 transition-colors group-hover:bg-white lg:border-transparent lg:bg-transparent lg:p-0">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)] shadow-sm",
                              expiryInfo.level === "danger"
                                ? "border-red-100 bg-red-50 text-red-500"
                                : expiryInfo.level === "warning"
                                  ? "border-yellow-100 bg-yellow-50 text-yellow-600"
                                  : "bg-white text-[var(--fg-muted)]",
                            )}
                          >
                            <CalendarClock className="size-4" />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span
                              className={cn(
                                "text-[13px] font-medium",
                                expiryInfo.level === "danger"
                                  ? "font-bold text-red-500"
                                  : expiryInfo.level === "warning"
                                    ? "font-bold text-yellow-600"
                                    : "text-[var(--fg-base)] lg:text-[var(--fg-muted)]",
                              )}
                            >
                              {formatDateLabel(account.expiresAt)}
                            </span>
                            {expiryInfo.level !== "ok" ? (
                              <span className={cn("mt-0.5 text-[10px] font-bold", expiryInfo.level === "danger" ? "text-red-500" : "text-yellow-500")}>
                                {expiryInfo.daysLeft === 0 ? "Het han" : `Con ${expiryInfo.daysLeft} ngay`}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative flex justify-start pl-8 lg:justify-center lg:pl-0">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm",
                          expiryInfo.level === "danger"
                            ? "border-red-200 bg-red-50/70 text-red-600"
                            : freeSlots > 0
                              ? "border-[var(--accent)]/20 bg-[var(--accent)]/5 text-[var(--accent)]"
                              : "border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)]",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            expiryInfo.level === "danger"
                              ? "bg-red-500"
                              : freeSlots > 0
                                ? "bg-[var(--accent)] animate-pulse"
                                : "bg-[var(--fg-muted)]",
                          )}
                        />
                        <span className="hidden lg:inline">
                          {expiryInfo.daysLeft === 0 ? "Het han" : freeSlots > 0 ? "Hoat dong" : "Da day"}
                        </span>
                        <span className="lg:hidden">
                          {expiryInfo.daysLeft === 0 ? "Het" : freeSlots > 0 ? "Live" : "Day"}
                        </span>
                      </span>
                    </div>

                    <div className="absolute right-3 top-1/2 hidden size-8 -translate-y-1/2 translate-x-2 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white text-[var(--accent)] opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all group-hover:translate-x-0 group-hover:opacity-100 hover:bg-[var(--accent)] hover:text-white lg:flex">
                      <ChevronRight className="size-4" />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {filteredAccounts.length > 0 ? (
        <div className="flex items-center justify-between gap-4 border-t border-[var(--border-soft)] bg-[rgba(255,255,255,0.88)] px-6 py-3.5">
          <span className="text-[13px] font-medium text-[var(--fg-muted)]">
            Hien thi {(safePage - 1) * PAGE_SIZE + 1}â€“{Math.min(safePage * PAGE_SIZE, sortedAccounts.length)} / {sortedAccounts.length} tai khoan
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              className="flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              Truoc
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => page === 1 || page === totalPages || Math.abs(page - safePage) <= 1)
              .reduce<(number | "ellipsis")[]>((acc, page, index, arr) => {
                if (index > 0 && page - (arr[index - 1] as number) > 1) acc.push("ellipsis");
                acc.push(page);
                return acc;
              }, [])
              .map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-1.5 text-[13px] text-[var(--fg-muted)]">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors",
                      safePage === item
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "border border-[var(--border-soft)] bg-[var(--bg-surface)] text-[var(--fg-base)] hover:bg-[var(--surface-strong)]",
                    )}
                  >
                    {item}
                  </button>
                ),
              )}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
              className="flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tiep
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </SlideUp>
  );
});
