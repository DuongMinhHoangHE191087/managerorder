"use client";

import { Send } from "lucide-react";
import { SectionCard } from "@/shared/ui/section-card";
import { vi } from "@/shared/messages/vi";

export function BotBroadcastSection({
  broadcastMessage,
  broadcastPending,
  broadcastReady,
  onBroadcast,
  onChange,
}: {
  broadcastMessage: string;
  broadcastPending: boolean;
  broadcastReady: boolean;
  onBroadcast: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <SectionCard
      title={vi.bot.broadcast.title}
      description={vi.bot.broadcast.description}
    >
      <div className="space-y-4">
        <div className={`rounded-xl border px-4 py-3 text-[12px] font-medium ${broadcastReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {broadcastReady
            ? "Broadcast da san sang gui."
            : "Broadcast chua san sang. Kiem tra runtime bot va mapping tenant truoc khi gui."}
        </div>
        <textarea
          className="min-h-[140px] w-full rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          placeholder={vi.bot.broadcast.placeholder}
          value={broadcastMessage}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="flex justify-end">
          <button
            onClick={onBroadcast}
            disabled={broadcastPending || !broadcastMessage.trim() || !broadcastReady}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-[var(--accent)]/20 transition-all disabled:opacity-50"
            type="button"
          >
            <Send className="size-4" />
            {broadcastPending ? vi.bot.broadcast.sending : vi.bot.broadcast.send}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
