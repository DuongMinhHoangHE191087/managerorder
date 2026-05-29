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
        <GlassHoverCard className="app-card flex flex-col gap-2 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default h-full">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">{vi.customers.kpis.totalCustomers}</p>
            <span className="bg-[var(--accent)]/10 text-[var(--accent)] p-1.5 rounded-xl"><Users className="size-4" /></span>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight font-mono">{totalCustomers}</p>
        </GlassHoverCard>
      </StaggerItem>
      <StaggerItem>
        <GlassHoverCard className="app-card flex flex-col gap-2 border border-[var(--border-soft)] bg-white/90 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default h-full">
          <div className="flex justify-between items-start">
            <p className="text-[var(--fg-muted)] text-[11px] font-extrabold uppercase tracking-wider">{vi.customers.kpis.wholesaleAgency}</p>
            <span className="bg-[#ff9500]/10 text-[#ff9500] p-1.5 rounded-xl"><ShieldCheck className="size-4" /></span>
          </div>
          <p className="text-[var(--fg-base)] text-3xl font-black tracking-tight font-mono">{wholesaleAgencyCustomers}</p>
        </GlassHoverCard>
      </StaggerItem>
      <StaggerItem>
        <GlassHoverCard className="app-card flex flex-col gap-2 border border-red-500/25 bg-red-500/5 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[1.5rem] transition-all duration-300 hover:shadow-[0_18px_38px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 active:scale-[0.98] cursor-default h-full">
          <div className="flex justify-between items-start">
            <p className="text-red-600 text-[11px] font-extrabold uppercase tracking-wider">{vi.customers.kpis.totalDebt}</p>
            <span className="bg-[var(--danger)]/10 text-[var(--danger)] p-1.5 rounded-xl"><AlertTriangle className="size-4" /></span>
          </div>
          <p className="text-red-600 text-3xl font-black tracking-tight font-mono">{formatMoney(totalDebt)}</p>
        </GlassHoverCard>
      </StaggerItem>
    </StaggerContainer>
  );
});
