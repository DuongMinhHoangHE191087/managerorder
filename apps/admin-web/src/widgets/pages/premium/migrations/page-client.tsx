"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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
import { PREMIUM_MIGRATION_COPY as copy } from "./copy";
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
  statusCounts: {
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
  },
};

type SubscriptionCatalogMeta = {
  pagination?: {
    page?: number;
    totalPages?: number;
  };
};

async function fetchAllMigrationSubscriptions() {
  const rows: MigrationSubscriptionRow[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
      const response = await fetch(
        `/api/premium/subscriptions?renewal_state=all&page=${page}&page_size=100&sort_by=customer_asc`,
      );
    const payload = await readApiEnvelope<MigrationSubscriptionRow[]>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? "Khong the tai subscriptions");
    }

    rows.push(...(payload.data ?? []));
    totalPages = Number((payload.meta as SubscriptionCatalogMeta | undefined)?.pagination?.totalPages ?? 1);
    page += 1;
  }

  return rows;
}

export default function PremiumMigrationsPage() {
  const [migrations, setMigrations] = useState<MigrationListRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<MigrationSubscriptionRow[]>([]);
  const [accounts, setAccounts] = useState<MigrationAccountRow[]>([]);
  const [filtersDraft, setFiltersDraft] = useState<MigrationFilters>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<MigrationFilters>(DEFAULT_FILTERS);
  const [quickSearch, setQuickSearch] = useState("");
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
      const [subscriptionsData, accountsRes] = await Promise.all([
        fetchAllMigrationSubscriptions(),
        fetch("/api/premium/accounts"),
      ]);

      const accountsPayload = await readApiEnvelope<MigrationAccountRow[]>(accountsRes);

      setSubscriptions(subscriptionsData);

      if (accountsRes.ok) {
        setAccounts(accountsPayload.data ?? []);
      } else {
        appToast.error(copy.page.loadCatalogsError.accounts(accountsPayload.error ?? "Lỗi không xác định"));
      }
    } catch (error) {
      console.error("[fetchPremiumMigrationCatalogs]", error);
      appToast.error(copy.page.loadCatalogsError.fallback);
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
        include_status_counts: "1",
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
        appToast.error(payload.error ?? copy.page.loadMigrationsError.fallback);
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
        statusCounts: {
          pending: Number(meta.statusCounts?.pending ?? 0),
          in_progress: Number(meta.statusCounts?.in_progress ?? 0),
          completed: Number(meta.statusCounts?.completed ?? 0),
          failed: Number(meta.statusCounts?.failed ?? 0),
        },
      });
    } catch (error) {
      console.error("[fetchPremiumMigrations]", error);
      appToast.error(copy.page.loadMigrationsError.fallback);
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
        appToast.error(payload.error ?? copy.page.loadDetailError.fallback);
        return;
      }

      setDetailMigration(payload.data);
    } catch (error) {
      console.error("[openMigrationDetail]", error);
      appToast.error(copy.page.loadDetailError.fallback);
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
    setQuickSearch("");
  }

  const pendingCount = pagination.statusCounts?.pending ?? 0;
  const inProgressCount = pagination.statusCounts?.in_progress ?? 0;
  const completedCount = pagination.statusCounts?.completed ?? 0;
  const failedCount = pagination.statusCounts?.failed ?? 0;
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "active" && account.available_slots > 0),
    [accounts],
  );
  const activeSubscriptionCount = subscriptions.filter((item) => item.status === "active").length;
  const visibleMigrations = useMemo(() => {
    const normalizedSearch = quickSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return migrations;
    }

    return migrations.filter((migration) =>
      [
        migration.id,
        migration.customer_name,
        migration.source_account_email,
        migration.target_account_email,
        migration.status,
        migration.reason,
        migration.notes,
        migration.terminal_reason,
        migration.error_log,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [migrations, quickSearch]);

  return (
    <AppLayout>
      <PageContainer className="relative">
        <PageHeader
          eyebrow={<span>{copy.page.eyebrow}</span>}
          title={copy.page.title}
          description={copy.page.description}
          actions={
            <Button onClick={() => setIsCreateOpen(true)} variant="primary" className="rounded-full px-5">
              <Plus className="size-4" />
              {copy.page.createButton}
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
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <Input
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                placeholder="Tìm migration theo khách, account nguồn/đích, lý do, lỗi..."
                className="pl-10"
              />
            </div>
            <div className="flex items-center rounded-[1rem] border border-[var(--border-soft)] bg-white px-4 text-[12px] font-bold text-[var(--fg-muted)]">
              {visibleMigrations.length} / {migrations.length} dòng sau tìm nhanh
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.page.filters.subscription}
              </label>
              <Select
                value={filtersDraft.subscriptionId}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, subscriptionId: event.target.value }))}
              >
                <option value="">{copy.page.filters.allSubscriptions}</option>
                {subscriptions.map((subscription) => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscription.customer_name} · {subscription.service_name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.page.filters.sourceAccount}
              </label>
              <Select
                value={filtersDraft.sourceAccountId}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, sourceAccountId: event.target.value }))}
              >
                <option value="">{copy.page.filters.allSourceAccounts}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.primary_email}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.page.filters.targetAccount}
              </label>
              <Select
                value={filtersDraft.targetAccountId}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, targetAccountId: event.target.value }))}
              >
                <option value="">{copy.page.filters.allTargetAccounts}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.primary_email}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.page.filters.customerId}
              </label>
              <Input
                value={filtersDraft.customerId}
                placeholder="cust-..."
                onChange={(event) => setFiltersDraft((current) => ({ ...current, customerId: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.page.filters.pageSize}
              </label>
              <Select
                value={String(filtersDraft.limit)}
                onChange={(event) =>
                  setFiltersDraft((current) => ({ ...current, limit: Number(event.target.value) || 12 }))
                }
              >
                {[8, 12, 20, 30].map((limit) => (
                  <option key={limit} value={limit}>
                    {copy.page.filters.rowsPerPage(limit)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.page.filters.fromDate}
              </label>
              <Input
                type="date"
                value={filtersDraft.fromDate}
                onChange={(event) => setFiltersDraft((current) => ({ ...current, fromDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {copy.page.filters.toDate}
              </label>
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
                {copy.page.filters.reset}
              </Button>
              <Button
                onClick={() => applyFilters()}
                disabled={isLoading || isCatalogLoading}
                className="w-full sm:w-auto"
              >
                {copy.page.filters.apply}
              </Button>
            </div>
          </div>
        </FiltersBar>

        <MigrationsList
          migrations={visibleMigrations}
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
