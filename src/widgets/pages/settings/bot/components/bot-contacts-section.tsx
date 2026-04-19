"use client";

import { Link2, Search, UserCheck } from "lucide-react";
import { SectionCard } from "@/shared/ui/section-card";
import type { BotCustomerMatchCandidate, BotUserContact } from "@/lib/domain/types";
import type { MatchFilter } from "../types";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-light)] px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{label}</div>
      <div className="mt-1 break-all text-[13px] text-[var(--fg-base)]">{value}</div>
    </div>
  );
}

export function BotContactsSection({
  contacts,
  contactsLoading,
  contactChannel,
  matchFilter,
  search,
  candidateQuery,
  candidates,
  onContactChannelChange,
  onMatchFilterChange,
  onSearchChange,
  onCandidateQueryChange,
  onFetchCandidates,
  onToggleAutoReminder,
  onMatch,
}: {
  contacts: BotUserContact[];
  contactsLoading: boolean;
  contactChannel: "zalo" | "telegram";
  matchFilter: MatchFilter;
  search: string;
  candidateQuery: Record<string, string>;
  candidates: Record<string, BotCustomerMatchCandidate[]>;
  onContactChannelChange: (value: "zalo" | "telegram") => void;
  onMatchFilterChange: (value: MatchFilter) => void;
  onSearchChange: (value: string) => void;
  onCandidateQueryChange: (contactId: string, value: string) => void;
  onFetchCandidates: (contact: BotUserContact) => void;
  onToggleAutoReminder: (contact: BotUserContact) => void;
  onMatch: (contactId: string, customerId: string | null) => void;
}) {
  return (
    <SectionCard
      title="Bot User Contacts"
      description="Danh sách user từ bot, ghép với customer, và bật/tắt auto reminder theo từng contact."
    >
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
        <select
          value={contactChannel}
          onChange={(event) => onContactChannelChange(event.target.value as "zalo" | "telegram")}
          className="rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
        >
          <option value="zalo">Zalo contacts</option>
          <option value="telegram">Telegram contacts</option>
        </select>
        <select
          value={matchFilter}
          onChange={(event) => onMatchFilterChange(event.target.value as MatchFilter)}
          className="rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
        >
          <option value="all">Tất cả</option>
          <option value="matched">Đã ghép</option>
          <option value="unmatched">Chưa ghép</option>
        </select>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-3">
          <Search className="size-4 text-[var(--fg-muted)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm theo tên hiển thị, user id, chat id, phone..."
            className="w-full bg-transparent py-3 text-sm outline-none"
          />
        </div>
      </div>

      <div className="space-y-4">
        {contactsLoading ? (
          <div className="py-10 text-center text-sm text-[var(--fg-muted)]">Đang tải bot contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-soft)] p-8 text-center text-sm text-[var(--fg-muted)]">
            Chưa có contact nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
                      {contact.channel.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-[var(--fg-base)]">
                      {contact.displayName || "Không có tên hiển thị"}
                    </span>
                    {contact.customerName ? (
                      <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                        Đã ghép: {contact.customerName}
                      </span>
                    ) : (
                      <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                        Chưa ghép customer
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-[13px] text-[var(--fg-muted)] md:grid-cols-2">
                    <InfoRow label="External user" value={contact.externalUserId} />
                    <InfoRow label="Chat ID" value={contact.chatId || "N/A"} />
                    <InfoRow label="Lần tương tác cuối" value={contact.lastInteractionAt || "N/A"} />
                    <InfoRow label="Tin nhắn gần nhất" value={contact.lastMessageText || "Không có"} />
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 xl:max-w-xl">
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border-soft)] px-3 py-2.5">
                    <div>
                      <p className="text-[12px] font-bold text-[var(--fg-base)]">Auto renewal reminder</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">
                        Chỉ gửi khi contact đã match và cron bật auto_send.
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleAutoReminder(contact)}
                      className={`h-7 w-12 rounded-full p-0.5 ${contact.autoReminderEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
                      type="button"
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${contact.autoReminderEnabled ? "translate-x-5" : ""}`}
                      />
                    </button>
                  </div>

                  <div className="rounded-xl border border-[var(--border-soft)] p-3">
                    <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[var(--fg-base)]">
                      <Link2 className="size-4 text-[var(--accent)]" />
                      Match customer
                    </div>
                    <div className="flex flex-col gap-2 lg:flex-row">
                      <input
                        value={candidateQuery[contact.id] ?? contact.displayName ?? ""}
                        onChange={(event) => onCandidateQueryChange(contact.id, event.target.value)}
                        placeholder="Tên khách / SĐT / Zalo / Telegram..."
                        className="min-w-0 flex-1 rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2.5 text-sm outline-none"
                      />
                      <button
                        onClick={() => onFetchCandidates(contact)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] px-4 py-2.5 text-[12px] font-bold text-[var(--fg-base)] transition hover:border-[var(--accent)]/40"
                        type="button"
                      >
                        <Search className="size-4" />
                        Tìm khách hàng
                      </button>
                      {contact.customerId ? (
                        <button
                          onClick={() => onMatch(contact.id, null)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-[12px] font-bold text-white"
                          type="button"
                        >
                          Bỏ ghép
                        </button>
                      ) : null}
                    </div>

                    {(candidates[contact.id] ?? []).length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {(candidates[contact.id] ?? []).map((candidate) => (
                          <div
                            key={candidate.id}
                            className="flex flex-col gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[var(--fg-base)]">{candidate.name}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-muted)]">
                                {candidate.contacts.map((item, index) => (
                                  <span key={`${candidate.id}-${index}`} className="rounded-lg bg-white px-2 py-1">
                                    {item.type}: {item.value}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => onMatch(contact.id, candidate.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white"
                              type="button"
                            >
                              <UserCheck className="size-4" />
                              Ghép với khách này
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
