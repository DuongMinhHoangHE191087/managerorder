"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/widgets/layout/app-layout";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { PageContainer, PageHeader, FiltersBar } from "@/shared/ui/page-layout";
import { Select } from "@/shared/ui/select";
import { appToast } from "@/shared/lib/toast";
import { readApiEnvelope } from "@/shared/lib/api-client";
import { MigrationModals } from "./components/migration-modals";
import { MigrationStatusCards } from "./components/migration-status-cards";
import { MigrationsList } from "./components/migrations-list";
import type {
  MigrationAccountRow,
  MigrationDetailRow,
  MigrationListMeta,
  MigrationListRow,
  MigrationStatus,
  MigrationSubscriptionRow,
} from "./types";

type MigrationFilters = {
  status: MigrationStatus;
  subscriptionId: string;
  sourceAccountId: string;
  targetAccountId: string;
  customerId: string;
  fromDate: string;
  toDate: string;
  page: number;
  limit: number;
};

const DEFAULT_FILTERS: MigrationFilters = {
  status: "pending",
  subscriptionId: "",
  sourceAccountId: "",
  targetAccountId: "",
  customerId: "",
  fromDate: "",
  toDate: "",
  page: 1,
  limit: 12,
};

const DEFAULT_META: MigrationListMeta = {
  total: 0,
  status: "pending",
  page: 1,
  limit: 12,
  totalPages: 1,
};

export default function PremiumMigrationsPage() {
  const [migrations, setMigrations] = useState<MigrationListRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<MigrationSubscriptionRow[]>([]);
  const [accounts, setAccounts] = useState<MigrationAccountRow[]>([]);
  const [filtersDraft, setFiltersDraft] = useState<MigrationFilters>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<MigrationFilters>(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState<MigrationListMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState(true);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailMigration, setDetailMigration] = useState<MigrationDetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void fetchCatalogs();
  }, []);

  useEffect(() => {
    void fetchMigrations(filters);
  }, [filters]);

  async function fetchCatalogs() {
    setIsCatalogLoading(true);
    try {
      const [subscriptionsRes, accountsRes] = await Promise.all([
        fetch("/api/premium/subscriptions"),
        fetch("/api/premium/accounts"),
      ]);

      const [subscriptionsPayload, accountsPayload] = await Promise.all([
        readApiEnvelope<MigrationSubscriptionRow[]>(subscriptionsRes),
        readApiEnvelope<MigrationAccountRow[]>(accountsRes),
      ]);

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
      console.error("[fetchPremiumMigrationCatalogs]", error);
      appToast.error("Lỗi kết nối khi tải dữ liệu nguồn cho migrations");
    } finally {
      setIsCatalogLoading(false);
    }
  }

  async function fetchMigrations(nextFilters: MigrationFilters) {
    setIsLoading(true);
    try {
      const search = new URLSearchParams({
        status: nextFilters.status,
        page: String(nextFilters.page),
        limit: String(nextFilters.limit),
      });

      if (nextFilters.subscriptionId) {
        search.set("subscription_id", nextFilters.subscriptionId);
      }
      if (nextFilters.sourceAccountId) {
        search.set("source_account_id", nextFilters.sourceAccountId);
      }
      if (nextFilters.targetAccountId) {
        search.set("target_account_id", nextFilters.targetAccountId);
      }
      if (nextFilters.customerId.trim()) {
        search.set("customer_id", nextFilters.customerId.trim());
      }
      if (nextFilters.fromDate) {
        search.set("from_date", nextFilters.fromDate);
      }
      if (nextFilters.toDate) {
        search.set("to_date", nextFilters.toDate);
      }

      const response = await fetch(`/api/premium/migrations?${search.toString()}`);
      const payload = await readApiEnvelope<MigrationListRow[]>(response);

      if (!response.ok) {
        appToast.error(payload.error ?? "Không thể tải queue migrations");
        return;
      }

      const meta = (payload.meta ?? {}) as Partial<MigrationListMeta>;
      setMigrations(
        (payload.data ?? []).map((migration) => ({
          ...migration,
          terminal_reason:
            typeof migration.details?.terminal_reason === "string"
              ? migration.details.terminal_reason
              : null,
        })),
      );
      setPagination({
        total: Number(meta.total) || 0,
        status: typeof meta.status === "string" ? meta.status : nextFilters.status,
        page: Number(meta.page) || nextFilters.page,
        limit: Number(meta.limit) || nextFilters.limit,
        totalPages: Number(meta.totalPages) || 1,
      });
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

  function applyFilters(patch?: Partial<MigrationFilters>) {
    const nextFilters = {
      ...filtersDraft,
      ...patch,
      page: patch?.page ?? 1,
    };
    setFiltersDraft(nextFilters);
    setFilters(nextFilters);
  }

  function resetFilters() {
    setFiltersDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
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
          description="Queue vận hành chuẩn cho migration premium: lọc server-side, review chi tiết, chỉnh pending request và thực thi start/complete/fail/cancel ngay trên admin surface."
          actions={
            <Button onClick={() => setIsCreateOpen(true)} variant="primary" className="rounded-full px-5">
              <Plus className="size-4" />
              Tạo yêu cầu di chuyển
            </Button>
          }
        />

        <MigrationStatusCards
          selectedStatus={filters.status}
          pendingCount={pendingCount}
          inProgressCount={inProgressCount}
          completedCount={completedCount}
          failedCount={failedCount}
          onStatusChange={(status) => applyFilters({ status })}
        />

        <FiltersBar className="mt-1 flex-col gap-4">
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Thuê bao</label>
              <Select
                value={filtersDraft.subscriptionId}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, subscriptionId: event.target.value }))}
              >
                <option value="">Tất cả thuê bao</option>
                {subscriptions.map((subscription) => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscription.customer_name} · {subscription.service_name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Kho nguồn</label>
              <Select
                value={filtersDraft.sourceAccountId}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, sourceAccountId: event.target.value }))}
              >
                <option value="">Tất cả kho nguồn</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.primary_email}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Kho đích</label>
              <Select
                value={filtersDraft.targetAccountId}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, targetAccountId: event.target.value }))}
              >
                <option value="">Tất cả kho đích</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.primary_email}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Mã khách hàng</label>
              <Input
                value={filtersDraft.customerId}
                placeholder="cust-..."
                onChange={(event) => setFiltersDraft((current) => ({ ...current, customerId: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Số dòng / trang</label>
              <Select
                value={String(filtersDraft.limit)}
                onChange={(event) =>
                  setFiltersDraft((current) => ({ ...current, limit: Number(event.target.value) || 12 }))
                }
              >
                {[8, 12, 20, 30].map((limit) => (
                  <option key={limit} value={limit}>
                    {limit} dòng
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Từ ngày</label>
              <Input
                type="date"
                value={filtersDraft.fromDate}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, fromDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Đến ngày</label>
              <Input
                type="date"
                value={filtersDraft.toDate}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, toDate: event.target.value }))}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button
                variant="secondary"
                onClick={resetFilters}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Reset filters
              </Button>
              <Button
                onClick={() => applyFilters()}
                disabled={isLoading || isCatalogLoading}
                className="w-full sm:w-auto"
              >
                Áp dụng
              </Button>
            </div>
          </div>
        </FiltersBar>

        <MigrationsList
          migrations={migrations}
          activeAccountsCount={activeAccounts.length}
          activeSubscriptionsCount={activeSubscriptionCount}
          isLoading={isLoading || isCatalogLoading}
          onOpenDetail={openDetail}
          pagination={pagination}
          onPreviousPage={() => applyFilters({ page: Math.max(1, filters.page - 1) })}
          onNextPage={() =>
            applyFilters({ page: Math.min(Math.max(pagination.totalPages, 1), filters.page + 1) })
          }
        />
      </PageContainer>

      <MigrationModals
        isCreateOpen={isCreateOpen}
        onCloseCreate={() => setIsCreateOpen(false)}
        subscriptions={subscriptions}
        accounts={accounts}
        onCreated={(migration) => {
          setIsCreateOpen(false);
          const nextFilters = {
            ...filters,
            status: migration.status,
            page: 1,
          };
          setMigrations((current) =>
            migration.status === nextFilters.status
              ? [
                  {
                    ...migration,
                    terminal_reason:
                      typeof migration.details?.terminal_reason === "string"
                        ? migration.details.terminal_reason
                        : null,
                  },
                  ...current.filter((item) => item.id !== migration.id),
                ]
              : current,
          );
          setFiltersDraft(nextFilters);
          setFilters(nextFilters);
        }}
        detailLoading={detailLoading}
        detailMigration={detailMigration}
        onDetailChanged={(migration) => {
          setDetailMigration(migration);
          setMigrations((current) =>
            current.map((item) =>
              item.id === migration.id
                ? {
                    ...item,
                    ...migration,
                    terminal_reason:
                      migration.terminal_reason ??
                      (typeof migration.details?.terminal_reason === "string"
                        ? migration.details.terminal_reason
                        : item.terminal_reason),
                  }
                : item,
            ),
          );
          void fetchMigrations(filters);
        }}
        onCloseDetail={() => {
          setDetailMigration(null);
          setDetailLoading(false);
        }}
      />
    </AppLayout>
  );
}
