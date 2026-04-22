"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer, PageHeader } from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { MigrationModals } from "./components/migration-modals";
import { MigrationStatusCards } from "./components/migration-status-cards";
import { MigrationsList } from "./components/migrations-list";
import type {
  MigrationAccountRow,
  MigrationDetailRow,
  MigrationListRow,
  MigrationStatus,
  MigrationSubscriptionRow,
} from "./types";

export default function PremiumMigrationsPage() {
  const [migrations, setMigrations] = useState<MigrationListRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<MigrationSubscriptionRow[]>([]);
  const [accounts, setAccounts] = useState<MigrationAccountRow[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<MigrationStatus>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailMigration, setDetailMigration] = useState<MigrationDetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void fetchAll(selectedStatus);
  }, [selectedStatus]);

  async function fetchAll(status: MigrationStatus) {
    setIsLoading(true);
    try {
      const [migrationsRes, subscriptionsRes, accountsRes] = await Promise.all([
        fetch(`/api/premium/migrations?status=${status}`),
        fetch("/api/premium/subscriptions"),
        fetch("/api/premium/accounts"),
      ]);

      const [migrationsPayload, subscriptionsPayload, accountsPayload] = await Promise.all([
        readApiEnvelope<MigrationListRow[]>(migrationsRes),
        readApiEnvelope<MigrationSubscriptionRow[]>(subscriptionsRes),
        readApiEnvelope<MigrationAccountRow[]>(accountsRes),
      ]);

      if (migrationsRes.ok) {
        setMigrations(migrationsPayload.data ?? []);
      } else {
        appToast.error(`Không thể tải yêu cầu di chuyển: ${migrationsPayload.error ?? "Lỗi không xác định"}`);
      }

      if (subscriptionsRes.ok) {
        setSubscriptions(subscriptionsPayload.data ?? []);
      } else {
        appToast.error(`Không thể tải thuê bao: ${subscriptionsPayload.error ?? "Lỗi không xác định"}`);
      }

      if (accountsRes.ok) {
        setAccounts(accountsPayload.data ?? []);
      } else {
        appToast.error(`Không thể tải kho premium: ${accountsPayload.error ?? "Lỗi không xác định"}`);
      }
    } catch (error) {
      console.error("[fetchPremiumMigrations]", error);
      appToast.error("Lỗi kết nối khi tải dữ liệu migrations");
    } finally {
      setIsLoading(false);
    }
  }

  async function openDetail(migrationId: string) {
    setDetailLoading(true);
    setDetailMigration(null);

    try {
      const response = await fetch(`/api/premium/migrations/${migrationId}`);
      const payload = await readApiEnvelope<MigrationDetailRow>(response);

      if (!response.ok || !payload.data) {
        appToast.error(payload.error ?? "Không thể tải audit di chuyển");
        return;
      }

      setDetailMigration(payload.data);
    } catch (error) {
      console.error("[openMigrationDetail]", error);
      appToast.error("Lỗi kết nối khi tải audit");
    } finally {
      setDetailLoading(false);
    }
  }

  const pendingCount = migrations.filter((migration) => migration.status === "pending").length;
  const inProgressCount = migrations.filter((migration) => migration.status === "in_progress").length;
  const completedCount = migrations.filter((migration) => migration.status === "completed").length;
  const failedCount = migrations.filter((migration) => migration.status === "failed").length;
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "active" && account.available_slots > 0),
    [accounts],
  );
  const activeSubscriptionCount = subscriptions.filter((item) => item.status === "active").length;

  return (
    <AppLayout>
      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>Premium / Migrations</span>}
          title="Di Chuyển Thuê Bao"
          description="Quản lý yêu cầu di chuyển giữa các kho tài khoản premium, theo dõi bước audit và lịch sử xử lý ngay trong một màn hình."
          actions={
            <Button onClick={() => setIsCreateOpen(true)} variant="primary" className="rounded-full px-5">
              <Plus className="size-4" />
              Tạo yêu cầu di chuyển
            </Button>
          }
        />

        <MigrationStatusCards
          selectedStatus={selectedStatus}
          pendingCount={pendingCount}
          inProgressCount={inProgressCount}
          completedCount={completedCount}
          failedCount={failedCount}
          onStatusChange={setSelectedStatus}
        />

        <MigrationsList
          migrations={migrations}
          selectedStatus={selectedStatus}
          activeAccountsCount={activeAccounts.length}
          activeSubscriptionsCount={activeSubscriptionCount}
          isLoading={isLoading}
          onStatusChange={setSelectedStatus}
          onOpenDetail={openDetail}
        />
      </PageContainer>

      <MigrationModals
        isCreateOpen={isCreateOpen}
        onCloseCreate={() => setIsCreateOpen(false)}
        subscriptions={subscriptions}
        accounts={accounts}
        onCreated={(migration) => {
          setMigrations((current) => [migration, ...current]);
          setSelectedStatus(migration.status);
        }}
        detailLoading={detailLoading}
        detailMigration={detailMigration}
        onCloseDetail={() => {
          setDetailMigration(null);
          setDetailLoading(false);
        }}
      />
    </AppLayout>
  );
}
