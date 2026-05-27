"use client";

import { Bot, RefreshCw } from "lucide-react";
import { vi } from "@/shared/messages/vi";

export function BotPageHeader({
  onRefresh,
  onSendTest,
  testPending,
}: {
  onRefresh: () => void;
  onSendTest: () => void;
  testPending: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="flex items-center gap-3 text-4xl font-bold tracking-tight text-[var(--fg-base)]">
          <Bot className="size-9 text-[var(--accent)]" />
          {vi.bot.pageHeader.title}
        </h1>
        <p className="mt-1 text-[15px] font-medium text-[var(--fg-muted)]">
          {vi.bot.pageHeader.description}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onSendTest}
          disabled={testPending}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] transition hover:border-[var(--accent)]/40 disabled:opacity-50"
          type="button"
        >
          {testPending ? "Dang gui..." : "Gui tin test"}
        </button>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] transition hover:border-[var(--accent)]/40"
          type="button"
        >
          <RefreshCw className="size-4" />
          {vi.bot.pageHeader.refresh}
        </button>
      </div>
    </div>
  );
}
