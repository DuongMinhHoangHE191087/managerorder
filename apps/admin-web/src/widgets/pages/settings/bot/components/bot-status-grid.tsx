"use client";

import { Activity, Bot, CheckCircle2, RefreshCw, MessageCircle, MessageSquare } from "lucide-react";
import { SectionCard } from "@/shared/ui/section-card";
import { WorkflowRail } from "@/widgets/pages/settings/bot/components/workflow-rail";
import type { BotManagerStatus } from "@/lib/domain/types";
import { vi } from "@/shared/messages/vi";

function formatRuntimeMoment(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function RuntimeDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{label}</p>
      <p className="mt-1 text-[12px] font-semibold text-[var(--fg-base)]">{value}</p>
    </div>
  );
}

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
          <div className="animate-pulse text-sm">{vi.common.loading}</div>
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
      ? vi.bot.statusGrid.runtime.webhookFirst
      : runtimeMode === "polling-fallback"
        ? vi.bot.statusGrid.runtime.pollingFallback
        : vi.bot.statusGrid.runtime.inactive;
  const matchedCoveragePercent = status?.operational.matchedCoveragePercent ?? 0;
  const autoReminderCoveragePercent = status?.operational.autoReminderCoveragePercent ?? 0;
  const coverageAccent =
    matchedCoveragePercent >= 75 ? "emerald" : matchedCoveragePercent > 0 ? "amber" : "rose";
  const runtimeAccent =
    runtimeMode === "webhook-first" ? "emerald" : runtimeMode === "polling-fallback" ? "amber" : "rose";
  const runtimeHealthLabel = status?.operational.runtimeHealthy
    ? vi.bot.statusGrid.runtime.runtimeHealthy
    : vi.bot.statusGrid.runtime.runtimeStale;
  const botReadiness = [
    {
      label: vi.bot.statusGrid.readiness.webhookSecret,
      value: status?.telegram.webhookSecretConfigured ? vi.bot.statusGrid.readiness.ok : vi.bot.statusGrid.readiness.missing,
      tone: status?.telegram.webhookSecretConfigured ? "text-emerald-700" : "text-rose-700",
    },
    {
      label: vi.bot.statusGrid.readiness.adminChat,
      value: status?.telegram.adminChatConfigured ? vi.bot.statusGrid.readiness.ok : vi.bot.statusGrid.readiness.missing,
      tone: status?.telegram.adminChatConfigured ? "text-emerald-700" : "text-amber-700",
    },
    {
      label: vi.bot.statusGrid.readiness.tenant,
      value: status?.operational.tenantAligned ? vi.bot.statusGrid.readiness.aligned : vi.bot.statusGrid.readiness.mismatch,
      tone: status?.operational.tenantAligned ? "text-emerald-700" : "text-rose-700",
    },
    {
      label: vi.bot.statusGrid.readiness.method,
      value:
        status?.telegram.runtime.actualTransport === "webhook"
          ? vi.bot.statusGrid.readiness.webhook
          : status?.telegram.runtime.actualTransport === "polling"
            ? vi.bot.statusGrid.readiness.polling
            : vi.bot.statusGrid.runtime.notReady,
      tone: status?.operational.runtimeHealthy ? "text-emerald-700" : "text-amber-700",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title={vi.bot.statusGrid.telegramTitle}
          description={
            !status?.telegram.tokenConfigured
              ? vi.bot.statusGrid.telegram.missingToken
              : !status.telegram.accountConfigured
                ? vi.bot.statusGrid.telegram.missingAccount
                : !status.telegram.accountMatchesCurrentTenant
                  ? vi.bot.statusGrid.telegram.tenantMismatch
                  : vi.bot.statusGrid.telegram.ready
          }
          accent={
            status?.telegram.tokenConfigured && status.telegram.accountConfigured && status.telegram.accountMatchesCurrentTenant
              ? "emerald"
              : status?.telegram.tokenConfigured
                ? "amber"
                : "rose"
          }
          icon={MessageSquare}
          stat={`${status?.contacts.telegram ?? 0} liên hệ`}
          subStat={
            status?.telegram.accountConfigured
              ? `${status.telegram.adminChatConfigured ? vi.bot.statusGrid.telegram.linkedChat : vi.bot.statusGrid.telegram.missingChat} • ${status.telegram.accountResolutionSource ?? vi.bot.statusGrid.telegram.sourceUnknown}`
              : vi.bot.statusGrid.telegram.missingAccountId
          }
          loading={loading}
        />
        <StatusCard
          title={vi.bot.statusGrid.zaloTitle}
          description={status?.zalo.tokenConfigured ? vi.bot.statusGrid.zalo.runtimeReady : vi.bot.statusGrid.zalo.missingToken}
          accent={status?.zalo.tokenConfigured ? "blue" : "amber"}
          icon={MessageCircle}
          stat={`${status?.contacts.zalo ?? 0} liên hệ`}
          subStat={status?.zalo.accountBound ? vi.bot.statusGrid.zalo.linkedAccount : vi.bot.statusGrid.zalo.unlinkedAccount}
          loading={loading}
        />
        <StatusCard
          title={vi.bot.statusGrid.coverage.title}
          description={vi.bot.statusGrid.coverage.description}
          accent={coverageAccent}
          icon={Activity}
          stat={`${matchedCoveragePercent}%`}
          subStat={`${status?.contacts.matched ?? 0}/${status?.contacts.total ?? 0} đã ghép • ${autoReminderCoveragePercent}% tự nhắc`}
          loading={loading}
        />
        <StatusCard
          title={vi.bot.statusGrid.runtime.title}
          description={vi.bot.statusGrid.runtime.description}
          accent={runtimeAccent}
          icon={RefreshCw}
          stat={runtimeLabel}
          subStat={`${status?.operational.broadcastReady ? vi.bot.statusGrid.runtime.broadcastReady : vi.bot.statusGrid.runtime.notReady} • ${runtimeHealthLabel}`}
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[
          {
            title: "Telegram runtime",
            transport: status?.telegram.runtime.actualTransport ?? "inactive",
            healthy: status?.telegram.runtime.healthy ?? false,
            webhookUrl: status?.telegram.runtime.webhookUrl,
            pendingUpdateCount: status?.telegram.runtime.pendingUpdateCount,
            lastHeartbeatAt: status?.telegram.runtime.lastHeartbeatAt,
            lastInboundAt: status?.telegram.runtime.lastInboundAt,
            lastReplyAt: status?.telegram.runtime.lastReplyAt,
            lastErrorAt: status?.telegram.runtime.lastErrorAt,
            lastErrorMessage: status?.telegram.runtime.lastErrorMessage,
          },
          {
            title: "Zalo runtime",
            transport: status?.zalo.runtime.actualTransport ?? "inactive",
            healthy: status?.zalo.runtime.healthy ?? false,
            webhookUrl: null,
            pendingUpdateCount: null,
            lastHeartbeatAt: status?.zalo.runtime.lastHeartbeatAt,
            lastInboundAt: status?.zalo.runtime.lastInboundAt,
            lastReplyAt: status?.zalo.runtime.lastReplyAt,
            lastErrorAt: status?.zalo.runtime.lastErrorAt,
            lastErrorMessage: status?.zalo.runtime.lastErrorMessage,
          },
        ].map((runtime) => (
          <div
            key={runtime.title}
            className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/85 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{runtime.title}</p>
                <p className="mt-1 text-[14px] font-black text-[var(--fg-base)]">{runtime.transport}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                  runtime.healthy
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {runtime.healthy ? "Healthy" : "Stale"}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <RuntimeDetail label="Heartbeat" value={formatRuntimeMoment(runtime.lastHeartbeatAt)} />
              <RuntimeDetail label="Inbound" value={formatRuntimeMoment(runtime.lastInboundAt)} />
              <RuntimeDetail label="Reply" value={formatRuntimeMoment(runtime.lastReplyAt)} />
              <RuntimeDetail label="Error" value={formatRuntimeMoment(runtime.lastErrorAt)} />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {runtime.webhookUrl ? (
                <RuntimeDetail label="Webhook URL" value={runtime.webhookUrl} />
              ) : null}
              {typeof runtime.pendingUpdateCount === "number" ? (
                <RuntimeDetail label="Pending updates" value={String(runtime.pendingUpdateCount)} />
              ) : null}
              {runtime.lastErrorMessage ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">Last error</p>
                  <p className="mt-1 text-[12px] font-semibold text-rose-700">{runtime.lastErrorMessage}</p>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <WorkflowRail
        title={vi.bot.statusGrid.workflow.title}
        description={vi.bot.statusGrid.workflow.description}
        steps={[
          {
            title: vi.bot.statusGrid.workflow.syncContacts.title,
            description: vi.bot.statusGrid.workflow.syncContacts.description,
            badge: `${status?.contacts.total ?? 0} liên hệ`,
            status: loading ? "pending" : "done",
          },
          {
            title: vi.bot.statusGrid.workflow.matchCustomer.title,
            description: vi.bot.statusGrid.workflow.matchCustomer.description,
            badge: `${status?.contacts.matched ?? 0} đã ghép`,
            status: matchedCoveragePercent > 0 ? "active" : "warning",
          },
          {
            title: vi.bot.statusGrid.workflow.autoReminder.title,
            description: vi.bot.statusGrid.workflow.autoReminder.description,
            badge: `${status?.contacts.autoReminderEnabled ?? 0} đang bật`,
            status: autoReminderCoveragePercent > 0 ? "active" : "pending",
          },
          {
            title: vi.bot.statusGrid.workflow.broadcast.title,
            description: vi.bot.statusGrid.workflow.broadcast.description,
            badge: runtimeLabel,
            status: runtimeMode === "webhook-first" ? "done" : runtimeMode === "polling-fallback" ? "warning" : "pending",
          },
        ]}
      />
    </>
  );
}
