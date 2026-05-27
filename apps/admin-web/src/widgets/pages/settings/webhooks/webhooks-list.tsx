"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  Webhook as WebhookIcon,
  X,
  Zap,
} from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { vi } from "@/shared/messages/vi";
import { formatDateLabel } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { Webhook, WebhookEvent, WebhookStatus } from "@/lib/domain/types";

const ALL_EVENTS: { value: WebhookEvent; label: string; icon: string }[] = [
  { value: "order.created", label: vi.settings.webhooks.events.orderCreated, icon: "📦" },
  { value: "order.updated", label: vi.settings.webhooks.events.orderUpdated, icon: "✏️" },
  { value: "order.paid", label: vi.settings.webhooks.events.orderPaid, icon: "💳" },
  { value: "order.expired", label: vi.settings.webhooks.events.orderExpired, icon: "⏰" },
  { value: "customer.created", label: vi.settings.webhooks.events.customerCreated, icon: "👤" },
  { value: "inventory.allocated", label: vi.settings.webhooks.events.inventoryAllocated, icon: "📋" },
  { value: "payment.received", label: vi.settings.webhooks.events.paymentReceived, icon: "💰" },
] as const;

const STATUS_CONFIG: Record<WebhookStatus, { label: string; color: string; bg: string }> = {
  active: { label: vi.settings.webhooks.status.active, color: "text-emerald-600", bg: "bg-emerald-50" },
  inactive: { label: vi.settings.webhooks.status.inactive, color: "text-slate-500", bg: "bg-slate-100" },
  failed: { label: vi.settings.webhooks.status.failed, color: "text-rose-600", bg: "bg-rose-50" },
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
  return list.includes(event) ? list.filter((current) => current !== event) : [...list, event];
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
      <div className="rounded-[28px] border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)]/40 px-6 py-12 text-center">
        <WebhookIcon className="mx-auto mb-4 size-12 text-[var(--fg-muted)]/30" />
        <p className="text-[15px] font-bold text-[var(--fg-muted)]">{vi.settings.webhooks.createPanel.emptyTitle}</p>
        <p className="mt-1 text-[13px] text-[var(--fg-muted)]/70">{vi.settings.webhooks.createPanel.emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recentWebhookSecret ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-amber-900">{vi.settings.webhooks.createPanel.secretOnceTitle}</p>
              <p className="mt-1 text-[12px] text-amber-800">
                {vi.settings.webhooks.createPanel.secretOnceDescriptionPrefix}{" "}
                <span className="font-mono font-semibold">{recentWebhookSecret.url}</span>.
              </p>
              <code className="mt-3 block overflow-x-auto rounded-xl border border-amber-200 bg-white px-3 py-2 text-[12px] font-mono text-amber-950">
                {recentWebhookSecret.secret}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => void handleCopySecret(recentWebhookSecret.secret)}>
                <Copy className="size-3.5" />
                {vi.settings.webhooks.createPanel.copy}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onDismissSecret}>
                <X className="size-4" />
                Đóng
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {webhooks.map((webhook) => {
        const status = STATUS_CONFIG[webhook.status];
        const isExpanded = expandedId === webhook.id;
        const isEditing = editId === webhook.id;
        const isTesting = testingId === webhook.id;
        const rowBusy = isTesting;

        return (
          <div key={webhook.id} className="rounded-[28px] border border-[var(--border-soft)] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
              <div className="mt-1 flex items-center gap-3">
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${
                    webhook.status === "active"
                      ? "animate-pulse bg-emerald-500"
                      : webhook.status === "failed"
                        ? "bg-rose-500"
                        : "bg-slate-400"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <Input
                    value={editUrl}
                    onChange={(event) => setEditUrl(event.target.value)}
                    name={`webhook-${webhook.id}-url`}
                    type="url"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 font-mono"
                  />
                ) : (
                  <p className="truncate text-[13px] font-mono font-bold text-[var(--fg-base)]">{webhook.url}</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                  <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-2.5 py-1 text-[11px] font-bold text-[var(--fg-muted)]">
                    {vi.settings.webhooks.createPanel.eventCount(webhook.events.length)}
                  </span>
                  {webhook.failure_count > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600">
                      <AlertTriangle className="size-3" />
                      {vi.settings.webhooks.createPanel.failures(webhook.failure_count)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {isEditing ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        void handleSave(webhook.id);
                      }}
                    >
                      <Check className="size-4" />
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>
                      <X className="size-4" />
                      Hủy
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={rowBusy}
                      onClick={() => {
                        void handleTest(webhook.id);
                      }}
                    >
                      {isTesting ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Test
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={rowBusy}
                      onClick={() => {
                        void handleCopyValue(webhook.url, "URL webhook");
                      }}
                    >
                      <Copy className="size-4" />
                      URL
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={rowBusy}
                      onClick={() => {
                        setEditId(webhook.id);
                        setEditUrl(webhook.url);
                        setEditEvents(webhook.events);
                      }}
                    >
                      <Pencil className="size-4" />
                      Sửa
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={webhook.status === "active" ? "secondary" : "ghost"}
                      disabled={rowBusy}
                      onClick={() => {
                        void onToggleStatus(webhook);
                      }}
                    >
                      <Zap className="size-4" />
                      {webhook.status === "active" ? "Tạm dừng" : "Bật lại"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={rowBusy}
                      onClick={() => {
                        void onDeleteWebhook(webhook.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Xóa
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : webhook.id)}
                    >
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      Chi tiết
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isExpanded ? (
              <div className="border-t border-[var(--border-soft)] bg-[var(--surface-light)]/35 p-5">
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void handleCopyValue(webhook.url, "URL webhook");
                      }}
                    >
                      <Copy className="size-3.5" />
                      Sao chép URL
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void handleCopyValue(webhook.id, "ID webhook");
                      }}
                    >
                      <Copy className="size-3.5" />
                      Sao chép ID
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-white/80 px-4 py-4">
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                      Khóa bí mật
                    </label>
                    <p className="text-[12px] text-[var(--fg-muted)]">{vi.settings.webhooks.createPanel.secretKeyDescription}</p>
                    {webhook.secret ? (
                      <code className="mt-3 block overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-[12px] font-mono text-[var(--fg-base)]">
                        {webhook.secret}
                      </code>
                    ) : (
                      <p className="mt-3 text-[12px] text-amber-700">
                        Secret chỉ hiển thị một lần ở banner sau khi tạo webhook mới.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                      Sự kiện đã subscribe
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {isEditing
                        ? ALL_EVENTS.map((eventItem) => {
                            const selected = editEvents.includes(eventItem.value);
                            return (
                              <button
                                key={eventItem.value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setEditEvents(toggleEvent(editEvents, eventItem.value))}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${
                                  selected
                                    ? "bg-[var(--accent)] text-white"
                                    : "bg-white text-[var(--fg-muted)] border border-[var(--border-soft)]"
                                }`}
                              >
                                <span>{eventItem.icon}</span>
                                {eventItem.label}
                              </button>
                            );
                          })
                        : webhook.events.map((eventValue) => {
                            const eventInfo = ALL_EVENTS.find((item) => item.value === eventValue);
                            return (
                              <span
                                key={eventValue}
                                className="rounded-lg bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-bold text-[var(--accent)]"
                              >
                                {eventInfo?.icon} {eventInfo?.label ?? eventValue}
                              </span>
                            );
                          })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-[12px] text-[var(--fg-muted)]">
                    <span>{vi.settings.webhooks.createPanel.createdAt(formatDateLabel(webhook.created_at))}</span>
                    {webhook.last_triggered_at ? (
                      <span>{vi.settings.webhooks.createPanel.lastTriggeredAt(formatDateLabel(webhook.last_triggered_at))}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
