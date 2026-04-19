"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarClock, Link2, MonitorPlay, RefreshCw, AlertTriangle, User, Plus } from "lucide-react";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer, PageHeader, SurfaceCard, StatsGrid, EmptyState, SectionHeader } from "@/shared/ui/page-layout";
import { useContextMenu } from "@/shared/ui/context-menu";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import type { CustomerPremiumSubscription } from "@/lib/domain/premium-types";

type SubscriptionRow = CustomerPremiumSubscription & {
  customer_name: string;
  account_email: string;
  service_name: string;
};

export default function PremiumSubscriptionsPage() {
  const router = useRouter();
  const { openContextMenu, ContextMenuRender } = useContextMenu();
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetchSubs();
  }, []);

  async function fetchSubs() {
    try {
      const res = await fetch("/api/premium/subscriptions");
      const payload = await readApiEnvelope<SubscriptionRow[]>(res);
      if (res.ok) setSubs(payload.data ?? []);
      else appToast.error(`Khong the tai danh sach thue bao: ${payload.error ?? "Loi khong xac dinh"}`);
    } catch (err) {
      console.error("[fetchSubscriptions]", err);
      appToast.error("Loi ket noi Server");
    } finally {
      setIsLoading(false);
    }
  }

  const activeSubs = subs.filter((s) => s.status === "active").length;
  const expiringSubs = subs.filter((s) => s.days_remaining <= 7 && s.days_remaining > 0).length;

  return (
    <AppLayout>
      <ContextMenuRender />
      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Subscriptions</span>}
          title="Thu bao Premium"
          description="Quan ly khach hang dang su dung dich vu Premium, theo doi han dung va tinh trang kho."
          actions={
            <Button
              type="button"
              onClick={() => router.push("/premium/accounts")}
              className="rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
            >
              <Plus className="size-5" />
              Cap quyen tai khoan
            </Button>
          }
        />

        <StatsGrid className="mt-6">
          <div className="app-card flex h-full items-center justify-between gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Dang hoat dong</p>
              <p className="mt-2 text-3xl font-black text-[var(--fg-base)]">{activeSubs}</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-[1rem] bg-emerald-500/10 text-emerald-600">
              <RefreshCw className="size-6" />
            </div>
          </div>

          <div className="app-card flex h-full items-center justify-between gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Sap het han</p>
              <p className="mt-2 text-3xl font-black text-[var(--fg-base)]">{expiringSubs}</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-[1rem] bg-amber-500/10 text-amber-600">
              <AlertTriangle className="size-6" />
            </div>
          </div>

          <div className="app-card flex h-full items-center justify-between gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tong thu bao</p>
              <p className="mt-2 text-3xl font-black text-[var(--fg-base)]">{subs.length}</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-[1rem] bg-[var(--accent)]/10 text-[var(--accent)]">
              <MonitorPlay className="size-6" />
            </div>
          </div>
        </StatsGrid>

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Danh sach thu bao"
            description="Tat ca khach hang dang duoc cap quyen, kem han dung va tai khoan chia se."
          />

          {isLoading ? (
            <div className="p-6">
              <div className="flex justify-center rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-white/70 p-12">
                <div className="size-8 animate-spin rounded-full border-4 border-[var(--border-soft)] border-t-[var(--accent)]" />
              </div>
            </div>
          ) : subs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<User className="size-6" />}
                title="Chua co khach hang nao duoc cap quyen"
                description="Di sang kho tai khoan de tao mot subscription dau tien."
                action={
                  <Button variant="primary" onClick={() => router.push("/premium/accounts")}>
                    <Plus className="size-4" />
                    Di toi kho tai khoan
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3 p-4 sm:p-6">
              <div className="hidden lg:grid grid-cols-12 gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.78)] px-6 py-4">
                <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Khach hang</div>
                <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Dich vu & goi</div>
                <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Tai khoan chia se</div>
                <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Han dung</div>
                <div className="col-span-1 text-right text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Trang thai</div>
              </div>

              {subs.map((sub) => {
                const days = sub.days_remaining;
                const isExpiring = days <= 7 && days > 0;
                const isExpired = days <= 0;

                return (
                  <article
                    key={sub.id}
                    className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                    onContextMenu={(e) => {
                      openContextMenu(e, [
                        { label: "Xem khach hang", icon: <User className="size-4" />, onClick: () => router.push(`/customers/${sub.customer_id}`) },
                        { label: "Xem dich vu", icon: <MonitorPlay className="size-4" />, onClick: () => router.push("/premium/accounts") },
                      ]);
                    }}
                  >
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12 lg:items-center lg:gap-5 lg:px-6 lg:py-5">
                      <div className="col-span-1 flex items-center gap-3 lg:col-span-3">
                        <div className="flex size-10 items-center justify-center rounded-[1rem] border border-[var(--accent)]/10 bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.12),rgba(255,255,255,0.9))] text-[var(--accent)] shadow-sm">
                          <User className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/customers/${sub.customer_id}`}
                            className="block truncate text-base font-extrabold tracking-tight text-[var(--fg-base)] transition-colors hover:text-[var(--accent)]"
                          >
                            {sub.customer_name}
                          </Link>
                          <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                            Customer ID: {sub.customer_id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-1 lg:col-span-3">
                        <div className="lg:hidden mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Dich vu & goi</div>
                        <div className="flex flex-col">
                          <span className="flex items-center gap-2 text-[14px] font-extrabold text-[var(--fg-base)]">
                            <MonitorPlay className="size-4 text-[var(--accent)]" />
                            {sub.service_name}
                          </span>
                          <span className="ml-6 mt-1 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
                            {sub.billing_cycle}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-1 lg:col-span-3">
                        <div className="lg:hidden mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Tai khoan chia se</div>
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-[var(--border-soft)] bg-[var(--surface-light)] shadow-inner">
                            <Link2 className="size-4 text-[var(--fg-muted)]" />
                          </div>
                          <span className="truncate rounded-lg border border-[var(--border-soft)] bg-[var(--surface-light)] px-2 py-0.5 font-mono text-[13px] font-bold text-[var(--fg-base)]">
                            {sub.account_email}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-1 lg:col-span-2">
                        <div className="lg:hidden mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Han dung</div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <CalendarClock className={`size-4 ${isExpired ? "text-rose-500" : isExpiring ? "text-amber-500" : "text-emerald-500"}`} />
                            <span className="text-[13px] font-black text-[var(--fg-base)]">
                              {format(new Date(sub.expiry_date), "dd/MM/yyyy")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1 w-12 overflow-hidden rounded-full bg-[var(--border-soft)]">
                              <div
                                className={`h-full rounded-full ${isExpired ? "bg-rose-500" : isExpiring ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: isExpired ? "100%" : `${Math.min(100, (days / 30) * 100)}%` }}
                              />
                            </div>
                            <span
                              className={`text-[11px] font-black uppercase tracking-tighter ${
                                isExpired ? "text-rose-500" : isExpiring ? "text-amber-500" : "text-emerald-500"
                              }`}
                            >
                              {isExpired ? "Da het han" : `Con ${days} ngay`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-1 flex justify-start lg:col-span-1 lg:justify-end">
                        <div className="lg:hidden mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Trang thai</div>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm ${
                            sub.status === "active"
                              ? "border-emerald-200 bg-emerald-50/80 text-emerald-700"
                              : "border-rose-200 bg-rose-50/80 text-rose-700"
                          }`}
                        >
                          {sub.status === "active" ? "Active" : "Paused"}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}
