"use client";

import { useState } from "react";
import { Globe, Zap } from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { SectionCard } from "@/shared/ui/section-card";
import type { WebhookEvent } from "@/lib/domain/types";

const ALL_EVENTS: { value: WebhookEvent; label: string; icon: string }[] = [
  { value: "order.created", label: "Đơn hàng mới", icon: "📦" },
  { value: "order.updated", label: "Đơn cập nhật", icon: "✏️" },
  { value: "order.paid", label: "Thanh toán thành công", icon: "💳" },
  { value: "order.expired", label: "Đơn hết hạn", icon: "⏰" },
  { value: "customer.created", label: "Khách hàng mới", icon: "👤" },
  { value: "inventory.allocated", label: "Cấp phát inventory", icon: "📋" },
  { value: "payment.received", label: "Nhận thanh toán", icon: "💰" },
];

type WebhooksCreatePanelProps = {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: { url: string; events: WebhookEvent[] }) => Promise<void>;
};

function toggleEvent(list: WebhookEvent[], event: WebhookEvent): WebhookEvent[] {
  return list.includes(event) ? list.filter((e) => e !== event) : [...list, event];
}

export function WebhooksCreatePanel({
  open,
  creating,
  onClose,
  onSubmit,
}: WebhooksCreatePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <WebhooksCreatePanelContent
      creating={creating}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function WebhooksCreatePanelContent({
  creating,
  onClose,
  onSubmit,
}: Omit<WebhooksCreatePanelProps, "open">) {
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<WebhookEvent[]>([]);

  async function handleSubmit() {
    const url = newUrl.trim();
    if (!url) {
      appToast.error("Vui lòng nhập URL");
      return;
    }
    if (newEvents.length === 0) {
      appToast.error("Chọn ít nhất 1 event");
      return;
    }

    try {
      await onSubmit({ url, events: newEvents });
      setNewUrl("");
      setNewEvents([]);
      onClose();
    } catch {
      // Error feedback is handled by the parent page.
    }
  }

  return (
    <SectionCard title="➕ Tạo Webhook mới" description="Nhập URL endpoint và chọn events cần nhận">
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-1.5 uppercase tracking-wider">
            Endpoint URL
          </label>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-[var(--fg-muted)]" />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="flex-1 border border-[var(--border-soft)] rounded-xl bg-white px-4 py-2.5 text-[13px] font-mono outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-wider">
            Events
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((evt) => {
              const selected = newEvents.includes(evt.value);
              return (
                <button
                  key={evt.value}
                  onClick={() => setNewEvents(toggleEvent(newEvents, evt.value))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                    selected
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "bg-white border border-[var(--border-soft)] text-[var(--fg-muted)] hover:border-[var(--accent)]/40"
                  }`}
                  type="button"
                >
                  <span>{evt.icon}</span>
                  {evt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-bold text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors"
            type="button"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white rounded-xl text-[12px] font-bold disabled:opacity-50 hover:opacity-90 transition-all shadow-md shadow-[var(--accent)]/20"
            type="button"
          >
            <Zap className="size-3.5" />
            {creating ? "Đang tạo..." : "Tạo Webhook"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
