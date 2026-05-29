"use client";

import React from "react";
import { useState } from "react";
import { AlertTriangle, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { InventoryDashboardData } from "@/shared/types/inventory";
import { INVENTORY_COPY as copy } from "../copy";

interface CapacityAlertBannerProps {
  dashboard: InventoryDashboardData;
}

export const CapacityAlertBanner = React.memo(function CapacityAlertBanner({ dashboard }: CapacityAlertBannerProps) {
  const [dismissedLow, setDismissedLow] = useState(false);
  const [dismissedExpiry, setDismissedExpiry] = useState(false);
  const [expandedLow, setExpandedLow] = useState(false);
  const [expandedExpiry, setExpandedExpiry] = useState(false);

  const hasLowCapacity = dashboard.lowCapacityCount > 0 && !dismissedLow;
  const hasExpiringSoon = dashboard.expiringSoon7d > 0 && !dismissedExpiry;

  if (!hasLowCapacity && !hasExpiringSoon) return null;

  return (
    <div className="space-y-3 mb-6">
      {hasLowCapacity ? (
        <div className="relative rounded-[1.5rem] border border-red-500/15 bg-red-500/[0.02] backdrop-blur-md p-4 shadow-[0_8px_30px_rgba(239,68,68,0.02)] transition-all duration-300 hover:bg-red-500/[0.04]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-red-500/10 p-1.5 text-red-500">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <h4 className="text-[13px] font-extrabold text-red-700 tracking-tight">
                  {copy.capacityAlert.lowCapacityTitle(dashboard.lowCapacityCount)}
                </h4>
                <p className="mt-0.5 text-[11px] text-red-600/70 font-medium">
                  {copy.capacityAlert.lowCapacityDescription}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpandedLow(!expandedLow)}
                className="rounded-lg p-1 text-red-500 hover:bg-red-500/10 transition-colors active:scale-90"
              >
                {expandedLow ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => setDismissedLow(true)}
                className="rounded-lg p-1 text-red-500/60 hover:bg-red-500/10 transition-colors active:scale-90"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {expandedLow && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden mt-3 space-y-1 border-t border-red-500/10 pt-3"
              >
                {dashboard.lowCapacityList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl px-3 py-1.5 text-[11px] transition-colors hover:bg-red-500/5"
                  >
                    <span className="font-semibold text-red-700">{item.email}</span>
                    <span className="font-mono font-extrabold text-red-500/80">
                      {item.freeSlots}/{item.maxSlots} trống ({item.freePercent}%)
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}

      {hasExpiringSoon ? (
        <div className="relative rounded-[1.5rem] border border-amber-500/15 bg-amber-500/[0.02] backdrop-blur-md p-4 shadow-[0_8px_30px_rgba(245,158,11,0.02)] transition-all duration-300 hover:bg-amber-500/[0.04]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-amber-500/10 p-1.5 text-amber-500">
                <Clock className="size-4" />
              </div>
              <div>
                <h4 className="text-[13px] font-extrabold text-amber-700 tracking-tight">
                  {copy.capacityAlert.expiringTitle(dashboard.expiringSoon7d)}
                </h4>
                <p className="mt-0.5 text-[11px] text-amber-600/70 font-medium">
                  {copy.capacityAlert.expiringDescription}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpandedExpiry(!expandedExpiry)}
                className="rounded-lg p-1 text-amber-500 hover:bg-amber-500/10 transition-colors active:scale-90"
              >
                {expandedExpiry ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => setDismissedExpiry(true)}
                className="rounded-lg p-1 text-amber-500/60 hover:bg-amber-500/10 transition-colors active:scale-90"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {expandedExpiry && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden mt-3 space-y-1 border-t border-amber-500/10 pt-3"
              >
                {dashboard.expiringSoonList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl px-3 py-1.5 text-[11px] transition-colors hover:bg-amber-500/5"
                  >
                    <span className="font-semibold text-amber-700">{item.email}</span>
                    <span className="font-mono font-extrabold text-amber-600/80">Còn {item.daysLeft} ngày</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
});
