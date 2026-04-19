"use client";

import { Bot, RefreshCw } from "lucide-react";

export function BotPageHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="flex items-center gap-3 text-4xl font-bold tracking-tight text-[var(--fg-base)]">
          <Bot className="size-9 text-[var(--accent)]" />
          Bot Manager
        </h1>
        <p className="mt-1 text-[15px] font-medium text-[var(--fg-muted)]">
          Quản lý Telegram, Zalo contact matching, template nhắc hạn và outbound automation.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] transition hover:border-[var(--accent)]/40"
          type="button"
        >
          <RefreshCw className="size-4" />
          Làm mới
        </button>
      </div>
    </div>
  );
}
