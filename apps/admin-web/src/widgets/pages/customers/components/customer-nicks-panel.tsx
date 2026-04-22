"use client";

import { Key, User } from "lucide-react";
import { vi } from "@/shared/messages/vi";
import type { Customer } from "@/lib/domain/types";

interface CustomerNicksPanelProps {
  nicksRegistry: Customer["nicksRegistry"];
}

const text = vi.customers.detail.nicksPanel;

export function CustomerNicksPanel({ nicksRegistry }: CustomerNicksPanelProps) {
  return (
    <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-[var(--fg-base)]">
            <Key className="size-5 text-[var(--accent)]" />
            {text.title}
          </h3>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{text.description}</p>
        </div>
        <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
          {nicksRegistry?.length || 0} {text.countSuffix}
        </span>
      </div>

      {!nicksRegistry || nicksRegistry.length === 0 ? (
        <div className="py-12 text-center">
          <Key className="mx-auto mb-3 size-10 text-[var(--fg-muted)] opacity-30" />
          <p className="text-[13px] text-[var(--fg-muted)]">{text.emptyTitle}</p>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{text.emptyDescription}</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)]">
          {nicksRegistry.map((nick, index) => (
            <div
              key={`${nick.nick}-${index}`}
              className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-[var(--surface-light)]/55"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                  <User className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold tracking-tight text-[var(--fg-base)]">
                    {nick.nick}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{nick.type}</p>
                </div>
              </div>
              {nick.notes && (
                <span className="max-w-[200px] truncate text-right text-[12px] italic text-[var(--fg-muted)]">
                  {nick.notes}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
