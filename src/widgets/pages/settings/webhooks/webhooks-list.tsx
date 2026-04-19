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
import { formatDateLabel } from "@/lib/utils";
import type { Webhook, WebhookEvent, WebhookStatus } from "@/lib/domain/types";

const ALL_EVENTS: { value: WebhookEvent; label: string; icon: string }[] = [
  { value: "order.created", label: "Đơn hàng mới", icon: "📦" },
  { value: "order.updated", label: "Đơn cập nhật", icon: "✏️" },
  { value: "order.paid", label: "Thanh toán thành công", icon: "💳" },
  { value: "order.expired", label: "Đơn hết hạn", icon: "⏰" },
  { value: "customer.created", label: "Khách hàng mới", icon: "👤" },
  { value: "inventory.allocated", label: "Cấp phát inventory", icon: "📋" },
  { value: "payment.received", label: "Nhận thanh toán", icon: "💰" },
];

const STATUS_CONFIG: Record<WebhookStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "text-emerald-600", bg: "bg-emerald-50" },
  inactive: { label: "Inactive", color: "text-gray-500", bg: "bg-gray-50" },
  failed: { label: "Failed", color: "text-red-600", bg: "bg-red-50" },
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
  onUpdateWebhook: (input: { id: string; url: string; events: WebhookEvent[] }) => Promise<void>;
  onTestWebhook: (id: string) => Promise<void>;
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
      appToast.info("Đã copy secret key");
    } catch {
      appToast.error("Không thể copy secret key");
    }
  }

  async function handleSave(id: string) {
    await onUpdateWebhook({ id, url: editUrl, events: editEvents });
    setEditId(null);
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
        <p className="text-[15px] font-bold text-[var(--fg-muted)]">Chưa có webhook nào</p>
        <p className="text-[13px] text-[var(--fg-muted)]/60 mt-1">Tạo webhook đầu tiên để nhận thông báo real-time</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recentWebhookSecret && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-amber-900">Secret webhook chỉ hiển thị một lần</p>
              <p className="text-[12px] text-amber-800 mt-1">
                Hãy lưu ngay secret này cho endpoint{" "}
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
                Copy
              </button>
              <button
                onClick={onDismissSecret}
                className="p-2 text-amber-700 hover:text-amber-950 rounded-xl transition-colors"
                aria-label="Dismiss secret banner"
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
                  <span className="text-[11px] text-[var(--fg-muted)]">{wh.events.length} events</span>
                  {wh.failure_count > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-red-500">
                      <AlertTriangle className="size-3" />
                      {wh.failure_count} failures
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
                      disabled={isTesting}
                      title="Gửi test"
                      className="p-2 text-[var(--fg-muted)] hover:text-[var(--accent)] rounded-lg transition-colors disabled:opacity-50"
                      type="button"
                    >
                      {isTesting ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setEditId(wh.id);
                        setEditUrl(wh.url);
                        setEditEvents(wh.events);
                      }}
                      title="Sửa"
                      className="p-2 text-[var(--fg-muted)] hover:text-[var(--accent)] rounded-lg transition-colors"
                      type="button"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => onToggleStatus(wh)}
                      title={wh.status === "active" ? "Tắt" : "Bật"}
                      className={`p-2 rounded-lg transition-colors ${
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
                      title="Xoá"
                      className="p-2 text-[var(--fg-muted)] hover:text-red-500 rounded-lg transition-colors"
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : wh.id)}
                      className="p-2 text-[var(--fg-muted)] hover:text-[var(--fg-base)] rounded-lg transition-colors"
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
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-1.5 uppercase tracking-wider">
                      🔑 Secret Key
                    </label>
                    <div className="rounded-xl border border-dashed border-[var(--border-soft)] bg-white/60 px-3 py-3">
                      <p className="text-[12px] text-[var(--fg-muted)]">
                        Secret không còn được hiển thị trong danh sách. Nó chỉ xuất hiện ngay sau khi tạo webhook để bạn sao
                        chép một lần.
                      </p>
                      {wh.secret && (
                        <code className="mt-2 block overflow-x-auto px-3 py-2 bg-white border border-[var(--border-soft)] rounded-lg text-[12px] font-mono text-[var(--fg-muted)]">
                          {wh.secret}
                        </code>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-wider">
                      📡 Subscribed Events
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
                    <span>Tạo: {formatDateLabel(wh.created_at)}</span>
                    {wh.last_triggered_at && <span>Gửi lần cuối: {formatDateLabel(wh.last_triggered_at)}</span>}
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
