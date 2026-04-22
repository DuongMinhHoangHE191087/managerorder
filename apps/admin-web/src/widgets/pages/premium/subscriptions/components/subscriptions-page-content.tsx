"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AlertTriangle, CalendarClock, Copy, HandCoins, Link2, Loader2, MonitorPlay, Plus, RefreshCw, User } from "lucide-react";

import { AppLayout } from "@/widgets/layout/app-layout";
import { ActionMenu } from "@/shared/ui/action-menu";
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

function getRenewalStatusLabel(status: string) {
  switch (status) {
    case "none":
      return "Chưa yêu cầu";
    case "pending":
      return "Đang chờ";
    case "confirmed":
      return "Đã duyệt";
    case "denied":
      return "Đã từ chối";
    case "migrated":
      return "Đã di chuyển";
    case "refunded":
      return "Đã hoàn tiền";
    default:
      return status;
  }
}

function canRenewSubscription(subscription: SubscriptionRow) {
  return subscription.status === "active" && subscription.renewal_status !== "pending";
}

function canRefundSubscription(subscription: SubscriptionRow) {
  return subscription.renewal_status === "denied" && subscription.original_price > 0;
}

export default function PremiumSubscriptionsPage() {
  const router = useRouter();
  const { openContextMenu, ContextMenuRender } = useContextMenu();
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningSubscription, setActioningSubscription] = useState<{ id: string; action: "renew" | "refund" } | null>(null);

  useEffect(() => {
    void fetchSubs();
  }, []);

  async function fetchSubs() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/premium/subscriptions");
      const payload = await readApiEnvelope<SubscriptionRow[]>(res);
      if (res.ok) setSubs(payload.data ?? []);
      else appToast.error(`Không thể tải danh sách thuê bao: ${payload.error ?? "Lỗi không xác định"}`);
    } catch (err) {
      console.error("[fetchSubscriptions]", err);
      appToast.error("Lỗi kết nối máy chủ");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubscriptionAction(subscription: SubscriptionRow, action: "renew" | "refund") {
    const allowed = action === "renew" ? canRenewSubscription(subscription) : canRefundSubscription(subscription);
    if (!allowed) {
      appToast.error(
        action === "renew"
          ? "Chỉ có thể tạo yêu cầu gia hạn khi thuê bao đang active và chưa có yêu cầu pending."
          : "Chỉ có thể tính hoàn tiền khi renewal đã bị từ chối.",
      );
      return;
    }

    setActioningSubscription({ id: subscription.id, action });

    try {
      const response =
        action === "renew"
          ? await fetch(`/api/premium/subscriptions/${subscription.id}/renew`, { method: "PUT" })
          : await fetch(`/api/premium/subscriptions/${subscription.id}/refund`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ method: "prorated" }),
            });

      const payload = await readApiEnvelope<unknown>(response);
      if (!response.ok) {
        appToast.error(payload.error ?? (action === "renew" ? "Lỗi tạo yêu cầu gia hạn" : "Lỗi tính hoàn tiền"));
        return;
      }

      appToast.success(action === "renew" ? "Da tao yeu cau gia han" : "Da tinh hoan tien");
      await fetchSubs();
    } catch (error) {
      console.error(`[handleSubscriptionAction:${action}]`, error);
      appToast.error("Lỗi mạng");
    } finally {
      setActioningSubscription((current) => (current?.id === subscription.id ? null : current));
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[copySubscriptionValue]", error);
      appToast.error("Không thể sao chép vào clipboard");
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
          title="Thuê bao Premium"
          description="Quản lý khách hàng đang sử dụng dịch vụ Premium, theo dõi hạn dùng và tình trạng kho."
          actions={
            <Button
              type="button"
              onClick={() => router.push("/premium/accounts")}
              className="rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
            >
              <Plus className="size-5" />
              Cấp quyền tài khoản
            </Button>
          }
        />

        <StatsGrid className="mt-6">
          <div className="app-card flex h-full items-center justify-between gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Đang hoạt động</p>
              <p className="mt-2 text-3xl font-black text-[var(--fg-base)]">{activeSubs}</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-[1rem] bg-emerald-500/10 text-emerald-600">
              <RefreshCw className="size-6" />
            </div>
          </div>

          <div className="app-card flex h-full items-center justify-between gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Sắp hết hạn</p>
              <p className="mt-2 text-3xl font-black text-[var(--fg-base)]">{expiringSubs}</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-[1rem] bg-amber-500/10 text-amber-600">
              <AlertTriangle className="size-6" />
            </div>
          </div>

          <div className="app-card flex h-full items-center justify-between gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Tổng thuê bao</p>
              <p className="mt-2 text-3xl font-black text-[var(--fg-base)]">{subs.length}</p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-[1rem] bg-[var(--accent)]/10 text-[var(--accent)]">
              <MonitorPlay className="size-6" />
            </div>
          </div>
        </StatsGrid>

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Danh sách thuê bao"
            description="Tất cả khách hàng đang được cấp quyền, kèm hạn dùng và tài khoản chia sẻ."
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
                title="Chưa có khách hàng nào được cấp quyền"
                description="Đi sang kho tài khoản để tạo một thuê bao đầu tiên."
                action={
                  <Button variant="primary" onClick={() => router.push("/premium/accounts")}>
                    <Plus className="size-4" />
                    Đi tới kho tài khoản
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3 p-4 sm:p-6">
              <div className="hidden lg:grid grid-cols-12 gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[rgba(246,250,244,0.78)] px-6 py-4">
                <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Khách hàng</div>
                <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Dịch vụ & gói</div>
                <div className="col-span-3 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Tài khoản chia sẻ</div>
                <div className="col-span-2 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Hạn dùng</div>
                <div className="col-span-1 text-right text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Trạng thái</div>
              </div>

              {subs.map((sub) => {
                const days = sub.days_remaining;
                const isExpiring = days <= 7 && days > 0;
                const isExpired = days <= 0;
                const isActioning = actioningSubscription?.id === sub.id;
                const canRenew = canRenewSubscription(sub);
                const canRefund = canRefundSubscription(sub);
                const contextMenuItems = [
                  {
                    label: "Xem khách hàng",
                    icon: <User className="size-4" />,
                    onClick: () => router.push(`/customers/${sub.customer_id}`),
                  },
                  {
                    label: "Xem dịch vụ",
                    icon: <MonitorPlay className="size-4" />,
                    onClick: () => router.push("/premium/accounts"),
                  },
                  {
                    label: "Sao chép ID",
                    icon: <Copy className="size-4" />,
                    onClick: () => void copyToClipboard(sub.id, "Đã sao chép ID subscription"),
                  },
                  {
                    label: "Sao chép email tài khoản",
                    icon: <Copy className="size-4" />,
                    onClick: () => void copyToClipboard(sub.account_email, "Đã sao chép email tài khoản"),
                  },
                ];

                return (
                  <article
                    key={sub.id}
                    className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                    onContextMenu={(e) => {
                      openContextMenu(e, [
                        ...contextMenuItems,
                        ...(canRenew
                          ? [
                              {
                      label: "Gia hạn",
                                icon: <RefreshCw className="size-4" />,
                                onClick: () => void handleSubscriptionAction(sub, "renew"),
                              },
                            ]
                          : []),
                        ...(canRefund
                          ? [
                              {
                      label: "Hoàn tiền",
                                icon: <HandCoins className="size-4" />,
                                onClick: () => void handleSubscriptionAction(sub, "refund"),
                              },
                            ]
                          : []),
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
                            Mã khách hàng: {sub.customer_id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      <div className="col-span-1 lg:col-span-3">
                        <div className="lg:hidden mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Dịch vụ & gói</div>
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
                        <div className="lg:hidden mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Tài khoản chia sẻ</div>
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
                            {sub.status === "active" ? "Đang hoạt động" : "Tạm dừng"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--fg-muted)]">Tình trạng gia hạn</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--fg-base)]">
                            {getRenewalStatusLabel(sub.renewal_status)}
                          </span>
                          <span className="text-[12px] font-medium text-[var(--fg-muted)]">Còn {Math.max(0, days)} ngày</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => router.push(`/customers/${sub.customer_id}`)}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-60"
                        >
                          <User className="size-4" />
                          Khách hàng
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!canRenew || isActioning}
                          onClick={() => void handleSubscriptionAction(sub, "renew")}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-60"
                        >
                          {isActioning && actioningSubscription?.action === "renew" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                          Gia hạn
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!canRefund || isActioning}
                          onClick={() => void handleSubscriptionAction(sub, "refund")}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-60"
                        >
                          {isActioning && actioningSubscription?.action === "refund" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <HandCoins className="size-4" />
                          )}
                          Hoàn tiền
                        </Button>
                        <ActionMenu
                          items={[
                            {
                              label: "Xem dịch vụ",
                              icon: <MonitorPlay className="size-4" />,
                              onClick: () => router.push("/premium/accounts"),
                            },
                            {
                              label: "Sao chép ID",
                              icon: <Copy className="size-4" />,
                              onClick: () => void copyToClipboard(sub.id, "Đã sao chép ID subscription"),
                              dividerBefore: true,
                            },
                            {
                              label: "Sao chép email tài khoản",
                              icon: <Copy className="size-4" />,
                              onClick: () => void copyToClipboard(sub.account_email, "Đã sao chép email tài khoản"),
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
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}
