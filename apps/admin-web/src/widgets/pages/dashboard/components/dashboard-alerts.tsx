"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";

interface PendingOrder {
  id: string;
  customer_id: string;
  total_amount_vnd: number;
}

interface OverdueCustomer {
  id: string;
  name: string;
  debtOverdueDays: number;
  debtAmountVnd: number;
}

interface ExpiringAccount {
  id: string;
  email?: string;
  daysLeft: number;
}

interface DashboardAlertsProps {
  pendingOrders: PendingOrder[];
  topOverdueCustomers: OverdueCustomer[];
  expiringAccounts: ExpiringAccount[];
}

const QUICK_ACTIONS = [
  { href: "/orders/new", label: vi.dashboard.alerts.quickCreateOrder, icon: "add_shopping_cart", color: "bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white" },
  { href: "/customers", label: vi.dashboard.alerts.quickCustomers, icon: "person_add", color: "bg-blue-50/80 text-blue-600 hover:bg-blue-600 hover:text-white" },
  { href: "/products", label: vi.dashboard.alerts.quickProducts, icon: "inventory_2", color: "bg-amber-50/80 text-amber-600 hover:bg-amber-600 hover:text-white" },
  { href: "/inventory", label: vi.dashboard.alerts.quickInventory, icon: "warehouse", color: "bg-purple-50/80 text-purple-600 hover:bg-purple-600 hover:text-white" },
] as const;

export function DashboardAlerts({ pendingOrders, topOverdueCustomers, expiringAccounts }: DashboardAlertsProps) {
  return (
    <div data-testid="dashboard-alerts" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div data-testid="dashboard-quick-actions" className="app-card flex flex-col overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[var(--border-soft)] px-5 py-4">
          <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            {vi.dashboard.alerts.quickActions}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                data-testid={`dashboard-quick-action-${action.href.replaceAll("/", "-").replace(/^-/, "")}`}
                className={`group flex flex-col items-center justify-center gap-2 rounded-[1rem] border border-transparent p-4 text-center text-[12px] font-bold transition-[background-color,border-color,box-shadow,color,opacity,transform,width] hover:shadow-md ${action.color}`}
              >
                <span className="material-symbols-outlined text-[24px] transition-transform group-hover:scale-110">
                  {action.icon}
                </span>
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div data-testid="dashboard-pending-alert" className="app-card flex flex-col overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              <span className="material-symbols-outlined text-[16px] text-[var(--warning)]">pending_actions</span>
              {vi.dashboard.alerts.pending}
            </p>
            <p className="mt-0.5 text-[13px] font-bold text-[var(--fg-base)]">{vi.dashboard.alerts.pendingOrdersCount(pendingOrders.length)}</p>
          </div>
          <Link href="/orders" className="text-[12px] font-bold text-[var(--accent)] hover:underline">
            {vi.common.view}
          </Link>
        </div>
        <div className="flex-1 divide-y divide-[var(--border-soft)] overflow-y-auto">
          {pendingOrders.slice(0, 4).map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--surface-light)]"
            >
              <div>
                <p className="max-w-[180px] truncate text-[13px] font-bold text-[var(--fg-base)]">
                  {order.customer_id}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{formatMoney(order.total_amount_vnd)}</p>
              </div>
              <Link
                href="/orders"
                className="rounded-full bg-[var(--warning)]/10 px-2.5 py-1 text-[10px] font-bold text-[var(--warning)] transition-colors hover:bg-[var(--warning)]/20"
              >
                {vi.dashboard.alerts.reviewOrder}
              </Link>
            </div>
          ))}
          {pendingOrders.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center text-[13px] font-medium text-[var(--fg-muted)]">
              <span className="material-symbols-outlined mb-2 text-3xl opacity-30">check_circle</span>
              {vi.dashboard.alerts.pendingOrdersEmpty}
            </div>
          ) : null}
        </div>
      </div>

      <div data-testid="dashboard-overdue-alert" className="app-card flex flex-col overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--warning)]">
              <span className="material-symbols-outlined text-[16px]">money_off</span>
              {vi.dashboard.alerts.debtAlert}
            </p>
            <p className="mt-0.5 text-[13px] font-bold text-[var(--fg-base)]">{vi.dashboard.alerts.topOverdueCustomers}</p>
          </div>
          <Link href="/customers" className="text-[12px] font-bold text-[var(--accent)] hover:underline">
            {vi.common.view}
          </Link>
        </div>
        <div className="flex-1 divide-y divide-[var(--border-soft)] overflow-y-auto">
          {topOverdueCustomers.map((customer) => (
            <div
              key={customer.id}
              className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--surface-light)]"
            >
              <div>
                <p className="max-w-[180px] truncate text-[13px] font-bold text-[var(--fg-base)]">
                  {customer.name}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--danger)]">
                  {vi.dashboard.alerts.overduePrefix} {customer.debtOverdueDays} {vi.dashboard.alerts.days}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-black text-[var(--fg-base)]">{formatMoney(customer.debtAmountVnd)}</p>
                <Link href="/customers" className="mt-0.5 block text-[10px] font-bold text-[var(--accent)] hover:underline">
                  {vi.dashboard.alerts.recoverDebt}
                </Link>
              </div>
            </div>
          ))}
          {topOverdueCustomers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center text-[13px] font-bold text-[#32d74b]">
              <span className="material-symbols-outlined mb-2 text-4xl opacity-50">health_and_safety</span>
              {vi.dashboard.alerts.noOverdueCustomers}
            </div>
          ) : null}
        </div>
      </div>

      <div data-testid="dashboard-expiring-alert" className="app-card flex flex-col overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--danger)]">
              <span className="material-symbols-outlined text-[16px]">timer_off</span>
              {vi.dashboard.alerts.expiringAccounts}
            </p>
            <p className="mt-0.5 text-[13px] font-bold text-[var(--fg-base)]">{vi.dashboard.alerts.topSources}</p>
          </div>
          <Link href="/inventory" className="text-[12px] font-bold text-[var(--accent)] hover:underline">
            {vi.common.view}
          </Link>
        </div>
        <div className="flex-1 divide-y divide-[var(--border-soft)] overflow-y-auto">
          {expiringAccounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--surface-light)]"
            >
              <div>
                <p className="max-w-[180px] truncate text-[13px] font-bold text-[var(--fg-base)]">
                  {account.email || account.id}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-black text-[var(--danger)]">{account.daysLeft} {vi.dashboard.alerts.days}</p>
              </div>
            </div>
          ))}
          {expiringAccounts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center text-[13px] font-bold text-[#32d74b]">
              <span className="material-symbols-outlined mb-2 text-4xl opacity-50">health_and_safety</span>
              {vi.dashboard.alerts.noExpiringAccounts}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
