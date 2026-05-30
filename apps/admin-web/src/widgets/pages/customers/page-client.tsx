"use client";

import { useCallback, useDeferredValue, useMemo, useState, useEffect, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import { FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";

import { appToast } from "@/shared/lib/toast";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import type { Customer } from "@/lib/domain/types";
import { vi } from "@/shared/messages/vi";
import { hasSearchTokens, matchesSearchQuery } from "@/shared/lib/filtering/search";
import {
  useCustomers,
  useUpdateCustomer,
  useDeleteCustomer,
  useBatchDeleteCustomers,
  useBatchUpdateTier,
  useCheckCustomerDependencies,
  useDebtSummary,
  useRecalculateRfm,
  useCustomersRealtime,
} from "@/widgets/pages/customers/hooks/use-customers";
import { useCustomerGroups, useAssignToGroup, useCreateGroup } from "@/widgets/pages/customers/hooks/use-customer-groups";
import { useCustomerTags, useBatchAssignTag } from "@/widgets/pages/customers/hooks/use-customer-tags";
import { CustomerFilters } from "@/widgets/pages/customers/components/customer-filters";
import { CustomersPageHeader } from "./components/customers-page-header";
import { CustomersPageList } from "./components/customers-page-list";
import { CustomersPageModals } from "./components/customers-page-modals";

const RfmBadge = dynamic(() => import("@/widgets/pages/customers/components/rfm-badge").then((m) => ({ default: m.RfmBadge })), { ssr: false });
const CustomerStatsDashboard = dynamic(() => import("@/widgets/pages/customers/components/customer-stats-dashboard").then((m) => ({ default: m.CustomerStatsDashboard })), { ssr: false });
const GroupTagManager = dynamic(() => import("@/widgets/pages/customers/components/group-tag-manager").then((m) => ({ default: m.GroupTagManager })), { ssr: false });
const CustomerKpiCards = dynamic(() => import("@/widgets/pages/customers/components/customer-kpi-cards").then((m) => ({ default: m.CustomerKpiCards })), { ssr: false });
const BatchActionBar = dynamic(() => import("@/widgets/pages/customers/components/batch-action-bar").then((m) => ({ default: m.BatchActionBar })), { ssr: false });
const CustomerDetailDrawer = dynamic(() => import("@/widgets/pages/customers/components/customer-detail-drawer").then((m) => ({ default: m.CustomerDetailDrawer })), { ssr: false });

export default function CustomersPage() {
  const { mutateAsync: updateCustomer } = useUpdateCustomer();
  const { mutateAsync: deleteCustomer } = useDeleteCustomer();
  const { mutateAsync: batchDelete, isPending: isBatchDeleting } = useBatchDeleteCustomers();
  const { mutateAsync: batchUpdateTier, isPending: isBatchUpdating } = useBatchUpdateTier();
  const { mutateAsync: checkDeps } = useCheckCustomerDependencies();
  const { data: groups = [] } = useCustomerGroups();
  const { mutateAsync: assignToGroupMutateAsync, isPending: isAssignToGroupPending } = useAssignToGroup();
  const { mutateAsync: createGroupMutateAsync, isPending: isCreateGroupPending } = useCreateGroup();
  const { data: allTags = [] } = useCustomerTags();
  const { mutateAsync: batchAssignTagMutateAsync, isPending: isBatchAssignTagPending } = useBatchAssignTag();
  const { mutateAsync: recalculateRfm, isPending: isRecalculating } = useRecalculateRfm();

  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("customers_view_mode") as "card" | "list";
      if (saved) {
        setViewMode(saved);
      }
    }
  }, []);

  const handleSetViewMode = useCallback((mode: "card" | "list") => {
    setViewMode(mode);
    localStorage.setItem("customers_view_mode", mode);
  }, []);

  useCustomersRealtime();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [renewingCustomer, setRenewingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [debtOnly, setDebtOnly] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showGroupTag, setShowGroupTag] = useState(false);
  const { data: debtSummary, isLoading: isDebtSummaryLoading } = useDebtSummary(showStats);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [batchDepInfo, setBatchDepInfo] = useState<{ customersWithOrders: number; totalOrders: number } | null>(null);
  const [showBatchTierModal, setShowBatchTierModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const deferredQuery = useDeferredValue(debouncedQuery);
  const { data: customers = [], isLoading } = useCustomers(deferredQuery);

  const filteredCustomers = useMemo(
    () =>
      customers.filter((customer) => {
        if (debtOnly && customer.debtAmountVnd <= 0) return false;
        if (typeFilter && customer.customerType !== typeFilter) return false;
        if (segmentFilter && customer.segment !== segmentFilter) return false;
        if (groupFilter && customer.group_id !== groupFilter) return false;
        if (tagFilter && !(customer.tags ?? []).some((tag) => tag.id === tagFilter)) return false;
        if (!hasSearchTokens(deferredQuery)) return true;

        return matchesSearchQuery(
          deferredQuery,
          customer.name,
          customer.contacts,
        );
      }),
    [customers, debtOnly, typeFilter, segmentFilter, groupFilter, tagFilter, deferredQuery]
  );

  const filteredCustomerIds = useMemo(
    () => filteredCustomers.map((customer) => customer.id),
    [filteredCustomers],
  );
  const selectedCustomerIds = useMemo(
    () => Array.from(selectedIds),
    [selectedIds],
  );
  const selectedCount = selectedCustomerIds.length;
  const allFilteredSelected = filteredCustomerIds.length > 0 && filteredCustomerIds.every((id) => selectedIds.has(id));
  const totalElements = filteredCustomers.length;
  const pageCount = Math.ceil(totalElements / pageSize);

  const handleOpenCreateCustomer = useCallback(() => {
    setIsCreateOpen(true);
  }, []);

  const handleToggleStats = useCallback(() => {
    setShowStats((previous) => !previous);
  }, []);

  const handleToggleGroupTag = useCallback(() => {
    setShowGroupTag((previous) => !previous);
    setShowStats(false);
  }, []);

  const handleSegmentFilterClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const segment = event.currentTarget.dataset.segment;
    if (!segment) return;
    setSegmentFilter((current) => (current === segment ? "" : segment));
    setPageIndex(0);
  }, []);

  const handleOpenBatchGroupModal = useCallback(() => {
    setShowGroupModal(true);
  }, []);

  const handleOpenBatchTagModal = useCallback(() => {
    setShowBatchTagModal(true);
  }, []);

  const handleOpenBatchTierModal = useCallback(() => {
    setShowBatchTierModal(true);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleCloseBatchDelete = useCallback(() => {
    setShowBatchDeleteConfirm(false);
    setBatchDepInfo(null);
  }, []);

  const handleCloseBatchTag = useCallback(() => {
    setShowBatchTagModal(false);
  }, []);

  const handleCloseBatchTier = useCallback(() => {
    setShowBatchTierModal(false);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeletingCustomer(null);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingCustomer(null);
  }, []);

  const handleCloseGroup = useCallback(() => {
    setShowGroupModal(false);
  }, []);

  const handleCloseRenewal = useCallback(() => {
    setRenewingCustomer(null);
  }, []);

  const handleCreateGroup = useCallback((input: Parameters<typeof createGroupMutateAsync>[0]) => {
    return createGroupMutateAsync(input);
  }, [createGroupMutateAsync]);

  const handleOpenGroupTag = useCallback(() => {
    setShowGroupTag(true);
  }, []);

  const handleOpenCustomer = useCallback((customerId: string) => {
    setIsCreateOpen(false);
    setEditingCustomer(null);
    setDeletingCustomer(null);
    setRenewingCustomer(null);
    setViewingCustomerId(customerId);
  }, []);

  const handleCloseCustomerDrawer = useCallback(() => {
    setViewingCustomerId(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingCustomer) return;
    try {
      await deleteCustomer(deletingCustomer.id);
      setDeletingCustomer(null);
      appToast.success(vi.customers.toast.deleted);
    } catch {
      appToast.error(vi.customers.toast.deleteError);
    }
  }, [deleteCustomer, deletingCustomer]);

  const handleBatchDeleteStart = useCallback(async () => {
    try {
      const deps = await checkDeps(selectedCustomerIds);
      setBatchDepInfo(deps);
    } catch {
      setBatchDepInfo(null);
    }
    setShowBatchDeleteConfirm(true);
  }, [checkDeps, selectedCustomerIds]);

  const handleBatchDeleteConfirm = useCallback(async () => {
    try {
      const result = await batchDelete(selectedCustomerIds);
      appToast.success(vi.customers.toast.bulkDeleted(result.deletedCount));
      setSelectedIds(new Set());
      setShowBatchDeleteConfirm(false);
      setBatchDepInfo(null);
    } catch {
      appToast.error(vi.customers.toast.bulkDeleteError);
    }
  }, [batchDelete, selectedCustomerIds]);

  const handleBatchTypeConfirm = useCallback(async (tier: "retail" | "wholesale" | "agency") => {
    try {
      const result = await batchUpdateTier({ customerIds: selectedCustomerIds, customerType: tier });
      appToast.success(vi.customers.toast.bulkUpdated(result.updatedCount));
      setSelectedIds(new Set());
      setShowBatchTierModal(false);
    } catch {
      appToast.error(vi.customers.toast.bulkUpdateError);
    }
  }, [batchUpdateTier, selectedCustomerIds]);

  const handleAssignToGroup = useCallback(async (groupId: string) => {
    try {
      await assignToGroupMutateAsync({ groupId, customerIds: selectedCustomerIds });
      setSelectedIds(new Set());
      setShowGroupModal(false);
    } catch {
      // handled by hook
    }
  }, [assignToGroupMutateAsync, selectedCustomerIds]);

  const handleBatchTagAssign = useCallback(async (tagId: string) => {
    try {
      await batchAssignTagMutateAsync({ customerIds: selectedCustomerIds, tagId });
      setSelectedIds(new Set());
      setShowBatchTagModal(false);
    } catch {
      // handled by hook
    }
  }, [batchAssignTagMutateAsync, selectedCustomerIds]);

  const handleClearDebt = useCallback(async (id: string) => {
    try {
      await updateCustomer({ id, debtAmountVnd: 0, debtOverdueDays: 0 });
      appToast.success(vi.customers.toast.debtCleared);
    } catch {
      appToast.error(vi.customers.toast.debtError);
    }
  }, [updateCustomer]);

  const handleRecalculateRfm = useCallback(async () => {
    try {
      const result = await recalculateRfm();
      appToast.success(vi.customers.toast.rfmUpdated(result.updatedCount));
    } catch {
      appToast.error(vi.customers.toast.rfmError);
    }
  }, [recalculateRfm]);

  const handleRenewal = useCallback(async (debtDays: string, debtAmount: string) => {
    if (!renewingCustomer) return;
    const body: Record<string, unknown> = {};
    if (debtDays !== "") body.debtOverdueDays = Number(debtDays);
    if (debtAmount !== "") body.debtAmountVnd = Number(debtAmount);
    await updateCustomer({ id: renewingCustomer.id, ...body });
    setRenewingCustomer(null);
    appToast.success(vi.customers.toast.debtUpdated);
  }, [renewingCustomer, updateCustomer]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allFilteredSelected ? new Set() : new Set(filteredCustomerIds));
  }, [allFilteredSelected, filteredCustomerIds]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPageIndex(0);
  }, []);

  const handleTypeFilterChange = useCallback((value: string) => {
    setTypeFilter(value);
    setPageIndex(0);
  }, []);

  const handleDebtOnlyChange = useCallback((value: boolean) => {
    setDebtOnly(value);
    setPageIndex(0);
  }, []);

  const handleGroupFilterChange = useCallback((value: string) => {
    setGroupFilter(value);
    setPageIndex(0);
  }, []);

  const handleTagFilterChange = useCallback((value: string) => {
    setTagFilter(value);
    setPageIndex(0);
  }, []);

  const viewingCustomer = useMemo(
    () => customers.find((customer) => customer.id === viewingCustomerId) ?? null,
    [customers, viewingCustomerId],
  );

  return (
    <AppLayout>
      <PageContainer className="relative">
        <CustomersPageHeader
          customers={filteredCustomers}
          isRecalculating={isRecalculating}
          onCreateClick={handleOpenCreateCustomer}
          onRecalculateRfm={handleRecalculateRfm}
        />

        <CustomerKpiCards customers={customers} />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleToggleStats}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[12px] font-bold transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${
              showStats ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border-soft)] bg-white text-[var(--fg-muted)] hover:bg-gray-50"
            }`}
          >
            📊 {showStats ? vi.customers.page.hideStats : vi.customers.page.showStats}
          </button>
          <button
            onClick={handleToggleGroupTag}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[12px] font-bold transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${
              showGroupTag ? "border-[#6366f1]/30 bg-[#6366f1]/10 text-[#6366f1]" : "border-[var(--border-soft)] bg-white text-[var(--fg-muted)] hover:bg-gray-50"
            }`}
          >
            <FolderPlus className="size-3.5" />
            {showGroupTag ? vi.customers.page.hideGroupsAndTags : vi.customers.page.manageGroupsAndTags}
          </button>

          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-250/80">
            <button
              onClick={() => handleSetViewMode("card")}
              className={cn(
                "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-150",
                viewMode === "card"
                  ? "bg-white text-[var(--accent)] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Thẻ
            </button>
            <button
              onClick={() => handleSetViewMode("list")}
              className={cn(
                "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-150",
                viewMode === "list"
                  ? "bg-white text-[var(--accent)] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Danh sách
            </button>
          </div>

          <div className="min-w-0 w-full md:ml-auto md:w-auto">
            <div className="flex max-w-full items-center gap-1 overflow-x-auto pb-1 md:justify-end md:overflow-visible md:pb-0">
              {(["vip", "loyal", "regular", "at_risk", "churned"] as const).map((seg) => (
                <button
                  key={seg}
                  data-segment={seg}
                  onClick={handleSegmentFilterClick}
                  className={`cursor-pointer whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-[background-color,border-color,box-shadow,color,opacity,transform,width] ${
                    segmentFilter === seg
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border-soft)] bg-white text-[var(--fg-muted)] hover:bg-gray-50"
                  }`}
                >
                  <RfmBadge segment={seg} size="sm" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {showStats ? (
          <div className="mb-6">
            <CustomerStatsDashboard
              customers={customers}
              groups={groups}
              debtSummary={debtSummary}
              isDebtSummaryLoading={isDebtSummaryLoading}
              onOpenCustomer={handleOpenCustomer}
            />
          </div>
        ) : null}
        {showGroupTag ? (
          <div className="mb-6 animate-in slide-in-from-top-2 fade-in duration-200">
            <GroupTagManager />
          </div>
        ) : null}

        <CustomerFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          groupFilter={groupFilter}
          onGroupFilterChange={handleGroupFilterChange}
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
          debtOnly={debtOnly}
          onDebtOnlyChange={handleDebtOnlyChange}
          tagFilter={tagFilter}
          onTagFilterChange={handleTagFilterChange}
          groups={groups}
          tags={allTags}
        />

        {selectedCount > 0 ? (
          <BatchActionBar
            selectedCount={selectedCount}
            onGroupAssign={handleOpenBatchGroupModal}
            onBatchTag={handleOpenBatchTagModal}
            onBatchTier={handleOpenBatchTierModal}
            onBatchDelete={handleBatchDeleteStart}
            onClearSelection={handleClearSelection}
          />
        ) : null}

        <CustomersPageList
          customers={filteredCustomers}
          debouncedQuery={deferredQuery}
          groups={groups}
          isLoading={isLoading}
          onCreateFirstCustomer={handleOpenCreateCustomer}
          onClearDebt={handleClearDebt}
          onDeleteCustomer={setDeletingCustomer}
          onEditCustomer={setEditingCustomer}
          onOpenCustomer={handleOpenCustomer}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          onRenewCustomer={setRenewingCustomer}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          pageCount={pageCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          selectedCount={selectedCount}
          selectedIds={selectedIds}
          totalElements={totalElements}
          allFilteredSelected={allFilteredSelected}
          viewMode={viewMode}
        />

        <CustomerDetailDrawer
          isOpen={!!viewingCustomerId}
          customerId={viewingCustomerId}
          fallbackCustomer={viewingCustomer}
          groups={groups}
          onClose={handleCloseCustomerDrawer}
          onEditCustomer={setEditingCustomer}
          onRenewCustomer={setRenewingCustomer}
          onClearDebt={handleClearDebt}
        />
      </PageContainer>

      <CustomersPageModals
        allTags={allTags}
        assignToGroupPending={isAssignToGroupPending}
        batchDepInfo={batchDepInfo}
        batchDeletePending={isBatchDeleting}
        batchTagPending={isBatchAssignTagPending}
        batchTierPending={isBatchUpdating}
        createGroupPending={isCreateGroupPending}
        deletingCustomer={deletingCustomer}
        editingCustomer={editingCustomer}
        groups={groups}
        isCreateOpen={isCreateOpen}
        renewingCustomer={renewingCustomer}
        selectedCount={selectedCount}
        showBatchDeleteConfirm={showBatchDeleteConfirm}
        showBatchTagModal={showBatchTagModal}
        showBatchTierModal={showBatchTierModal}
        showGroupModal={showGroupModal}
        onAssignToGroup={handleAssignToGroup}
        onBatchDeleteConfirm={handleBatchDeleteConfirm}
        onBatchTagAssign={handleBatchTagAssign}
        onBatchTierConfirm={handleBatchTypeConfirm}
        onCloseBatchDelete={handleCloseBatchDelete}
        onCloseBatchTag={handleCloseBatchTag}
        onCloseBatchTier={handleCloseBatchTier}
        onCloseCreate={handleCloseCreate}
        onCloseDelete={handleCloseDelete}
        onCloseEdit={handleCloseEdit}
        onCloseGroup={handleCloseGroup}
        onCloseRenewal={handleCloseRenewal}
        onCreateGroup={handleCreateGroup}
        onDeleteConfirm={handleDelete}
        onOpenGroupTag={handleOpenGroupTag}
        onRenewalSave={handleRenewal}
      />
    </AppLayout>
  );
}
