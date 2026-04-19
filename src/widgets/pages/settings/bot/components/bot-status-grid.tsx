"use client";

import { Activity, Bot, CheckCircle2, RefreshCw, MessageCircle, MessageSquare } from "lucide-react";
import { SectionCard } from "@/shared/ui/section-card";
import { WorkflowRail } from "@/widgets/pages/settings/bot/components/workflow-rail";
import type { BotManagerStatus } from "@/lib/domain/types";

function StatusCard({
  title,
  description,
  stat,
  subStat,
  icon: Icon,
  accent,
  loading,
}: {
  title: string;
  description: string;
  stat: string;
  subStat: string;
  icon: typeof Bot;
  accent: "emerald" | "blue" | "violet" | "rose" | "amber";
  loading?: boolean;
}) {
  const accentClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  }[accent];

  return (
    <SectionCard title={title} description={description}>
      <div className={`rounded-2xl border p-4 ${accentClass}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex size-11 items-center justify-center rounded-full bg-white/70">
            <Icon className="size-5" />
          </div>
          <CheckCircle2 className="size-5" />
        </div>
        {loading ? (
          <div className="animate-pulse text-sm">Đang tải...</div>
        ) : (
          <>
            <div className="text-2xl font-black">{stat}</div>
            <div className="mt-1 text-[12px] font-semibold">{subStat}</div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

export function BotStatusGrid({
  status,
  loading,
}: {
  status?: BotManagerStatus;
  loading?: boolean;
}) {
  const runtimeMode = status?.operational.runtimeMode ?? "inactive";
  const runtimeLabel =
    runtimeMode === "webhook-first"
      ? "Webhook-first"
      : runtimeMode === "polling-fallback"
        ? "Polling fallback"
        : "Inactive";
  const matchedCoveragePercent = status?.operational.matchedCoveragePercent ?? 0;
  const autoReminderCoveragePercent = status?.operational.autoReminderCoveragePercent ?? 0;
  const coverageAccent =
    matchedCoveragePercent >= 75 ? "emerald" : matchedCoveragePercent > 0 ? "amber" : "rose";
  const runtimeAccent =
    runtimeMode === "webhook-first" ? "emerald" : runtimeMode === "polling-fallback" ? "amber" : "rose";
  const botReadiness = [
    {
      label: "Webhook secret",
      value: status?.telegram.webhookSecretConfigured ? "OK" : "Thiếu",
      tone: status?.telegram.webhookSecretConfigured ? "text-emerald-700" : "text-rose-700",
    },
    {
      label: "Admin chat",
      value: status?.telegram.adminChatConfigured ? "OK" : "Thiếu",
      tone: status?.telegram.adminChatConfigured ? "text-emerald-700" : "text-amber-700",
    },
    {
      label: "Tenant",
      value: status?.operational.tenantAligned ? "Aligned" : "Lệch",
      tone: status?.operational.tenantAligned ? "text-emerald-700" : "text-rose-700",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Telegram"
          description={
            !status?.telegram.tokenConfigured
              ? "Thiếu token"
              : !status.telegram.accountConfigured
                ? "Thiếu bot account"
                : !status.telegram.accountMatchesCurrentTenant
                  ? "Tenant bot lệch tenant hiện tại"
                  : "Token và tenant đã sẵn sàng"
          }
          accent={
            status?.telegram.tokenConfigured && status.telegram.accountConfigured && status.telegram.accountMatchesCurrentTenant
              ? "emerald"
              : status?.telegram.tokenConfigured
                ? "amber"
                : "rose"
          }
          icon={MessageSquare}
          stat={`${status?.contacts.telegram ?? 0} contacts`}
          subStat={
            status?.telegram.accountConfigured
              ? `${status.telegram.adminChatConfigured ? "Admin chat OK" : "Thiếu admin chat"} • ${status.telegram.accountResolutionSource ?? "unknown"}`
              : "Thiếu TELEGRAM_BOT_ACCOUNT_ID hoặc fallback tenant"
          }
          loading={loading}
        />
        <StatusCard
          title="Zalo"
          description={status?.zalo.tokenConfigured ? "Runtime sẵn sàng" : "Thiếu token"}
          accent={status?.zalo.tokenConfigured ? "blue" : "amber"}
          icon={MessageCircle}
          stat={`${status?.contacts.zalo ?? 0} contacts`}
          subStat={status?.zalo.accountBound ? "Đã bind account" : "Chưa bind account"}
          loading={loading}
        />
        <StatusCard
          title="Coverage"
          description="Tỷ lệ match customer và auto reminder trên bot contacts."
          accent={coverageAccent}
          icon={Activity}
          stat={`${matchedCoveragePercent}%`}
          subStat={`${status?.contacts.matched ?? 0}/${status?.contacts.total ?? 0} matched • ${autoReminderCoveragePercent}% auto reminder`}
          loading={loading}
        />
        <StatusCard
          title="Runtime"
          description="Webhook-first trên Vercel, polling chỉ là fallback."
          accent={runtimeAccent}
          icon={RefreshCw}
          stat={runtimeLabel}
          subStat={`${status?.operational.broadcastReady ? "Broadcast ready" : "Broadcast blocked"} • ${status?.operational.tenantAligned ? "tenant aligned" : "tenant mismatch"}`}
          loading={loading}
        />
      </div>

      <div className="mt-4 grid gap-2 rounded-[1.4rem] border border-[var(--border-soft)] bg-white/80 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.05)] sm:grid-cols-3">
        {botReadiness.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{item.label}</p>
              <p className={`text-[13px] font-black ${item.tone}`}>{item.value}</p>
            </div>
            <CheckCircle2 className="size-4 text-[var(--fg-muted)]" />
          </div>
        ))}
      </div>

      <WorkflowRail
        title="Bot workflow"
        description="Luồng vận hành cho contact sync, match khách, nhắc hạn và broadcast."
        steps={[
          {
            title: "Sync contacts",
            description: "Nhận user từ Telegram / Zalo và đồng bộ về một contact store.",
            badge: `${status?.contacts.total ?? 0} contacts`,
            status: loading ? "pending" : "done",
          },
          {
            title: "Match customer",
            description: "Gắn contact với customer để bot hiểu đúng người cần chăm sóc.",
            badge: `${status?.contacts.matched ?? 0} matched`,
            status: matchedCoveragePercent > 0 ? "active" : "warning",
          },
          {
            title: "Auto reminder",
            description: "Kích hoạt nhắc hạn tự động theo lịch và điều kiện từng contact.",
            badge: `${status?.contacts.autoReminderEnabled ?? 0} on`,
            status: autoReminderCoveragePercent > 0 ? "active" : "pending",
          },
          {
            title: "Broadcast & audit",
            description: "Gửi broadcast có kiểm soát và theo dõi trạng thái runtime trên Vercel.",
            badge: runtimeLabel,
            status: runtimeMode === "webhook-first" ? "done" : runtimeMode === "polling-fallback" ? "warning" : "pending",
          },
        ]}
      />
    </>
  );
}
