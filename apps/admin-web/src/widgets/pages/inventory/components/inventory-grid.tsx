"use client";

import React from "react";
import { motion } from "framer-motion";
import { Server, CalendarClock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { cn, formatDateLabel } from "@/lib/utils";
import type { SourceAccount, Provider } from "@/lib/domain/types";
import { INVENTORY_COPY as copy } from "../copy";

interface InventoryGridProps {
  filteredAccounts: SourceAccount[];
  providerById: Map<string, Provider>;
  productMap: Map<string, string>;
  onRowOpen: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

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
  if (percent >= 100) return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]";
  if (percent >= 90) return "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.35)]";
  if (percent >= 70) return "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.3)]";
  return "bg-[var(--accent)] shadow-[0_0_8px_rgba(var(--accent-rgb),0.35)]";
}

const InventoryCard = React.memo(function InventoryCard({
  account,
  providerById,
  productMap,
  isSelected,
  onToggleSelect,
  onRowOpen,
}: {
  account: SourceAccount;
  providerById: Map<string, Provider>;
  productMap: Map<string, string>;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
  onRowOpen: (id: string) => void;
}) {
  const percent = account.maxSlots > 0 ? (account.usedSlots / account.maxSlots) * 100 : 0;
  const freeSlots = account.maxSlots - account.usedSlots;
  const productNames = account.productIds.map((pid) => productMap.get(pid)).filter(Boolean).join(", ");
  const providerName = providerById.get(account.provider)?.name || account.provider;
  const expiryInfo = getExpiryWarning(account.expiresAt);

  return (
    <motion.div
      data-testid="inventory-card"
      onClick={() => onRowOpen(account.id)}
      whileHover={{ y: -3, boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-xl border border-gray-200/80 bg-white p-4 transition-all duration-200 flex flex-col justify-between select-none relative hover:border-gray-300 shadow-sm",
        isSelected && "ring-2 ring-[var(--accent)] border-transparent bg-[var(--accent)]/5 shadow-[0_6px_20px_rgba(var(--accent-rgb),0.04)]"
      )}
    >
      <div>
        {/* Top Header: Server Info & Selection Checkbox */}
        <div className="flex items-start justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "flex w-9 h-9 shrink-0 items-center justify-center rounded-lg border border-gray-250/80 bg-gray-50/50 text-[var(--fg-muted)] shadow-sm group-hover:border-[var(--accent)]/30 group-hover:text-[var(--accent)] group-hover:bg-white transition-all duration-200",
              isSelected && "border-[var(--accent)] text-[var(--accent)] bg-white"
            )}>
              <Server className="size-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-gray-800 text-[13.5px] leading-tight group-hover:text-[var(--accent)] transition-colors" title={account.email}>
                {account.email}
              </h3>
              <p className="text-[10px] text-[var(--fg-muted)] mt-0.5 font-bold uppercase tracking-wider truncate" title={providerName}>
                {providerName}
              </p>
            </div>
          </div>

          {onToggleSelect && (
            <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(account.id)}
                className="size-4 rounded border-gray-300 text-[var(--accent)] accent-[var(--accent)] shadow-sm cursor-pointer transition-all hover:scale-105"
              />
            </div>
          )}
        </div>

        {/* Product Badges List */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <span className="inline-flex max-w-full items-center truncate rounded-lg border border-gray-200/80 bg-gray-50/60 px-2.5 py-0.5 text-[11px] font-bold text-[var(--fg-base)] group-hover:border-[var(--accent)]/30 group-hover:bg-white transition-all duration-200">
            {productNames || copy.inventoryTable.emptyValue}
          </span>
        </div>

        {/* Slots Usage Section */}
        <div className="space-y-1.5 mb-3.5 rounded-xl border border-gray-200/60 bg-gray-50/40 p-3 group-hover:bg-white transition-all duration-200">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-[var(--fg-muted)] uppercase tracking-wider">{copy.inventoryTable.slotsLabel}</span>
            <span className={cn("font-mono text-[12px]", percent >= 100 ? "text-red-500 font-extrabold" : "text-[var(--fg-base)]")}>
              {account.usedSlots}/{account.maxSlots} ({Math.round(percent)}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200/60">
            <div
              className={cn("h-full rounded-full transition-all duration-500", getSlotBarColor(percent))}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Section: Expiry Progress & Status Badges */}
      <div className="mt-2 border-t border-gray-100 pt-3 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "flex w-7 h-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 shadow-sm bg-gray-50/40 text-[var(--fg-muted)]",
            expiryInfo.level === "danger" && "border-red-100 text-red-500 bg-red-50/20",
            expiryInfo.level === "warning" && "border-yellow-100 text-yellow-600 bg-yellow-50/20"
          )}>
            <CalendarClock className="size-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={cn(
              "text-[12px] font-mono font-bold leading-tight text-gray-800",
              expiryInfo.level === "danger" && "text-red-500",
              expiryInfo.level === "warning" && "text-yellow-600"
            )}>
              {formatDateLabel(account.expiresAt)}
            </span>
            {expiryInfo.level !== "ok" && (
              <span className={cn("text-[9px] font-bold font-mono mt-0.5 leading-none", expiryInfo.level === "danger" ? "text-red-500" : "text-yellow-500")}>
                {expiryInfo.daysLeft === 0 ? copy.inventoryTable.expired : copy.inventoryTable.daysLeft(expiryInfo.daysLeft)}
              </span>
            )}
          </div>
        </div>

        {/* Status Badge Tag */}
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider shrink-0",
          expiryInfo.level === "danger"
            ? "border-red-200 bg-red-50/70 text-red-600"
            : freeSlots > 0
              ? "border-[var(--accent)]/20 bg-[var(--accent)]/5 text-[var(--accent)]"
              : "border-amber-250/25 bg-amber-50/50 text-amber-700"
        )}>
          <span className={cn(
            "size-1.5 rounded-full shrink-0",
            expiryInfo.level === "danger" ? "bg-red-500" : freeSlots > 0 ? "bg-[var(--accent)] animate-pulse" : "bg-amber-500"
          )} />
          {expiryInfo.daysLeft === 0 ? copy.inventoryTable.expired : freeSlots > 0 ? copy.inventoryTable.active : copy.inventoryTable.fullLabel}
        </span>
      </div>
    </motion.div>
  );
});

export const InventoryGrid = React.memo(function InventoryGrid({
  filteredAccounts,
  providerById,
  productMap,
  onRowOpen,
  selectedIds,
  onToggleSelect,
}: InventoryGridProps) {
  if (filteredAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-[var(--accent)]/10 bg-[var(--accent)]/5">
          <Server className="size-5 text-[var(--accent)] opacity-60" />
        </div>
        <p className="text-[13.5px] font-semibold text-[var(--fg-base)]">{copy.inventoryTable.noData}</p>
        <p className="mt-0.5 text-[11.5px] text-[var(--fg-muted)]">{copy.inventoryTable.noDataDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="inventory-grid">
      {filteredAccounts.map((account) => (
        <InventoryCard
          key={account.id}
          account={account}
          providerById={providerById}
          productMap={productMap}
          isSelected={selectedIds?.has(account.id) ?? false}
          onToggleSelect={onToggleSelect}
          onRowOpen={onRowOpen}
        />
      ))}
    </div>
  );
});
