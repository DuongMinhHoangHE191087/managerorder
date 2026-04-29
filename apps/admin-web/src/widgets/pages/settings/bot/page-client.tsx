"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { SectionCard } from "@/shared/ui/section-card";
import { useBotRuntimeStatus } from "@/shared/hooks/use-bot-runtime-status";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import { appToast } from "@/shared/lib/toast";
import { fetcher } from "@/lib/api/fetcher";
import type { BotCustomerMatchCandidate, BotUserContact } from "@/lib/domain/types";
import { BotBroadcastSection } from "./components/bot-broadcast-section";
import { BotContactsSection } from "./components/bot-contacts-section";
import { BotPageHeader } from "./components/bot-page-header";
import { BotStatusGrid } from "./components/bot-status-grid";
import type { MatchFilter } from "./types";
import { vi } from "@/shared/messages/vi";

export default function BotManagementPage() {
  const queryClient = useQueryClient();
  const text = vi.bot.page;
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [contactChannel, setContactChannel] = useState<"zalo" | "telegram">("zalo");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [search, setSearch] = useState("");
  const [candidateQuery, setCandidateQuery] = useState<Record<string, string>>({});
  const [candidates, setCandidates] = useState<Record<string, BotCustomerMatchCandidate[]>>({});
  const [actioningContactId, setActioningContactId] = useState<string | null>(null);
  const [testLookupQuery, setTestLookupQuery] = useState("");
  const [testLookupPreview, setTestLookupPreview] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useBotRuntimeStatus();

  const contactsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("channel", contactChannel);
    if (search.trim()) params.set("search", search.trim());
    if (matchFilter === "matched") params.set("matched", "true");
    if (matchFilter === "unmatched") params.set("matched", "false");
    return params.toString();
  }, [contactChannel, matchFilter, search]);

  const { data: contacts = [], isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: ["settings", "bot", "contacts", contactsQueryString],
    queryFn: () => fetcher<BotUserContact[]>(`/api/settings/bot/contacts?${contactsQueryString}`),
  });

  const updateContactMutation = useMutation({
    mutationFn: (payload: { contactId: string; customerId?: string | null; autoReminderEnabled?: boolean }) =>
      fetcher<BotUserContact>("/api/settings/bot/contacts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "bot", "contacts"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.botStatus }),
      ]);
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: (message: string) =>
      fetcher("/api/telegram/broadcast", {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
  });

  const testLookupMutation = useMutation({
    mutationFn: (query: string) =>
      fetcher<{ query: string; count: number; replyPreview: string }>("/api/settings/bot/test-lookup", {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
    onSuccess: (result) => {
      setTestLookupPreview(result.replyPreview);
      appToast.success(`Lookup trả về ${result.count} kết quả`);
    },
    onError: (error: Error) => {
      setTestLookupPreview(null);
      appToast.error(error.message || "Không thể test lookup");
    },
  });

  const handleRefresh = () => {
    refetchStatus();
    refetchContacts();
  };

  async function handleBroadcast() {
    if (!broadcastMessage.trim()) {
      appToast.error(text.broadcastRequired);
      return;
    }

    appToast.loading(text.sendingBroadcast, { id: "bot-broadcast" });
    try {
      await broadcastMutation.mutateAsync(broadcastMessage.trim());
      appToast.success(text.broadcastSent, { id: "bot-broadcast" });
      setBroadcastMessage("");
    } catch {
      appToast.error(text.broadcastFailed, { id: "bot-broadcast" });
    }
  }

  async function handleTestLookup() {
    const query = testLookupQuery.trim();
    if (!query) {
      appToast.error("Nhập mã đơn hoặc SĐT để test lookup");
      return;
    }

    await testLookupMutation.mutateAsync(query);
  }

  async function fetchCandidates(contact: BotUserContact) {
    const query = (candidateQuery[contact.id] ?? contact.displayName ?? contact.externalUserId).trim();
    if (!query) {
      appToast.error(text.candidateQueryRequired);
      return;
    }

    try {
      const result = await fetcher<BotCustomerMatchCandidate[]>(`/api/settings/bot/customers?q=${encodeURIComponent(query)}`);
      setCandidates((prev) => ({ ...prev, [contact.id]: result }));
      if (result.length === 0) {
        appToast.info(text.candidateLookupEmpty);
      }
    } catch {
      appToast.error(text.candidateLookupFailed);
    }
  }

  async function handleMatch(contactId: string, customerId: string | null) {
    setActioningContactId(contactId);
    try {
      await updateContactMutation.mutateAsync({ contactId, customerId });
      appToast.success(customerId ? text.contactMatched : text.contactUnmatched);
    } catch {
      appToast.error(text.updateContactFailed);
    } finally {
      setActioningContactId((current) => (current === contactId ? null : current));
    }
  }

  async function toggleAutoReminder(contact: BotUserContact) {
    setActioningContactId(contact.id);
    try {
      await updateContactMutation.mutateAsync({
        contactId: contact.id,
        autoReminderEnabled: !contact.autoReminderEnabled,
      });
      appToast.success(text.updatedReminder);
    } catch {
      appToast.error(text.updateReminderFailed);
    } finally {
      setActioningContactId((current) => (current === contact.id ? null : current));
    }
  }

  return (
    <AppLayout>
      <PageContainer className="flex flex-col gap-6">
        <BotPageHeader onRefresh={handleRefresh} />
        <BotStatusGrid status={status} loading={statusLoading} />
        <SectionCard
          title="Kiểm tra tra cứu Zalo nội bộ"
          description="Kiểm tra nhanh cùng contract với lệnh /kt, /kiemtra và tra cứu đơn trước khi dùng trên bot thật."
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={testLookupQuery}
              onChange={(event) => setTestLookupQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleTestLookup();
                }
              }}
              placeholder="Nhập mã đơn hoặc SĐT, ví dụ DMH_A1B2 hoặc 0901234567"
              className="h-12 rounded-2xl border border-[var(--border-soft)] bg-white px-4 text-sm font-semibold text-[var(--fg-base)] outline-none transition-colors placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            />
            <button
              type="button"
              onClick={() => void handleTestLookup()}
              disabled={testLookupMutation.isPending}
              className="h-12 rounded-2xl bg-[var(--accent)] px-5 text-sm font-black text-white shadow-lg shadow-emerald-700/15 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {testLookupMutation.isPending ? "Đang kiểm tra..." : "Chạy kiểm tra"}
            </button>
          </div>
          {testLookupPreview ? (
            <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--border-soft)] bg-slate-950 p-4 text-[12px] font-semibold leading-6 text-emerald-50">
              {testLookupPreview}
            </pre>
          ) : null}
        </SectionCard>
        <BotContactsSection
          contacts={contacts}
          contactsLoading={contactsLoading}
          contactChannel={contactChannel}
          matchFilter={matchFilter}
          search={search}
          candidateQuery={candidateQuery}
          candidates={candidates}
          actioningContactId={actioningContactId}
          onContactChannelChange={setContactChannel}
          onMatchFilterChange={setMatchFilter}
          onSearchChange={setSearch}
          onCandidateQueryChange={(contactId, value) =>
            setCandidateQuery((prev) => ({ ...prev, [contactId]: value }))
          }
          onFetchCandidates={fetchCandidates}
          onToggleAutoReminder={toggleAutoReminder}
          onMatch={handleMatch}
        />
        <BotBroadcastSection
          broadcastMessage={broadcastMessage}
          broadcastPending={broadcastMutation.isPending}
          broadcastReady={status?.operational.broadcastReady ?? false}
          onBroadcast={handleBroadcast}
          onChange={setBroadcastMessage}
        />
      </PageContainer>
    </AppLayout>
  );
}
