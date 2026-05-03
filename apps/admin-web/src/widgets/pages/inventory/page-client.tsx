"use client";

import { useState, useCallback, useDeferredValue, useMemo } from "react";
import { Eye, Edit2, PackageSearch, Clock, RefreshCw, Trash2, X } from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import type { SourceAccount, LicenseKey } from "@/lib/domain/types";
import { useContextMenu } from "@/shared/ui/context-menu";
import { useInventoryDashboard } from "@/widgets/pages/inventory/hooks/use-inventory-dashboard";
import { useOrders } from "@/widgets/pages/orders/hooks/use-orders";
import { useProducts } from "@/widgets/pages/products/hooks/use-products";
import { useSourceAccounts, useCreateSourceAccount, useUpdateSourceAccount, useRecalculateSlots, useDeleteSourceAccount } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { useProviders } from "@/widgets/pages/providers/hooks/use-providers";
import { useCreateInventory, useDeleteInventory, useInventoryKeyDetail, useInventoryRealtime } from "@/widgets/pages/inventory/hooks/use-inventory";
import { usePurgeItems, useRestoreItems } from "@/widgets/pages/trash/hooks/use-trash";
import { INVENTORY_COPY as copy } from "./copy";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";
import { InventoryPageHeader } from "./components/inventory-page-header";
import { InventoryPageOverlays } from "./components/inventory-page-overlays";

const InventoryFilters = dynamic(() => import("@/widgets/pages/inventory/components/inventory-filters").then((m) => ({ default: m.InventoryFilters })), { ssr: false });
const InventoryTable = dynamic(() => import("@/widgets/pages/inventory/components/inventory-table").then((m) => ({ default: m.InventoryTable })), {
  ssr: false,
  loading: () => (
    <div data-testid="inventory-list-loading" className="app-card mb-6 overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] p-5">
        <div className="h-4 w-44 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="animate-pulse flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-white/60 p-4">
            <div className="size-10 shrink-0 rounded-xl bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-20 rounded-full bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  ),
});
const InventoryStatsCards = dynamic(() => import("@/widgets/pages/inventory/components/inventory-stats-cards").then((m) => ({ default: m.InventoryStatsCards })), { ssr: false });
const CapacityAlertBanner = dynamic(() => import("@/widgets/pages/inventory/components/capacity-alert-banner").then((m) => ({ default: m.CapacityAlertBanner })), { ssr: false });
const AllocateOrderButton = dynamic(() => import("@/widgets/pages/orders/components/allocate-order-button").then((m) => ({ default: m.AllocateOrderButton })), {
  ssr: false,
  loading: () => (
    <button type="button" className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-bold text-[var(--fg-muted)]">
      {copy.page.loading}
    </button>
  ),
});

export default function InventoryPage() {
  const inventoryText = copy.page;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: sourceAccounts = [] } = useSourceAccounts();
  const { data: dashboard } = useInventoryDashboard();
  const { mutateAsync: createSourceAccount } = useCreateSourceAccount();
  const { mutateAsync: updateSourceAccount } = useUpdateSourceAccount();
  const { mutateAsync: recalculateSlots, isPending: isRecalculating } = useRecalculateSlots();
  const { mutateAsync: deleteSourceAccount } = useDeleteSourceAccount();
  const restoreItems = useRestoreItems();
  const purgeItems = usePurgeItems();
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  const { data: ordersData } = useOrders({ status: "pending_payment,paid,provisioning", limit: 200 });
  type PendingOrder = {
    id: string;
    status?: string | null;
    product_id: string;
    customer?: { full_name: string } | null;
    contactSnapshot?: string;
    total_amount_vnd?: number;
    created_at?: string;
  };
  const pendingOrders: PendingOrder[] = (ordersData?.data as PendingOrder[]) || [];
  const { data: products = [] } = useProducts();
  const { data: providers = [] } = useProviders();

  const { mutateAsync: createInventory } = useCreateInventory();
  const { mutateAsync: deleteInventory } = useDeleteInventory();

  useInventoryRealtime();

  const [searchQuery, setSearchQuery] = useState("");
  const [productIdFilter, setProductIdFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedAccount, setSelectedAccount] = useState<SourceAccount | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SourceAccount | null>(null);
  const [deletingKey, setDeletingKey] = useState<LicenseKey | null>(null);
  const [showSmartMatch, setShowSmartMatch] = useState(false);
  const selectedLicenseKeyId = searchParams.get("key");
  const selectedLicenseKeyTrashMode = searchParams.get("trash") === "1";
  const isLicenseKeyDetailOpen = Boolean(selectedLicenseKeyId);
  const { data: selectedLicenseKeyResult } = useInventoryKeyDetail(selectedLicenseKeyId, selectedLicenseKeyTrashMode);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [currentTime] = useState(() => Date.now());

  const productMap = useMemo(() => new Map(products.map((product: { id: string; name: string }) => [product.id, product.name])), [products]);
  const providerById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider] as const)),
    [providers],
  );
  const sourceAccountById = useMemo(
    () => new Map(sourceAccounts.map((account) => [account.id, account] as const)),
    [sourceAccounts],
  );
  const searchHasTokens = useMemo(() => hasSearchTokens(deferredSearchQuery), [deferredSearchQuery]);
  const pendingAllocationOrders = pendingOrders;
  const selectedAccountIds = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedCount = selectedAccountIds.length;

  const filteredAccounts = useMemo(
    () =>
      sourceAccounts.filter((account) => {
        if (productIdFilter && !account.productIds.includes(productIdFilter)) return false;
        if (providerFilter && account.provider !== providerFilter) return false;
        if (statusFilter === "active" && account.usedSlots >= account.maxSlots) return false;
        if (statusFilter === "full" && account.usedSlots < account.maxSlots) return false;
        if (statusFilter === "expired" && new Date(account.expiresAt).getTime() > currentTime) return false;
        if (statusFilter === "expiring_7d") {
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          const timeLeft = new Date(account.expiresAt).getTime() - currentTime;
          if (timeLeft <= 0 || timeLeft > sevenDays) return false;
        }
        if (searchHasTokens) {
          const matchQuery = matchesSearchQuery(
            deferredSearchQuery,
            account.email,
            account.provider,
            account.reservedNicks,
            account.productIds.map((productId: string) => productMap.get(productId) ?? ""),
          );
          if (!matchQuery) return false;
        }
        return true;
      }),
    [sourceAccounts, productIdFilter, providerFilter, statusFilter, deferredSearchQuery, productMap, currentTime, searchHasTokens]
  );

  const { openContextMenu, ContextMenuRender } = useContextMenu();

  const handleRowContextMenu = useCallback((event: React.MouseEvent, account: SourceAccount) => {
    openContextMenu(event, [
      {
        label: inventoryText.contextMenu.viewDetails,
        icon: <Eye className="size-4" />,
        onClick: () => {
          setSelectedAccount(account);
          setIsDrawerOpen(true);
        },
      },
      {
        label: inventoryText.contextMenu.editAccount,
        icon: <Edit2 className="size-4" />,
        onClick: () => setEditingAccount(account),
      },
    ]);
  }, [inventoryText, openContextMenu]);

  const handleCreateAccount = useCallback(async (body: {
    email: string;
    provider: string;
    productIds: string[];
    maxSlots: number;
    expiresAt: string;
    credentials?: Array<{ type: string; value: string; label?: string }>;
    purchaseCostVnd?: number;
    purchaseDate?: string;
    purchaseSource?: string;
  }) => {
    await createSourceAccount(body as Parameters<typeof createSourceAccount>[0]);
  }, [createSourceAccount]);

  const handleEditAccount = useCallback(async (body: {
    id: string;
    email: string;
    provider: string;
    productIds: string[];
    maxSlots: number;
    expiresAt: string;
    credentials?: Array<{ type: string; value: string; label?: string }>;
    purchaseCostVnd?: number;
    purchaseDate?: string;
    purchaseSource?: string;
  }) => {
    await updateSourceAccount(body as Parameters<typeof updateSourceAccount>[0]);
  }, [updateSourceAccount]);

  const handleCreateKey = useCallback(async (body: { keyCode: string; productId: string; status: "available" | "reserved" | "used" | "expired" | "invalid" }) => {
    await createInventory(body);
  }, [createInventory]);

  const handleDeleteKey = useCallback(async () => {
    if (!deletingKey) return;
    await deleteInventory(deletingKey.id);
  }, [deletingKey, deleteInventory]);

  const handleCloseLicenseKeyDetail = useCallback(() => {
    router.replace("/inventory");
  }, [router]);

  const handleRestoreLicenseKey = useCallback(async () => {
    if (!selectedLicenseKeyResult?.data) return;
    await restoreItems.mutateAsync({ type: "license_keys", ids: [selectedLicenseKeyResult.data.id] });
    handleCloseLicenseKeyDetail();
  }, [handleCloseLicenseKeyDetail, restoreItems, selectedLicenseKeyResult]);

  const handlePurgeLicenseKey = useCallback(async () => {
    if (!selectedLicenseKeyResult?.data) return;
    await purgeItems.mutateAsync({ type: "license_keys", ids: [selectedLicenseKeyResult.data.id] });
    handleCloseLicenseKeyDetail();
  }, [handleCloseLicenseKeyDetail, purgeItems, selectedLicenseKeyResult]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((visibleIds: string[]) => {
    setSelectedIds((previous) => {
      const allVisibleSelected = visibleIds.every((id) => previous.has(id));
      const next = new Set(previous);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const ids = selectedAccountIds;
    const results = await Promise.allSettled(ids.map((id) => deleteSourceAccount(id)));
    const success = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - success;
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    if (failed > 0) appToast.warning(inventoryText.toast.bulkDelete(success, failed));
    else appToast.success(inventoryText.toast.bulkDeleteSuccess(success));
  }, [deleteSourceAccount, inventoryText, selectedAccountIds]);

  const handleBulkExtend = useCallback(async (days: number) => {
    const ids = selectedAccountIds;
    const results = await Promise.allSettled(
      ids.map((id) => {
        const account = sourceAccountById.get(id);
        if (!account) return Promise.resolve();
        const baseDate = account.expiresAt && new Date(account.expiresAt) > new Date() ? new Date(account.expiresAt) : new Date();
        const newExpiresAt = new Date(baseDate.getTime() + days * 24 * 3600_000).toISOString();
        return updateSourceAccount({ id, email: account.email, provider: account.provider, productIds: account.productIds, maxSlots: account.maxSlots, expiresAt: newExpiresAt });
      })
    );
    const success = results.filter((result) => result.status === "fulfilled").length;
    setSelectedIds(new Set());
    if (success > 0) appToast.success(inventoryText.toast.bulkExtend(days, success));
  }, [inventoryText, selectedAccountIds, sourceAccountById, updateSourceAccount]);

  const handleBulkSync = useCallback(async () => {
    setIsBulkSyncing(true);
    try {
      const ids = selectedAccountIds;
      const results = await Promise.allSettled(ids.map((id) => recalculateSlots(id)));
      const changed = results.filter((result) => result.status === "fulfilled" && result.value.changed).length;
      appToast.success(inventoryText.toast.bulkSyncSuccess(changed, ids.length));
    } catch {
      appToast.error(inventoryText.toast.bulkSyncError);
    } finally {
      setIsBulkSyncing(false);
    }
  }, [inventoryText, recalculateSlots, selectedAccountIds]);

  const handleOpenCreateAccount = useCallback(() => {
    setIsCreateAccountOpen(true);
  }, []);

  const handleOpenCreateKey = useCallback(() => {
    setIsCreateKeyOpen(true);
  }, []);

  const handleShowSmartMatch = useCallback(() => {
    setShowSmartMatch(true);
  }, []);

  const handleCloseCreateAccount = useCallback(() => {
    setIsCreateAccountOpen(false);
  }, []);

  const handleCloseCreateKey = useCallback(() => {
    setIsCreateKeyOpen(false);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleCloseEditAccount = useCallback(() => {
    setEditingAccount(null);
  }, []);

  const handleCloseDeleteKey = useCallback(() => {
    setDeletingKey(null);
  }, []);

  const handleCloseBulkDelete = useCallback(() => {
    setShowBulkDeleteConfirm(false);
  }, []);

  const handleCloseSmartMatch = useCallback(() => {
    setShowSmartMatch(false);
  }, []);

  const handleOpenBulkDeleteConfirm = useCallback(() => {
    setShowBulkDeleteConfirm(true);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkExtend30 = useCallback(() => {
    void handleBulkExtend(30);
  }, [handleBulkExtend]);

  const handleExportCSV = useCallback(() => {
    if (filteredAccounts.length === 0) {
      appToast.warning(inventoryText.toast.noExportData);
      return;
    }
    const esc = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = [
      inventoryText.csv.email,
      inventoryText.csv.provider,
      inventoryText.csv.product,
      inventoryText.csv.usedSlots,
      inventoryText.csv.totalSlots,
      inventoryText.csv.expiry,
      inventoryText.csv.status,
    ];
    const rows = filteredAccounts.map((account) => [
      account.email,
      providerById.get(account.provider)?.name || account.provider,
      account.productIds.map((productId) => productMap.get(productId) || productId).join(" | "),
      account.usedSlots,
      account.maxSlots,
      account.expiresAt.substring(0, 10),
      account.usedSlots >= account.maxSlots ? inventoryText.csv.fullStatus : new Date(account.expiresAt) < new Date() ? inventoryText.csv.expiredStatus : inventoryText.csv.activeStatus,
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => esc(cell)).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kho-hang-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    appToast.success(inventoryText.toast.exportCsv);
  }, [filteredAccounts, inventoryText, providerById, productMap]);

  const handleSelectedAccountRecalculate = useCallback(async () => {
    if (!selectedAccount) return;
    try {
      const result = await recalculateSlots(selectedAccount.id);
      if (result.changed) appToast.success(inventoryText.toast.syncSuccess(String(result.previous), String(result.recalculated)));
      else appToast.info(inventoryText.toast.syncExact);
    } catch {
      appToast.error(inventoryText.toast.syncError);
    }
  }, [inventoryText, recalculateSlots, selectedAccount]);

  const handleEditSelectedAccount = useCallback(() => {
    if (!selectedAccount) return;
    setIsDrawerOpen(false);
    setEditingAccount(selectedAccount);
  }, [selectedAccount]);

  return (
    <AppLayout>
      <ContextMenuRender />

      <InventoryPageOverlays
        deletingKey={deletingKey}
        editingAccount={editingAccount}
        isCreateAccountOpen={isCreateAccountOpen}
        isCreateKeyOpen={isCreateKeyOpen}
        isDrawerOpen={isDrawerOpen}
        isRecalculating={isRecalculating}
        onCloseCreateAccount={handleCloseCreateAccount}
        onCloseCreateKey={handleCloseCreateKey}
        onCloseDrawer={handleCloseDrawer}
        onCloseEditAccount={handleCloseEditAccount}
        onCloseDeleteKey={handleCloseDeleteKey}
        onCloseLicenseKeyDetail={handleCloseLicenseKeyDetail}
        onCreateAccount={handleCreateAccount}
        onCreateKey={handleCreateKey}
        onDeleteKey={handleDeleteKey}
        onEditAccount={handleEditAccount}
        onEditSelectedAccount={handleEditSelectedAccount}
        onRestoreLicenseKey={handleRestoreLicenseKey}
        onPurgeLicenseKey={handlePurgeLicenseKey}
        onRecalculateSelectedAccount={handleSelectedAccountRecalculate}
        onCloseBulkDelete={handleCloseBulkDelete}
        onConfirmBulkDelete={handleBulkDelete}
        productMap={productMap}
        products={products}
        providerById={providerById}
        providers={providers}
        selectedAccount={selectedAccount}
        selectedLicenseKeyId={selectedLicenseKeyId}
        selectedLicenseKeyTrashMode={selectedLicenseKeyTrashMode}
        isLicenseKeyDetailOpen={isLicenseKeyDetailOpen}
        selectedIdsCount={selectedCount}
        showBulkDeleteConfirm={showBulkDeleteConfirm}
        showSmartMatch={showSmartMatch}
        onCloseSmartMatch={handleCloseSmartMatch}
      />

      <PageContainer className="relative">
        <InventoryPageHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateAccountClick={handleOpenCreateAccount}
          onCreateKeyClick={handleOpenCreateKey}
          onExportCSV={handleExportCSV}
          onShowSmartMatch={handleShowSmartMatch}
        />

        {dashboard ? <CapacityAlertBanner dashboard={dashboard} /> : null}
        {dashboard ? <InventoryStatsCards dashboard={dashboard} /> : null}

        <InventoryFilters
          products={products}
          providers={providers}
          productIdFilter={productIdFilter}
          providerFilter={providerFilter}
          statusFilter={statusFilter}
          onProductFilterChange={setProductIdFilter}
          onProviderFilterChange={setProviderFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <div data-testid="inventory-list-shell">
          <InventoryTable
            filteredAccounts={filteredAccounts}
            providerById={providerById}
            productMap={productMap}
            onRowContextMenu={handleRowContextMenu}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
        </div>

        {selectedCount > 0 ? (
          <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-[1.2rem] bg-[var(--fg-base)] px-5 py-3 text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <span className="text-[13px] font-bold">{inventoryText.bulkBar.selected(selectedCount)}</span>
            <div className="h-6 w-px bg-white/20" />
            <button
              onClick={handleBulkExtend30}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[12px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
            >
              <Clock className="size-3.5" /> {inventoryText.bulkBar.extend30}
            </button>
            <button
              onClick={handleBulkSync}
              disabled={isBulkSyncing}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${isBulkSyncing ? "animate-spin" : ""}`} />
              {inventoryText.bulkBar.sync}
            </button>
            <button
              onClick={handleOpenBulkDeleteConfirm}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-[12px] font-bold text-red-300 transition-colors hover:bg-red-500/30"
            >
              <Trash2 className="size-3.5" />
              {inventoryText.bulkBar.delete}
            </button>
            <button
              onClick={handleClearSelection}
              className="ml-1 rounded-lg p-1.5 transition-colors hover:bg-white/10"
            >
              <X className="size-4 opacity-60" />
            </button>
          </div>
        ) : null}

        <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-all hover:shadow-[0_22px_52px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] p-5">
            <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">{inventoryText.pendingOrders.title}</h3>
          </div>
          <div className="overflow-x-auto">
            {pendingAllocationOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <PackageSearch className="mb-3 size-10 text-[var(--fg-muted)] opacity-50" />
                <h3 className="text-[15px] font-bold text-[var(--fg-base)]">{inventoryText.pendingOrders.empty}</h3>
              </div>
            ) : (
              <div className="flex flex-col border-t border-[var(--border-soft)]">
                <div className="hidden grid-cols-[minmax(0,2.5fr)_minmax(0,3fr)_minmax(0,2fr)_160px] items-center gap-4 border-b border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3 lg:grid">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{inventoryText.pendingOrders.headers.customerOrder}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{inventoryText.pendingOrders.headers.productRevenue}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{inventoryText.pendingOrders.headers.statusTime}</div>
                  <div className="pr-2 text-right text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{inventoryText.pendingOrders.headers.actions}</div>
                </div>
                <div className="flex flex-col divide-y divide-[var(--border-soft)]">
                  {pendingAllocationOrders.map((order) => {
                    const priceFormatted = formatMoney(order.total_amount_vnd || 0);
                    return (
                      <div key={order.id} className="group flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-gray-50 lg:grid lg:grid-cols-[minmax(0,2.5fr)_minmax(0,3fr)_minmax(0,2fr)_160px] lg:items-center">
                        <div className="flex min-w-0 flex-col">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">{inventoryText.pendingOrders.headers.customerOrder}</span>
                          <div className="truncate text-[14px] font-bold text-[var(--fg-base)] transition-colors group-hover:text-[var(--accent)]">
                            {order.customer?.full_name || inventoryText.pendingOrders.customerRetail}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="rounded border border-[var(--border-soft)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--fg-muted)]">
                              #{order.id.split("-")[0].toUpperCase()}
                            </span>
                            {order.contactSnapshot ? <span className="truncate text-[12px] text-[var(--fg-muted)]">• {order.contactSnapshot}</span> : null}
                          </div>
                        </div>

                        <div className="mt-2 flex min-w-0 flex-col border-t border-[var(--border-soft)] pt-3 lg:mt-0 lg:border-none lg:pt-0">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">{inventoryText.pendingOrders.headers.productRevenue}</span>
                          <div className="w-fit rounded-md border border-[var(--border-soft)] bg-gray-50/80 px-2.5 py-1 text-[13px] font-bold text-[var(--fg-base)] truncate lg:w-full lg:border-transparent lg:bg-transparent lg:px-0 lg:py-0">
                            {productMap.get(order.product_id) ?? order.product_id}
                          </div>
                          <div className="mt-1.5 text-[13px] font-black text-[var(--accent)] lg:mt-0.5">{priceFormatted}</div>
                        </div>

                        <div className="mt-2 flex min-w-0 flex-col items-start gap-1.5 border-t border-[var(--border-soft)] pt-3 lg:mt-0 lg:border-none lg:pt-0">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)] lg:hidden">{inventoryText.pendingOrders.headers.statusTime}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${order.status === "paid" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border border-[var(--warning)]/20 bg-[var(--warning)]/10 text-[var(--warning)]"}`}>
                            {order.status === "paid" ? inventoryText.pendingOrders.paymentStatus.paid : order.status === "pending_payment" ? inventoryText.pendingOrders.paymentStatus.pendingPayment : order.status === "provisioning" ? inventoryText.pendingOrders.paymentStatus.provisioning : order.status}
                          </span>
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[var(--fg-muted)] lg:mt-0">
                            <Clock className="size-3" />
                            {order.created_at ? formatDateLabel(order.created_at) : inventoryText.pendingOrders.noDate}
                          </div>
                        </div>

                        <div className="mt-4 flex w-full shrink-0 justify-end border-t border-[var(--border-soft)] pt-4 lg:mt-0 lg:w-auto lg:border-none lg:pt-0">
                          <AllocateOrderButton orderId={order.id} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
