"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarClock,
  Copy,
  HandCoins,
  Link2,
  Loader2,
  MonitorPlay,
  Plus,
  RefreshCw,
  User,
} from "lucide-react";

import { AppLayout } from "@/widgets/layout/app-layout";
import { ActionMenu } from "@/shared/ui/action-menu";
import { PageContainer, PageHeader, SurfaceCard, StatsGrid, EmptyState, SectionHeader } from "@/shared/ui/page-layout";
import { useContextMenu } from "@/shared/ui/context-menu";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import type { CustomerPremiumSubscription } from "@/lib/domain/premium-types";
import { formatMoney } from "@/lib/utils";
import { getBillingCycleLabel } from "@/lib/domain/premium-renewal-finance";
import { RenewalRequestModal } from "./renewal-request-modal";

type SubscriptionRow = CustomerPremiumSubscription & {
  customer_name: string;
  account_email: string;
  service_name: string;
  migration_id: string | null;
  package_default_price?: number | null;
  renewal_price_factor?: number | null;
};

type RefundMutationPayload = {
  subscription?: Partial<SubscriptionRow>;
};

function getRenewalStatusLabel(status: string) {
  switch (status) {
    case "none":
      return "Chưa tạo yêu cầu";
    case "pending":
      return "Đang chờ xử lý";
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
  const [renewingSubscription, setRenewingSubscription] = useState<SubscriptionRow | null>(null);
  const [actioningSubscription, setActioningSubscription] = useState<{ id: string; action: "refund" } | null>(null);

  useEffect(() => {
    void fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/premium/subscriptions");
      const payload = await readApiEnvelope<SubscriptionRow[]>(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể tải danh sách thuê bao premium");
        return;
      }

      setSubs(payload.data ?? []);
    } catch (error) {
      console.error("[PremiumSubscriptionsPage] fetchSubscriptions", error);
      appToast.error("Không thể tải danh sách thuê bao premium");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefund(subscription: SubscriptionRow) {
    if (!canRefundSubscription(subscription)) {
      appToast.error("Chỉ có thể tính hoàn tiền khi renewal đã bị từ chối.");
      return;
    }

    setActioningSubscription({ id: subscription.id, action: "refund" });
    const previousRow = { ...subscription };

    try {
      const response = await fetch(`/api/premium/subscriptions/${subscription.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "prorated" }),
      });
      const payload = await readApiEnvelope<RefundMutationPayload>(response);

      if (!response.ok) {
        setSubs((current) =>
          current.map((item) => (item.id === subscription.id ? previousRow : item)),
        );
        appToast.error(payload.error ?? "Không thể tính hoàn tiền");
        return;
      }

      if (payload.data?.subscription) {
        setSubs((current) =>
          current.map((item) =>
            item.id === subscription.id
              ? {
                  ...item,
                  ...payload.data?.subscription,
                }
              : item,
          ),
        );
      }

      appToast.success("Đã tính hoàn tiền");
      void fetchSubscriptions();
    } catch (error) {
      console.error("[PremiumSubscriptionsPage] handleRefund", error);
      setSubs((current) =>
        current.map((item) => (item.id === subscription.id ? previousRow : item)),
      );
      appToast.error("Không thể tính hoàn tiền");
    } finally {
      setActioningSubscription((current) => (current?.id === subscription.id ? null : current));
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(successMessage);
    } catch (error) {
      console.error("[PremiumSubscriptionsPage] copyToClipboard", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  const activeSubs = subs.filter((subscription) => subscription.status === "active").length;
  const expiringSubs = subs.filter(
    (subscription) => subscription.days_remaining <= 7 && subscription.days_remaining > 0,
  ).length;
  const pendingRenewals = subs.filter((subscription) => subscription.renewal_status === "pending").length;

  return (
    <AppLayout>
      <ContextMenuRender />
      <RenewalRequestModal
        subscription={renewingSubscription}
        onClose={() => setRenewingSubscription(null)}
        onSubmitted={async () => {
          if (renewingSubscription) {
            setSubs((current) =>
              current.map((item) =>
                item.id === renewingSubscription.id
                  ? {
                      ...item,
                      renewal_status: "pending",
                    }
                  : item,
              ),
            );
          }
          await fetchSubscriptions();
        }}
      />

      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Subscriptions</span>}
          title="Thuê bao premium"
          description="Theo dõi danh sách thuê bao đang hoạt động, tạo yêu cầu gia hạn có đủ dữ liệu tài chính và xử lý hoàn tiền ngay trên cùng một màn."
          actions={
            <Button
              type="button"
              onClick={() => router.push("/premium/accounts")}
              className="rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
            >
              <Plus className="size-5" />
              Mở kho tài khoản
            </Button>
          }
        />

        <StatsGrid className="mt-6">
          <MetricCard
            label="Đang hoạt động"
            value={activeSubs}
            icon={<RefreshCw className="size-6" />}
            tone="positive"
          />
          <MetricCard
            label="Sắp hết hạn"
            value={expiringSubs}
            icon={<AlertTriangle className="size-6" />}
            tone="warning"
          />
          <MetricCard
            label="Đang chờ gia hạn"
            value={pendingRenewals}
            icon={<HandCoins className="size-6" />}
            tone="accent"
          />
        </StatsGrid>

        <SurfaceCard className="mt-6">
          <SectionHeader
            title="Danh sách thuê bao"
            description="Gia hạn giờ đi qua modal chuẩn với chu kỳ mới, giá bán, giá vốn và số tiền đã thu để đội vận hành nhìn ngay doanh thu và lãi."
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
                title="Chưa có thuê bao nào"
                description="Tạo hoặc gán khách vào kho premium để bắt đầu theo dõi gia hạn."
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
              {subs.map((sub) => {
                const isExpired = sub.days_remaining <= 0;
                const isExpiring = sub.days_remaining > 0 && sub.days_remaining <= 7;
                const isRefunding = actioningSubscription?.id === sub.id;
                const canRenew = canRenewSubscription(sub);
                const canRefund = canRefundSubscription(sub);
                const currentPrice = Number(sub.final_price ?? sub.original_price ?? 0);

                const quickActions = [
                  {
                    label: "Xem khách hàng",
                    icon: <User className="size-4" />,
                    onClick: () => router.push(`/customers/${sub.customer_id}`),
                  },
                  {
                    label: "Xem account premium",
                    icon: <MonitorPlay className="size-4" />,
                    onClick: () => router.push(`/premium/accounts/${sub.premium_account_id}`),
                  },
                  ...(sub.migration_id
                    ? [
                        {
                          label: "Mở migration liên quan",
                          icon: <ArrowRightLeft className="size-4" />,
                          onClick: () => router.push("/premium/migrations"),
                        },
                      ]
                    : []),
                  {
                    label: "Sao chép ID thuê bao",
                    icon: <Copy className="size-4" />,
                    onClick: () => void copyToClipboard(sub.id, "Đã sao chép ID thuê bao"),
                  },
                  {
                    label: "Sao chép email account",
                    icon: <Copy className="size-4" />,
                    onClick: () => void copyToClipboard(sub.account_email, "Đã sao chép email account"),
                  },
                ];

                return (
                  <article
                    key={sub.id}
                    className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                    onContextMenu={(event) => {
                      openContextMenu(event, [
                        ...quickActions,
                        ...(canRenew
                          ? [
                              {
                                label: "Tạo yêu cầu gia hạn",
                                icon: <RefreshCw className="size-4" />,
                                onClick: () => setRenewingSubscription(sub),
                              },
                            ]
                          : []),
                        ...(canRefund
                          ? [
                              {
                                label: "Tính hoàn tiền",
                                icon: <HandCoins className="size-4" />,
                                onClick: () => void handleRefund(sub),
                              },
                            ]
                          : []),
                      ]);
                    }}
                  >
                    <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-[1.2fr_1fr_0.95fr] lg:px-6 lg:py-5">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
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
                            <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">{sub.service_name}</p>
                            <p className="mt-2 flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
                              <Link2 className="size-3.5" />
                              <span className="truncate font-mono">{sub.account_email}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoPill
                          label="Chu kỳ"
                          value={getBillingCycleLabel(sub.billing_cycle)}
                        />
                        <InfoPill
                          label="Giá hiện tại"
                          value={formatMoney(currentPrice)}
                        />
                        <InfoPill
                          label="Hạn dùng"
                          value={format(new Date(sub.expiry_date), "dd/MM/yyyy")}
                          tone={isExpired ? "danger" : isExpiring ? "warning" : "positive"}
                        />
                        <InfoPill
                          label="Renewal"
                          value={getRenewalStatusLabel(sub.renewal_status)}
                        />
                      </div>

                      <div className="flex flex-col justify-between gap-4">
                        <div className="rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                            Theo dõi hạn
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <CalendarClock
                              className={`size-4 ${isExpired ? "text-rose-500" : isExpiring ? "text-amber-500" : "text-emerald-500"}`}
                            />
                            <span className="text-[13px] font-black text-[var(--fg-base)]">
                              {isExpired ? "Đã hết hạn" : `Còn ${Math.max(0, sub.days_remaining)} ngày`}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.push(`/customers/${sub.customer_id}`)}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold"
                          >
                            <User className="size-4" />
                            Khách hàng
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!canRenew}
                            onClick={() => setRenewingSubscription(sub)}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-60"
                          >
                            <RefreshCw className="size-4" />
                            Gia hạn
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!canRefund || isRefunding}
                            onClick={() => void handleRefund(sub)}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold disabled:opacity-60"
                          >
                            {isRefunding ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <HandCoins className="size-4" />
                            )}
                            Hoàn tiền
                          </Button>
                          <ActionMenu items={quickActions} />
                        </div>
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

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "positive" | "warning" | "accent";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-500/10 text-emerald-600"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-600"
        : "bg-[var(--accent)]/10 text-[var(--accent)]";

  return (
    <div className="app-card flex h-full items-center justify-between gap-4 p-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
        <p className="mt-2 text-3xl font-black text-[var(--fg-base)]">{value}</p>
      </div>
      <div className={`flex size-12 items-center justify-center rounded-[1rem] ${toneClass}`}>{icon}</div>
    </div>
  );
}

function InfoPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-rose-600"
          : "text-[var(--fg-base)]";

  return (
    <div className="rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{label}</p>
      <p className={`mt-1 text-[13px] font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
