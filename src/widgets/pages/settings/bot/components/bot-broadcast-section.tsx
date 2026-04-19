"use client";

import { Send } from "lucide-react";
import { SectionCard } from "@/shared/ui/section-card";

export function BotBroadcastSection({
  broadcastMessage,
  broadcastPending,
  onBroadcast,
  onChange,
}: {
  broadcastMessage: string;
  broadcastPending: boolean;
  onBroadcast: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <SectionCard
      title="Telegram Broadcast"
      description="Gửi thông báo thủ công cho Telegram bot khi cần phát lệnh nhanh cho vận hành."
    >
      <div className="space-y-4">
        <textarea
          className="min-h-[140px] w-full rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          placeholder="Nhập nội dung broadcast hỗ trợ HTML Telegram..."
          value={broadcastMessage}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="flex justify-end">
          <button
            onClick={onBroadcast}
            disabled={broadcastPending || !broadcastMessage.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-[var(--accent)]/20 transition-all disabled:opacity-50"
            type="button"
          >
            <Send className="size-4" />
            {broadcastPending ? "Đang gửi..." : "Gửi broadcast"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
