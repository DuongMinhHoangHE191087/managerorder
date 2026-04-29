"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { vi } from "@/shared/messages/vi";
import { Input } from "@/shared/ui/input";
import {
  CreateActionFooter,
  CreateFlowShell,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import type { WebhookEvent } from "@/lib/domain/types";

const ALL_EVENTS: { value: WebhookEvent; label: string; icon: string }[] = [
  { value: "order.created", label: vi.settings.webhooks.events.orderCreated, icon: "📦" },
  { value: "order.updated", label: vi.settings.webhooks.events.orderUpdated, icon: "✏️" },
  { value: "order.paid", label: vi.settings.webhooks.events.orderPaid, icon: "💳" },
  { value: "order.expired", label: vi.settings.webhooks.events.orderExpired, icon: "⏰" },
  { value: "customer.created", label: vi.settings.webhooks.events.customerCreated, icon: "👤" },
  { value: "inventory.allocated", label: vi.settings.webhooks.events.inventoryAllocated, icon: "📋" },
  { value: "payment.received", label: vi.settings.webhooks.events.paymentReceived, icon: "💰" },
] as const;

type WebhooksCreatePanelProps = {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onSubmit: (input: { url: string; events: WebhookEvent[] }) => Promise<void>;
};

function toggleEvent(list: WebhookEvent[], event: WebhookEvent): WebhookEvent[] {
  return list.includes(event) ? list.filter((current) => current !== event) : [...list, event];
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
      // Parent page already handles toast/error state.
    }
  }

  return (
    <CreateFlowShell
      title={vi.settings.webhooks.createPanel.title}
      description={vi.settings.webhooks.createPanel.description}
      footer={
        <CreateActionFooter
          primaryLabel={vi.settings.webhooks.createPanel.create}
          onPrimary={() => {
            void handleSubmit();
          }}
          onCancel={onClose}
          cancelLabel={vi.settings.webhooks.createPanel.cancel}
          pending={creating}
          disabled={!newUrl.trim() || newEvents.length === 0}
        />
      }
    >
      <CreateFormSection
        title="Endpoint nhận dữ liệu"
        description="Dán URL đích thật rõ để test delivery, retry và audit trail từ đúng nơi nhận."
      >
        <div className="space-y-2">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {vi.settings.webhooks.createPanel.endpointLabel}
          </label>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-[var(--fg-muted)]" />
            <Input
              value={newUrl}
              onChange={(event) => setNewUrl(event.target.value)}
              placeholder={vi.settings.webhooks.createPanel.endpointPlaceholder}
              name="webhook-endpoint"
              type="url"
              autoComplete="off"
              spellCheck={false}
              className="h-11 flex-1 font-mono"
            />
          </div>
        </div>
      </CreateFormSection>

      <CreateFormSection
        title="Sự kiện cần subscribe"
        description="Chỉ chọn các event thực sự cần gửi để queue webhook không bị nhiễu và dễ debug."
      >
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {vi.settings.webhooks.createPanel.eventsLabel}
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((eventItem) => {
              const selected = newEvents.includes(eventItem.value);
              return (
                <button
                  key={eventItem.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setNewEvents(toggleEvent(newEvents, eventItem.value))}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-all duration-200 ${
                    selected
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "border border-[var(--border-soft)] bg-white text-[var(--fg-muted)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  <span>{eventItem.icon}</span>
                  {eventItem.label}
                </button>
              );
            })}
          </div>
        </div>
      </CreateFormSection>
    </CreateFlowShell>
  );
}
