"use client";

import { Key, User } from "lucide-react";
import type { Customer } from "@/lib/domain/types";

interface CustomerNicksPanelProps {
  nicksRegistry: Customer["nicksRegistry"];
}

export function CustomerNicksPanel({ nicksRegistry }: CustomerNicksPanelProps) {
  return (
    <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
        <div>
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)] flex items-center gap-2">
            <Key className="text-[var(--accent)] size-5" />
            Tài khoản kết nối (Nicks)
          </h3>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
            Danh sách nick đã gắn vào khách hàng để đồng bộ nghiệp vụ.
          </p>
        </div>
        <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold px-2.5 py-1 rounded-full">
          {nicksRegistry?.length || 0} nicks
        </span>
      </div>

      {!nicksRegistry || nicksRegistry.length === 0 ? (
        <div className="py-12 text-center">
          <Key className="size-10 text-[var(--fg-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-[13px] text-[var(--fg-muted)]">Chưa có tài khoản kết nối nào</p>
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
            Gắn nick để tăng độ chính xác khi tìm kiếm và đối soát.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-soft)]">
          {nicksRegistry.map((nick, index) => (
            <div
              key={`${nick.nick}-${index}`}
              className="flex items-center justify-between gap-4 p-5 hover:bg-[var(--surface-light)]/55 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                  <User className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-[var(--fg-base)] tracking-tight">
                    {nick.nick}
                  </p>
                  <p className="text-[11px] text-[var(--fg-muted)] mt-0.5">{nick.type}</p>
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
