"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { appToast } from "@/shared/lib/toast";
import { vi } from "@/shared/messages/vi";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { Webhook, WebhookEvent, WebhookStatus } from "@/lib/domain/types";
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
} from "@/widgets/pages/settings/hooks/use-settings";

type RecentWebhookSecret = {
  id: string;
  url: string;
  secret: string;
} | null;

const WebhooksCreatePanel = dynamic(
  () => import("./webhooks-create-panel").then((mod) => mod.WebhooksCreatePanel),
  {
    loading: () => (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 text-[13px] text-[var(--fg-muted)] animate-pulse">
        {vi.settings.webhooks.page.loadingForm}
      </div>
    ),
  }
);

const WebhooksList = dynamic(
  () => import("./webhooks-list").then((mod) => mod.WebhooksList),
  {
    loading: () => (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 text-[13px] text-[var(--fg-muted)] animate-pulse">
        {vi.settings.webhooks.page.loadingList}
      </div>
    ),
  }
);

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const { data: webhooks = [], isLoading } = useWebhooks();
  const { mutateAsync: createWebhook, isPending: creating } = useCreateWebhook();
  const { mutateAsync: updateWebhook } = useUpdateWebhook();
  const { mutateAsync: deleteWebhook } = useDeleteWebhook();

  const [showCreate, setShowCreate] = useState(false);
  const [recentWebhookSecret, setRecentWebhookSecret] =
    useState<RecentWebhookSecret>(null);

  async function handleCreateWebhook(input: {
    url: string;
    events: WebhookEvent[];
  }) {
    try {
      const created = await createWebhook(input);
      setRecentWebhookSecret(
        created.secret
          ? {
              id: created.id,
              url: created.url,
              secret: created.secret,
            }
          : null
      );
      appToast.success(vi.settings.webhooks.page.createSuccess);
    } catch (error) {
      appToast.error(vi.settings.webhooks.page.createError);
      throw error;
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      await deleteWebhook(id);
      appToast.success(vi.settings.webhooks.page.deleteSuccess);
    } catch {
      appToast.error(vi.settings.webhooks.page.deleteError);
    }
  }

  async function handleUpdateWebhook(input: {
    id: string;
    url: string;
    events: WebhookEvent[];
  }): Promise<boolean> {
    try {
      await updateWebhook(input);
      appToast.success(vi.settings.webhooks.page.updateSuccess);
      return true;
    } catch {
      appToast.error(vi.settings.webhooks.page.updateError);
      return false;
    }
  }

  async function handleToggleStatus(webhook: Webhook) {
    const newStatus: WebhookStatus =
      webhook.status === "active" ? "inactive" : "active";

    try {
      await updateWebhook({ id: webhook.id, status: newStatus });
      appToast.success(vi.settings.webhooks.page.statusChanged(newStatus));
    } catch {
      appToast.error(vi.settings.webhooks.page.statusUpdateError);
    }
  }

  async function handleTestWebhook(webhookId: string): Promise<boolean> {
    const testErrorLabel = "Không thể kiểm tra webhook";

    try {
      const response = await fetch(`/api/settings/webhooks/${webhookId}/test`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { data?: { ok?: boolean; responseStatus?: number; responseTimeMs?: number; error?: string } }
        | null;

      if (!response.ok || !body?.data?.ok) {
        const errorMessage = body?.data?.error ?? vi.settings.webhooks.page.testDescription;
        appToast.error(testErrorLabel, {
          description: errorMessage,
        });
        return false;
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
      appToast.success(vi.settings.webhooks.page.testSuccess, {
        description: body.data.responseStatus
          ? `HTTP ${body.data.responseStatus} • ${body.data.responseTimeMs ?? 0}ms`
          : vi.settings.webhooks.page.testDescription,
      });
      return true;
    } catch {
      appToast.error(testErrorLabel, {
        description: vi.settings.webhooks.page.testDescription,
      });
      return false;
    }
  }

  if (isLoading) {
    return (
        <AppLayout>
      <PageContainer className="py-16 text-center text-[14px] text-[var(--fg-muted)] animate-pulse">
          {vi.settings.webhooks.page.loading}
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--fg-base)]">
              {vi.settings.webhooks.page.title}
            </h1>
            <p className="text-[15px] text-[var(--fg-muted)] font-medium mt-1">
              {vi.settings.webhooks.page.description}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white rounded-xl text-[13px] font-bold hover:opacity-90 transition-all shadow-md shadow-[var(--accent)]/20"
            type="button"
          >
            <Plus className="size-4" />
            {vi.settings.webhooks.page.add}
          </button>
        </div>

        <WebhooksCreatePanel
          open={showCreate}
          creating={creating}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreateWebhook}
        />

        <WebhooksList
          webhooks={webhooks}
          recentWebhookSecret={recentWebhookSecret}
          onDismissSecret={() => setRecentWebhookSecret(null)}
          onDeleteWebhook={handleDeleteWebhook}
          onToggleStatus={handleToggleStatus}
          onUpdateWebhook={handleUpdateWebhook}
          onTestWebhook={handleTestWebhook}
        />
      </PageContainer>
    </AppLayout>
  );
}
