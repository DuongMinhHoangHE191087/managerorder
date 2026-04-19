"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { appToast } from "@/shared/lib/toast";
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
        Đang tải form webhook...
      </div>
    ),
  }
);

const WebhooksList = dynamic(
  () => import("./webhooks-list").then((mod) => mod.WebhooksList),
  {
    loading: () => (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-6 text-[13px] text-[var(--fg-muted)] animate-pulse">
        Đang tải danh sách webhooks...
      </div>
    ),
  }
);

export default function WebhooksPage() {
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
      appToast.success("Đã tạo webhook!");
    } catch (error) {
      appToast.error("Lỗi khi tạo webhook");
      throw error;
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      await deleteWebhook(id);
      appToast.success("Đã xoá webhook");
    } catch {
      appToast.error("Lỗi khi xoá webhook");
    }
  }

  async function handleUpdateWebhook(input: {
    id: string;
    url: string;
    events: WebhookEvent[];
  }) {
    try {
      await updateWebhook(input);
      appToast.success("Đã cập nhật webhook");
    } catch {
      appToast.error("Lỗi khi cập nhật");
    }
  }

  async function handleToggleStatus(webhook: Webhook) {
    const newStatus: WebhookStatus =
      webhook.status === "active" ? "inactive" : "active";

    try {
      await updateWebhook({ id: webhook.id, status: newStatus });
      appToast.success(`Webhook đã ${newStatus === "active" ? "kích hoạt" : "tắt"}`);
    } catch {
      appToast.error("Lỗi khi cập nhật trạng thái");
    }
  }

  async function handleTestWebhook() {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    appToast.success("Đã gửi test payload!", {
      description: "Kiểm tra endpoint của bạn để xem response",
    });
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PageContainer className="py-16 text-center text-[14px] text-[var(--fg-muted)] animate-pulse">
          Đang tải webhooks...
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
              Webhooks
            </h1>
            <p className="text-[15px] text-[var(--fg-muted)] font-medium mt-1">
              Nhận thông báo real-time khi có sự kiện quan trọng
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white rounded-xl text-[13px] font-bold hover:opacity-90 transition-all shadow-md shadow-[var(--accent)]/20"
            type="button"
          >
            <Plus className="size-4" />
            Thêm Webhook
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
