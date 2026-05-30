"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Webhook as WebhookIcon, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/widgets/layout/app-layout";
import {
  PageContainer,
  PageHeader,
  SectionHeader,
  StatsGrid,
  SurfaceCard,
} from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/lib/toast";
import { vi } from "@/shared/messages/vi";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { Webhook, WebhookEvent, WebhookStatus } from "@/lib/domain/types";
import {
  useCreateWebhook,
  useDeleteWebhook,
  useUpdateWebhook,
  useWebhooks,
  useWebhookLogs,
} from "@/widgets/pages/settings/hooks/use-settings";

type RecentWebhookSecret = {
  id: string;
  url: string;
  secret: string;
} | null;

const WebhooksCreatePanel = dynamic(
  () => import("./webhooks-create-panel").then((module) => module.WebhooksCreatePanel),
  {
    loading: () => (
      <div className="animate-pulse rounded-2xl border border-[var(--border-soft)] bg-white p-6 text-[13px] text-[var(--fg-muted)]">
        {vi.settings.webhooks.page.loadingForm}
      </div>
    ),
  },
);

const WebhooksList = dynamic(
  () => import("./webhooks-list").then((module) => module.WebhooksList),
  {
    loading: () => (
      <div className="animate-pulse rounded-2xl border border-[var(--border-soft)] bg-white p-6 text-[13px] text-[var(--fg-muted)]">
        {vi.settings.webhooks.page.loadingList}
      </div>
    ),
  },
);

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const { data: webhooks = [], isLoading } = useWebhooks();
  const { mutateAsync: createWebhook, isPending: creating } = useCreateWebhook();
  const { mutateAsync: updateWebhook } = useUpdateWebhook();
  const { mutateAsync: deleteWebhook } = useDeleteWebhook();

  const [showCreate, setShowCreate] = useState(false);
  const [recentWebhookSecret, setRecentWebhookSecret] = useState<RecentWebhookSecret>(null);

  const summary = useMemo(() => {
    const activeCount = webhooks.filter((webhook) => webhook.status === "active").length;
    const failedCount = webhooks.filter((webhook) => webhook.status === "failed").length;
    const inactiveCount = webhooks.filter((webhook) => webhook.status === "inactive").length;
    const totalFailures = webhooks.reduce((sum, webhook) => sum + (webhook.failure_count || 0), 0);

    return { activeCount, failedCount, inactiveCount, totalFailures };
  }, [webhooks]);

  async function handleCreateWebhook(input: { url: string; events: WebhookEvent[] }) {
    try {
      const created = await createWebhook(input);
      setRecentWebhookSecret(
        created.secret
          ? {
              id: created.id,
              url: created.url,
              secret: created.secret,
            }
          : null,
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
    const newStatus: WebhookStatus = webhook.status === "active" ? "inactive" : "active";

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
        <PageContainer className="animate-pulse py-16 text-center text-[14px] text-[var(--fg-muted)]">
          {vi.settings.webhooks.page.loading}
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer variant="wide">
        <PageHeader
          title={vi.settings.webhooks.page.title}
          description=""
          eyebrow={
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">
                Delivery Workspace
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                <WebhookIcon className="size-3.5" />
                {webhooks.length} webhook
              </span>
            </>
          }
          actions={
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowCreate((current) => !current)}
            >
              <Plus className="size-4" />
              {showCreate ? "Ẩn form tạo" : vi.settings.webhooks.page.add}
            </Button>
          }
          className="mt-2"
        />

        <StatsGrid className="xl:grid-cols-4">
          <div className="app-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Đang hoạt động</div>
            <div className="mt-2 text-2xl font-black text-emerald-600">{summary.activeCount}</div>
          </div>
          <div className="app-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Tạm dừng</div>
            <div className="mt-2 text-2xl font-black text-slate-700">{summary.inactiveCount}</div>
          </div>
          <div className="app-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Lỗi delivery</div>
            <div className="mt-2 text-2xl font-black text-rose-600">{summary.failedCount}</div>
          </div>
          <div className="app-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Tổng retry lỗi</div>
            <div className="mt-2 text-2xl font-black text-[var(--fg-base)]">{summary.totalFailures}</div>
          </div>
        </StatsGrid>

        <SurfaceCard>
          <SectionHeader
            title="Tạo webhook mới"
            description=""
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCreate((current) => !current)}
              >
                {showCreate ? "Thu gọn" : "Mở form"}
              </Button>
            }
          />
          <div className="p-5">
            <WebhooksCreatePanel
              open={showCreate}
              creating={creating}
              onClose={() => setShowCreate(false)}
              onSubmit={handleCreateWebhook}
            />
            {!showCreate ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)]/45 px-4 py-5 text-[13px] text-[var(--fg-muted)]">
                Bật form tạo khi cần thêm endpoint mới. Secret chỉ hiện một lần sau khi tạo thành công.
              </div>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader
            title="Danh sách webhook"
            description=""
          />
          <div className="p-5">
            <WebhooksList
              webhooks={webhooks}
              recentWebhookSecret={recentWebhookSecret}
              onDismissSecret={() => setRecentWebhookSecret(null)}
              onDeleteWebhook={handleDeleteWebhook}
              onToggleStatus={handleToggleStatus}
              onUpdateWebhook={handleUpdateWebhook}
              onTestWebhook={handleTestWebhook}
            />
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader
            title="Nhật ký Webhook nhận được"
            description=""
          />
          <div className="p-5">
            <WebhookLogsSection />
          </div>
        </SurfaceCard>
      </PageContainer>
    </AppLayout>
  );
}

function WebhookLogsSection() {
  const { data: logs = [], isLoading } = useWebhookLogs();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="animate-pulse py-4 text-center text-[13px] text-[var(--fg-muted)]">Đang tải nhật ký webhook...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-soft)] text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            <th className="pb-3 pt-2">Thời gian</th>
            <th className="pb-3 pt-2">Nguồn</th>
            <th className="pb-3 pt-2">Giao dịch ID</th>
            <th className="pb-3 pt-2">Số tiền</th>
            <th className="pb-3 pt-2">Đơn hàng</th>
            <th className="pb-3 pt-2">Trạng thái</th>
            <th className="pb-3 pt-2 text-right">Chi tiết</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-soft)]">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-center italic text-[var(--fg-muted)]">
                Chưa có nhật ký webhook nào được ghi nhận.
              </td>
            </tr>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const date = new Date(log.createdAt).toLocaleString("vi-VN");
              
              let statusBadge = "bg-slate-100 text-slate-700";
              let statusLabel = log.status;
              if (log.status === "success") {
                statusBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
                statusLabel = "Thành công";
              } else if (log.status === "failed") {
                statusBadge = "bg-rose-50 text-rose-700 border border-rose-200/50";
                statusLabel = "Thất bại";
              } else if (log.status === "ignored") {
                statusBadge = "bg-amber-50 text-amber-700 border border-amber-200/50";
                statusLabel = "Bỏ qua";
              } else if (log.status === "pending") {
                statusBadge = "bg-blue-50 text-blue-700 border border-blue-200/50";
                statusLabel = "Đang xử lý";
              }

              return (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-[var(--surface-light)]/40 transition-colors">
                    <td className="py-3 font-medium text-[var(--fg-muted)]">{date}</td>
                    <td className="py-3 font-bold uppercase text-[var(--fg-base)]">{log.provider}</td>
                    <td className="py-3 font-mono text-[var(--fg-muted)]">{log.externalTransactionId || "-"}</td>
                    <td className="py-3 font-bold text-[var(--fg-base)]">
                      {log.amount ? `${log.amount.toLocaleString("vi-VN")} VND` : "-"}
                    </td>
                    <td className="py-3 font-bold text-[var(--accent)]">
                      {log.orderCode ? (
                        <a href={`/orders/${log.orderId}`} className="hover:underline">
                          {log.orderCode}
                        </a>
                      ) : "-"}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusBadge}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors p-1"
                      >
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="bg-[var(--bg-app)] p-4 rounded-xl">
                        <div className="space-y-2">
                          {log.errorMessage && (
                            <p className="text-[12px] font-bold text-rose-600">
                              Lỗi: <span className="font-medium text-rose-700">{log.errorMessage}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--fg-muted)]">
                            <Terminal className="size-3.5" />
                            <span>Payload dữ liệu nhận được:</span>
                          </div>
                          <pre className="overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-slate-900 p-3 font-mono text-[11px] text-sky-200">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
