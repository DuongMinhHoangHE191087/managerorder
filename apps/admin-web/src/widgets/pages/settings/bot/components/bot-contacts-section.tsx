"use client";

import Link from "next/link";
import { Copy, Link2, Loader2, Search, UserCheck } from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { SectionCard } from "@/shared/ui/section-card";
import type { BotCustomerMatchCandidate, BotUserContact } from "@/lib/domain/types";
import type { MatchFilter } from "../types";
import { vi } from "@/shared/messages/vi";

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
  actioningContactId,
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
  actioningContactId: string | null;
  onContactChannelChange: (value: "zalo" | "telegram") => void;
  onMatchFilterChange: (value: MatchFilter) => void;
  onSearchChange: (value: string) => void;
  onCandidateQueryChange: (contactId: string, value: string) => void;
  onFetchCandidates: (contact: BotUserContact) => void;
  onToggleAutoReminder: (contact: BotUserContact) => void;
  onMatch: (contactId: string, customerId: string | null) => void;
}) {
  async function copyToClipboard(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(message);
    } catch (error) {
      console.error("[copyBotContactValue]", error);
      appToast.error("Không thể sao chép vào clipboard");
    }
  }

  return (
    <SectionCard
      title={vi.bot.contacts.title}
      description={vi.bot.contacts.description}
    >
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
        <select
          value={matchFilter}
          onChange={(event) => onMatchFilterChange(event.target.value as MatchFilter)}
          className="rounded-xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
        >
          <option value="all">{vi.bot.contacts.all}</option>
          <option value="matched">{vi.bot.contacts.matched}</option>
          <option value="unmatched">{vi.bot.contacts.unmatched}</option>
        </select>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white px-3">
          <Search className="size-4 text-[var(--fg-muted)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={vi.bot.contacts.searchPlaceholder}
            className="w-full bg-transparent py-3 text-sm outline-none"
          />
        </div>
      </div>

      <div className="space-y-4">
        {contactsLoading ? (
          <div className="py-10 text-center text-sm text-[var(--fg-muted)]">{vi.bot.contacts.loading}</div>
        ) : contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-soft)] p-8 text-center text-sm text-[var(--fg-muted)]">
            {vi.bot.contacts.empty}
          </div>
        ) : (
          contacts.map((contact) => {
            const isActioning = actioningContactId === contact.id;

            return (
            <div key={contact.id} className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
                      {contact.channel.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-[var(--fg-base)]">
                      {contact.displayName || vi.bot.contacts.noName}
                    </span>
                    {contact.customerName ? (
                      <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                        {vi.bot.contacts.matchedCustomer(contact.customerName)}
                      </span>
                    ) : (
                      <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                        {vi.bot.contacts.notMatchedCustomer}
                      </span>
                    )}
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {contact.customerId ? (
                      <Link
                        href={`/customers/${contact.customerId}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2 text-[12px] font-bold text-[var(--fg-base)] transition hover:border-[var(--accent)]/40"
                      >
                        <Link2 className="size-4 text-[var(--accent)]" />
                        Xem khach hang
                      </Link>
                    ) : null}
                    <button
                      onClick={() => void copyToClipboard(contact.externalUserId, "Da sao chep external ID")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2 text-[12px] font-bold text-[var(--fg-base)] transition hover:border-[var(--accent)]/40"
                      type="button"
                    >
                      <Copy className="size-4 text-[var(--fg-muted)]" />
                      Sao chep external ID
                    </button>
                    {contact.chatId ? (
                      <button
                        onClick={() => void copyToClipboard(contact.chatId ?? "", "Da sao chep chat ID")}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2 text-[12px] font-bold text-[var(--fg-base)] transition hover:border-[var(--accent)]/40"
                        type="button"
                      >
                        <Copy className="size-4 text-[var(--fg-muted)]" />
                        Sao chep chat ID
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-[13px] text-[var(--fg-muted)] md:grid-cols-2">
                    <InfoRow label={vi.bot.contacts.externalUser} value={contact.externalUserId} />
                    <InfoRow label={vi.bot.contacts.chatId} value={contact.chatId || vi.common.notAvailable} />
                    <InfoRow label={vi.bot.contacts.lastInteraction} value={contact.lastInteractionAt || vi.common.notAvailable} />
                    <InfoRow label={vi.bot.contacts.lastMessage} value={contact.lastMessageText || vi.common.noData} />
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 xl:max-w-xl">
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border-soft)] px-3 py-2.5">
                    <div>
                      <p className="text-[12px] font-bold text-[var(--fg-base)]">{vi.bot.contacts.autoReminderTitle}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">
                        {vi.bot.contacts.autoReminderDescription}
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleAutoReminder(contact)}
                      className={`h-7 w-12 rounded-full p-0.5 ${contact.autoReminderEnabled ? "bg-emerald-500" : "bg-gray-300"} ${isActioning ? "opacity-70" : ""}`}
                      disabled={isActioning}
                      type="button"
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${contact.autoReminderEnabled ? "translate-x-5" : ""}`}
                      >
                        {isActioning ? <Loader2 className="size-4 animate-spin text-[var(--fg-muted)]" /> : null}
                      </span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-[var(--border-soft)] p-3">
                    <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[var(--fg-base)]">
                      <Link2 className="size-4 text-[var(--accent)]" />
                      {vi.bot.contacts.matchCustomer}
                    </div>
                    <div className="flex flex-col gap-2 lg:flex-row">
                      <input
                        value={candidateQuery[contact.id] ?? contact.displayName ?? ""}
                        onChange={(event) => onCandidateQueryChange(contact.id, event.target.value)}
                        placeholder={vi.bot.contacts.matchCustomerPlaceholder}
                        className="min-w-0 flex-1 rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2.5 text-sm outline-none disabled:opacity-60"
                        disabled={isActioning}
                      />
                      <button
                        onClick={() => onFetchCandidates(contact)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] px-4 py-2.5 text-[12px] font-bold text-[var(--fg-base)] transition hover:border-[var(--accent)]/40 disabled:opacity-60"
                        disabled={isActioning}
                        type="button"
                      >
                        {isActioning ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                        {vi.bot.contacts.searchCustomer}
                      </button>
                      {contact.customerId ? (
                        <button
                          onClick={() => onMatch(contact.id, null)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-[12px] font-bold text-white disabled:opacity-60"
                          disabled={isActioning}
                          type="button"
                        >
                          {vi.bot.contacts.unmatch}
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
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60"
                              disabled={isActioning}
                              type="button"
                            >
                              {isActioning ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
                              {vi.bot.contacts.matchWithCustomer}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {isActioning ? (
              <p className="mt-3 text-[11px] font-medium text-[var(--fg-muted)]">Đang cập nhật contact này...</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}
