"use client";

import { useState } from "react";
import { Globe, Zap } from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { vi } from "@/shared/messages/vi";
import { SectionCard } from "@/shared/ui/section-card";
import type { WebhookEvent } from "@/lib/domain/types";

const ALL_EVENTS: { value: WebhookEvent; label: string; icon: string }[] = [
  { value: "order.created", label: vi.settings.webhooks.events.orderCreated, icon: "📦" },
  { value: "order.updated", label: vi.settings.webhooks.events.orderUpdated, icon: "✏️" },
  { value: "order.paid", label: vi.settings.webhooks.events.orderPaid, icon: "💳" },
  { value: "order.expired", label: vi.settings.webhooks.events.orderExpired, icon: "⏰" },
  { value: "customer.created", label: vi.settings.webhooks.events.customerCreated, icon: "👤" },
  { value: "inventory.allocated", label: vi.settings.webhooks.events.inventoryAllocated, icon: "📋" },
  { value: "payment.received", label: vi.settings.webhooks.events.paymentReceived, icon: "💰" },
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
      appToast.error(vi.settings.webhooks.createPanel.enterUrl);
      return;
    }
    if (newEvents.length === 0) {
      appToast.error(vi.settings.webhooks.createPanel.selectAtLeastOneEvent);
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
    <SectionCard title={`➕ ${vi.settings.webhooks.createPanel.title}`} description={vi.settings.webhooks.createPanel.description}>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-1.5 uppercase tracking-wider">
            {vi.settings.webhooks.createPanel.endpointLabel}
          </label>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-[var(--fg-muted)]" />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder={vi.settings.webhooks.createPanel.endpointPlaceholder}
              className="flex-1 border border-[var(--border-soft)] rounded-xl bg-white px-4 py-2.5 text-[13px] font-mono outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-wider">
            {vi.settings.webhooks.createPanel.eventsLabel}
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
            {vi.settings.webhooks.createPanel.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white rounded-xl text-[12px] font-bold disabled:opacity-50 hover:opacity-90 transition-all shadow-md shadow-[var(--accent)]/20"
            type="button"
          >
            <Zap className="size-3.5" />
            {creating ? vi.settings.webhooks.createPanel.creating : vi.settings.webhooks.createPanel.create}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
