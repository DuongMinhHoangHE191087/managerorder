"use client";

import React from "react";
import { useState } from "react";
import { AlertTriangle, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import type { InventoryDashboardData } from "@/shared/types/inventory";

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
        <div className="relative rounded-[1.2rem] border border-red-500/25 bg-red-500/5 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-red-500/10 p-1.5">
                <AlertTriangle className="size-5 text-red-500" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-red-600">
                  {dashboard.lowCapacityCount} tài khoản sắp đầy slot
                </h4>
                <p className="mt-0.5 text-[12px] text-red-500/70">
                  Các tài khoản nguồn dưới 20% slot trống. Cần bổ sung hoặc nâng cấp.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpandedLow(!expandedLow)}
                className="rounded-lg p-1 hover:bg-red-500/10 transition-colors"
              >
                {expandedLow ? <ChevronUp className="size-4 text-red-500" /> : <ChevronDown className="size-4 text-red-500" />}
              </button>
              <button
                type="button"
                onClick={() => setDismissedLow(true)}
                className="rounded-lg p-1 hover:bg-red-500/10 transition-colors"
              >
                <X className="size-4 text-red-500/60" />
              </button>
            </div>
          </div>
          {expandedLow ? (
            <div className="mt-3 space-y-1.5 border-t border-red-500/15 pt-3">
              {dashboard.lowCapacityList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-[12px] transition-colors hover:bg-red-500/5"
                >
                  <span className="font-medium text-red-600">{item.email}</span>
                  <span className="font-bold text-red-500/70">
                    {item.freeSlots}/{item.maxSlots} slots trống ({item.freePercent}%)
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasExpiringSoon ? (
        <div className="relative rounded-[1.2rem] border border-amber-500/25 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-amber-500/10 p-1.5">
                <Clock className="size-5 text-amber-500" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-amber-600">
                  {dashboard.expiringSoon7d} tài khoản hết hạn trong 7 ngày
                </h4>
                <p className="mt-0.5 text-[12px] text-amber-500/70">
                  Cần gia hạn hoặc di chuyển dữ liệu trước khi hết hạn.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpandedExpiry(!expandedExpiry)}
                className="rounded-lg p-1 hover:bg-amber-500/10 transition-colors"
              >
                {expandedExpiry ? <ChevronUp className="size-4 text-amber-500" /> : <ChevronDown className="size-4 text-amber-500" />}
              </button>
              <button
                type="button"
                onClick={() => setDismissedExpiry(true)}
                className="rounded-lg p-1 hover:bg-amber-500/10 transition-colors"
              >
                <X className="size-4 text-amber-500/60" />
              </button>
            </div>
          </div>
          {expandedExpiry ? (
            <div className="mt-3 space-y-1.5 border-t border-amber-500/15 pt-3">
              {dashboard.expiringSoonList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-[12px] transition-colors hover:bg-amber-500/5"
                >
                  <span className="font-medium text-amber-600">{item.email}</span>
                  <span className="font-bold text-amber-500/70">{item.daysLeft} ngày còn lại</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
