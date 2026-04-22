"use client";

import React from "react";
import { Users, ShieldCheck, AlertTriangle } from "lucide-react";
import { StaggerContainer, StaggerItem, GlassHoverCard } from "@/shared/ui/animations";
import { formatMoney } from "@/lib/utils";
import type { Customer } from "@/lib/domain/types";
import { vi } from "@/shared/messages/vi";

interface CustomerKpiCardsProps {
  customers: Customer[];
}

export const CustomerKpiCards = React.memo(function CustomerKpiCards({ customers }: CustomerKpiCardsProps) {
  const totalCustomers = customers.length;
  const wholesaleAgencyCustomers = customers.filter(
    (c) => c.customerType === "wholesale" || c.customerType === "agency"
  ).length;
  const totalDebt = customers.reduce((sum, c) => sum + c.debtAmountVnd, 0);

  return (
    <StaggerContainer delayChildren={0.2} staggerDelay={0.1} className="grid gap-6 md:grid-cols-3 mb-6">
      <StaggerItem>
        <GlassHoverCard className="flex flex-col gap-2 rounded-ios p-6 shadow-sm h-full bg-white border border-[var(--border-soft)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-wider">{vi.customers.kpis.totalCustomers}</p>
            <span className="bg-[var(--accent)]/10 text-[var(--accent)] p-1.5 rounded-lg"><Users className="size-5" /></span>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight">{totalCustomers}</p>
        </GlassHoverCard>
      </StaggerItem>
      <StaggerItem>
        <GlassHoverCard className="flex flex-col gap-2 rounded-ios p-6 shadow-sm h-full bg-white border border-[var(--border-soft)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-wider">{vi.customers.kpis.wholesaleAgency}</p>
            <span className="bg-[#ff9500]/10 text-[#ff9500] p-1.5 rounded-lg"><ShieldCheck className="size-5" /></span>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight">{wholesaleAgencyCustomers}</p>
        </GlassHoverCard>
      </StaggerItem>
      <StaggerItem>
        <GlassHoverCard className="flex flex-col gap-2 rounded-ios p-6 shadow-sm h-full bg-white border border-[var(--border-soft)]">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-bold uppercase tracking-wider">{vi.customers.kpis.totalDebt}</p>
            <span className="bg-[var(--danger)]/10 text-[var(--danger)] p-1.5 rounded-lg"><AlertTriangle className="size-5" /></span>
          </div>
          <p className="text-[var(--danger)] text-3xl font-black tracking-tight">{formatMoney(totalDebt)}</p>
        </GlassHoverCard>
      </StaggerItem>
    </StaggerContainer>
  );
});
