"use client";

import { useState } from "react";
import {
  Trash2,
  Pencil,
  Check,
  X,
  Copy,
  Send,
  Globe,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { vi } from "@/shared/messages/vi";
import { formatDateLabel } from "@/lib/utils";
import type { Webhook, WebhookEvent, WebhookStatus } from "@/lib/domain/types";

const ALL_EVENTS: { value: WebhookEvent; label: string; icon: string }[] = [
  { value: "order.created", label: vi.settings.webhooks.events.orderCreated, icon: "📦" },
  { value: "order.updated", label: vi.settings.webhooks.events.orderUpdated, icon: "✏️" },
  { value: "order.paid", label: vi.settings.webhooks.events.orderPaid, icon: "💳" },
  { value: "order.expired", label: vi.settings.webhooks.events.orderExpired, icon: "⏰" },
  { value: "customer.created", label: vi.settings.webhooks.events.customerCreated, icon: "👤" },
  { value: "inventory.allocated", label: vi.settings.webhooks.events.inventoryAllocated, icon: "📋" },
  { value: "payment.received", label: vi.settings.webhooks.events.paymentReceived, icon: "💰" },
];

const STATUS_CONFIG: Record<WebhookStatus, { label: string; color: string; bg: string }> = {
  active: { label: vi.settings.webhooks.status.active, color: "text-emerald-600", bg: "bg-emerald-50" },
  inactive: { label: vi.settings.webhooks.status.inactive, color: "text-gray-500", bg: "bg-gray-50" },
  failed: { label: vi.settings.webhooks.status.failed, color: "text-red-600", bg: "bg-red-50" },
};

type RecentWebhookSecret = {
  id: string;
  url: string;
  secret: string;
} | null;

type WebhooksListProps = {
  webhooks: Webhook[];
  recentWebhookSecret: RecentWebhookSecret;
  onDismissSecret: () => void;
  onDeleteWebhook: (id: string) => Promise<void>;
  onToggleStatus: (webhook: Webhook) => Promise<void>;
  onUpdateWebhook: (input: { id: string; url: string; events: WebhookEvent[] }) => Promise<boolean>;
  onTestWebhook: (id: string) => Promise<boolean>;
};

function toggleEvent(list: WebhookEvent[], event: WebhookEvent): WebhookEvent[] {
  return list.includes(event) ? list.filter((e) => e !== event) : [...list, event];
}

export function WebhooksList({
  webhooks,
  recentWebhookSecret,
  onDismissSecret,
  onDeleteWebhook,
  onToggleStatus,
  onUpdateWebhook,
  onTestWebhook,
}: WebhooksListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState<WebhookEvent[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function handleCopySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      appToast.info(vi.settings.webhooks.createPanel.secretCopied);
    } catch {
      appToast.error(vi.settings.webhooks.createPanel.secretCopyFailed);
    }
  }

  async function handleCopyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.info(`Đã sao chép ${label}`);
    } catch {
      appToast.error(`Không thể sao chép ${label}`);
    }
  }

  async function handleSave(id: string) {
    const success = await onUpdateWebhook({ id, url: editUrl, events: editEvents });
    if (success) {
      setEditId(null);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await onTestWebhook(id);
    } finally {
      setTestingId(null);
    }
  }

  if (webhooks.length === 0) {
    return (
      <div className="glass-card text-center py-16">
        <Globe className="size-12 text-[var(--fg-muted)]/30 mx-auto mb-4" />
        <p className="text-[15px] font-bold text-[var(--fg-muted)]">{vi.settings.webhooks.createPanel.emptyTitle}</p>
        <p className="text-[13px] text-[var(--fg-muted)]/60 mt-1">{vi.settings.webhooks.createPanel.emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recentWebhookSecret && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-amber-900">{vi.settings.webhooks.createPanel.secretOnceTitle}</p>
              <p className="text-[12px] text-amber-800 mt-1">
                {vi.settings.webhooks.createPanel.secretOnceDescriptionPrefix}{" "}
                <span className="font-mono font-semibold">{recentWebhookSecret.url}</span>.
              </p>
              <code className="mt-3 block overflow-x-auto rounded-xl bg-white px-3 py-2 text-[12px] font-mono text-amber-950 border border-amber-200">
                {recentWebhookSecret.secret}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopySecret(recentWebhookSecret.secret)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-amber-500 transition-colors"
                type="button"
              >
                <Copy className="size-3.5" />
                {vi.settings.webhooks.createPanel.copy}
              </button>
              <button
                onClick={onDismissSecret}
                className="p-2 text-amber-700 hover:text-amber-950 rounded-xl transition-colors"
                aria-label={vi.settings.webhooks.createPanel.dismiss}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {webhooks.map((wh) => {
        const statusCfg = STATUS_CONFIG[wh.status];
        const isExpanded = expandedId === wh.id;
        const isEditing = editId === wh.id;
        const isTesting = testingId === wh.id;
        const rowBusy = isTesting;

        return (
          <div key={wh.id} className="glass-card overflow-hidden">
            <div className="p-5 flex items-center gap-4">
              <div
                className={`w-3 h-3 rounded-full ${
                  wh.status === "active"
                    ? "bg-emerald-500 animate-pulse"
                    : wh.status === "failed"
                    ? "bg-red-500"
                    : "bg-gray-400"
                }`}
              />

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full border border-[var(--border-soft)] rounded-lg bg-white px-3 py-1.5 text-[13px] font-mono outline-none focus:border-[var(--accent)]"
                  />
                ) : (
                  <p className="text-[13px] font-mono font-bold text-[var(--fg-base)] truncate">{wh.url}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusCfg.color} ${statusCfg.bg}`}>
                    {statusCfg.label}
                  </span>
                  <span className="text-[11px] text-[var(--fg-muted)]">
                    {vi.settings.webhooks.createPanel.eventCount(wh.events.length)}
                  </span>
                  {wh.failure_count > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-red-500">
                      <AlertTriangle className="size-3" />
                      {vi.settings.webhooks.createPanel.failures(wh.failure_count)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => handleSave(wh.id)}
                      className="p-2 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
                      type="button"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="p-2 text-[var(--fg-muted)] hover:text-red-500 rounded-lg transition-colors"
                      type="button"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleTest(wh.id)}
                      disabled={rowBusy}
                      title={vi.settings.webhooks.createPanel.test}
                      className="p-2 text-[var(--fg-muted)] hover:text-[var(--accent)] rounded-lg transition-colors disabled:opacity-50"
                      type="button"
                    >
                      {isTesting ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </button>
                    <button
                      onClick={() => handleCopyValue(wh.url, "URL webhook")}
                      disabled={rowBusy}
                      title="Sao chép URL webhook"
                      className="p-2 text-[var(--fg-muted)] hover:text-[var(--accent)] rounded-lg transition-colors disabled:opacity-50"
                      type="button"
                    >
                      <Copy className="size-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditId(wh.id);
                        setEditUrl(wh.url);
                        setEditEvents(wh.events);
                      }}
                      title={vi.settings.webhooks.createPanel.edit}
                      disabled={rowBusy}
                      className="p-2 text-[var(--fg-muted)] hover:text-[var(--accent)] rounded-lg transition-colors disabled:opacity-50"
                      type="button"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => onToggleStatus(wh)}
                      title={wh.status === "active" ? vi.settings.webhooks.createPanel.toggleOff : vi.settings.webhooks.createPanel.toggleOn}
                      disabled={rowBusy}
                      className={`p-2 rounded-lg transition-colors ${
                        rowBusy ? "opacity-50" : ""
                      } ${
                        wh.status === "active"
                          ? "text-emerald-500 hover:bg-emerald-50"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                      type="button"
                    >
                      <Zap className="size-4" />
                    </button>
                    <button
                      onClick={() => onDeleteWebhook(wh.id)}
                      title={vi.settings.webhooks.createPanel.delete}
                      disabled={rowBusy}
                      className="p-2 text-[var(--fg-muted)] hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : wh.id)}
                      disabled={rowBusy}
                      className="p-2 text-[var(--fg-muted)] hover:text-[var(--fg-base)] rounded-lg transition-colors disabled:opacity-50"
                      type="button"
                    >
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  </>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-[var(--border-soft)]">
                <div className="p-5 space-y-4 bg-[var(--bg-app)]/50">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleCopyValue(wh.url, "URL webhook")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--fg-muted)] hover:border-[var(--accent)]/30 hover:text-[var(--fg-base)] transition-colors"
                      type="button"
                    >
                      <Copy className="size-3.5" />
                      Sao chép URL
                    </button>
                    <button
                      onClick={() => handleCopyValue(wh.id, "ID webhook")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--fg-muted)] hover:border-[var(--accent)]/30 hover:text-[var(--fg-base)] transition-colors"
                      type="button"
                    >
                      <Copy className="size-3.5" />
                      Sao chép ID
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-1.5 uppercase tracking-wider">
                      🔑 {vi.settings.webhooks.createPanel.secretKeyLabel}
                    </label>
                    <div className="rounded-xl border border-dashed border-[var(--border-soft)] bg-white/60 px-3 py-3">
                      <p className="text-[12px] text-[var(--fg-muted)]">{vi.settings.webhooks.createPanel.secretKeyDescription}</p>
                      {wh.secret ? (
                        <code className="mt-2 block overflow-x-auto px-3 py-2 bg-white border border-[var(--border-soft)] rounded-lg text-[12px] font-mono text-[var(--fg-muted)]">
                          {wh.secret}
                        </code>
                      ) : (
                        <p className="mt-2 text-[12px] text-amber-700">
                          Secret chỉ xuất hiện một lần ở banner sau khi tạo webhook mới.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-wider">
                      📡 {vi.settings.webhooks.createPanel.subscribedEventsLabel}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {isEditing
                        ? ALL_EVENTS.map((evt) => {
                            const selected = editEvents.includes(evt.value);
                            return (
                              <button
                                key={evt.value}
                                onClick={() => setEditEvents(toggleEvent(editEvents, evt.value))}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                  selected
                                    ? "bg-[var(--accent)] text-white"
                                    : "bg-gray-100 text-[var(--fg-muted)]"
                                }`}
                                type="button"
                              >
                                <span>{evt.icon}</span>
                                {evt.label}
                              </button>
                            );
                          })
                        : wh.events.map((ev) => {
                            const evtInfo = ALL_EVENTS.find((e) => e.value === ev);
                            return (
                              <span
                                key={ev}
                                className="px-2.5 py-1 text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 rounded-lg"
                              >
                                {evtInfo?.icon} {evtInfo?.label ?? ev}
                              </span>
                            );
                          })}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-[11px] text-[var(--fg-muted)]">
                    <span>{vi.settings.webhooks.createPanel.createdAt(formatDateLabel(wh.created_at))}</span>
                    {wh.last_triggered_at && <span>{vi.settings.webhooks.createPanel.lastTriggeredAt(formatDateLabel(wh.last_triggered_at))}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
