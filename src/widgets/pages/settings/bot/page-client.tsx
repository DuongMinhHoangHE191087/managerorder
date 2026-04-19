"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
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

export default function BotManagementPage() {
  const queryClient = useQueryClient();
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [contactChannel, setContactChannel] = useState<"zalo" | "telegram">("zalo");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [search, setSearch] = useState("");
  const [candidateQuery, setCandidateQuery] = useState<Record<string, string>>({});
  const [candidates, setCandidates] = useState<Record<string, BotCustomerMatchCandidate[]>>({});

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

  const handleRefresh = () => {
    refetchStatus();
    refetchContacts();
  };

  async function handleBroadcast() {
    if (!broadcastMessage.trim()) {
      appToast.error("Vui lòng nhập nội dung broadcast");
      return;
    }

    appToast.loading("Đang gửi broadcast...", { id: "bot-broadcast" });
    try {
      await broadcastMutation.mutateAsync(broadcastMessage.trim());
      appToast.success("Đã gửi broadcast", { id: "bot-broadcast" });
      setBroadcastMessage("");
    } catch {
      appToast.error("Gửi broadcast thất bại", { id: "bot-broadcast" });
    }
  }

  async function fetchCandidates(contact: BotUserContact) {
    const query = (candidateQuery[contact.id] ?? contact.displayName ?? contact.externalUserId).trim();
    if (!query) {
      appToast.error("Thiếu từ khóa tìm khách hàng");
      return;
    }

    try {
      const result = await fetcher<BotCustomerMatchCandidate[]>(`/api/settings/bot/customers?q=${encodeURIComponent(query)}`);
      setCandidates((prev) => ({ ...prev, [contact.id]: result }));
      if (result.length === 0) {
        appToast.info("Không tìm thấy khách hàng phù hợp");
      }
    } catch {
      appToast.error("Tra cứu khách hàng thất bại");
    }
  }

  async function handleMatch(contactId: string, customerId: string | null) {
    try {
      await updateContactMutation.mutateAsync({ contactId, customerId });
      appToast.success(customerId ? "Đã ghép khách hàng" : "Đã bỏ ghép khách hàng");
    } catch {
      appToast.error("Cập nhật ghép khách hàng thất bại");
    }
  }

  async function toggleAutoReminder(contact: BotUserContact) {
    try {
      await updateContactMutation.mutateAsync({
        contactId: contact.id,
        autoReminderEnabled: !contact.autoReminderEnabled,
      });
      appToast.success("Đã cập nhật auto reminder");
    } catch {
      appToast.error("Không thể cập nhật auto reminder");
    }
  }

  return (
    <AppLayout>
      <PageContainer className="flex flex-col gap-6">
        <BotPageHeader onRefresh={handleRefresh} />
        <BotStatusGrid status={status} loading={statusLoading} />
        <BotContactsSection
          contacts={contacts}
          contactsLoading={contactsLoading}
          contactChannel={contactChannel}
          matchFilter={matchFilter}
          search={search}
          candidateQuery={candidateQuery}
          candidates={candidates}
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
          onBroadcast={handleBroadcast}
          onChange={setBroadcastMessage}
        />
      </PageContainer>
    </AppLayout>
  );
}
