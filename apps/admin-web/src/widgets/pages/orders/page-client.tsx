"use client";

import { useState, useMemo, useCallback, useDeferredValue, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Printer, Trash2, CheckCircle2, Clock } from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { hasSearchTokens } from "@/shared/lib/filtering/search";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { useContextMenu } from "@/shared/ui/context-menu";

import { OrdersPageHeader } from "./components/orders-page-header";
import { OrdersPageModals } from "./components/orders-page-modals";
import { OrdersFilterBar } from "@/widgets/pages/orders/components/orders-filter-bar";
import type { OrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import { useOrders, useUpdateOrder, useDeleteOrder, useBatchDeleteOrders, useOrdersRealtime } from "@/widgets/pages/orders/hooks/use-orders";
import type { OrderRow } from "@/widgets/pages/orders/components/orders-table";
import { OrdersKPIs } from "@/widgets/pages/orders/components/orders-kpis";
import { OrdersTable } from "@/widgets/pages/orders/components/orders-table";
import { BulkActionBar } from "@/widgets/pages/orders/components/bulk-action-bar";

/* ─── Types ──────────────────────────────────────────────── */
type RawOrder = Record<string, unknown> & {
  id: string;
  customer_id: string;
  product_id: string;
  total_amount_vnd: number;
  total_cost_vnd: number | null;
  payment_method?: string | null;
  payment_terms?: string | null;
  payment_state?: string | null;
  balance_due_vnd?: number | null;
  is_fully_paid?: boolean | null;
  customer?: { full_name?: string; customer_contacts?: Array<{ id: string; channel: string; value: string; is_verified: boolean }> };
  product?: { name?: string };
  sales_channel?: { id: string; name: string } | null;
  payment_source?: { id: string; name: string; icon: string | null } | null;
  unit_price_vnd?: number | null;
  cost_price_vnd?: number | null;
  sales_note?: string | null;
  contact_snapshot?: unknown | null;
  proof_image_urls?: string[] | null;
};

type OrdersListState = {
  pageIndex: number;
  pageSize: number;
  searchQuery: string;
  statusFilter: string;
  dateFrom: string;
  dateTo: string;
};

type QueryReader = {
  get: (name: string) => string | null;
};

const DEFAULT_PAGE_SIZE = 50;

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readOrdersListState(params: QueryReader): OrdersListState {
  const page = parsePositiveInteger(params.get("page"), 1);
  const pageSize = parsePositiveInteger(params.get("page_size"), DEFAULT_PAGE_SIZE);

  return {
    pageIndex: page - 1,
    pageSize,
    searchQuery: params.get("search") ?? "",
    statusFilter: params.get("status") ?? "",
    dateFrom: params.get("date_from") ?? "",
    dateTo: params.get("date_to") ?? "",
  };
}

function setOptionalQueryParam(params: URLSearchParams, key: string, value: string) {
  const normalized = value.trim();
  if (normalized) {
    params.set(key, normalized);
  } else {
    params.delete(key);
  }
}

function writeOrdersListState(params: URLSearchParams, state: OrdersListState) {
  setOptionalQueryParam(params, "search", state.searchQuery);
  setOptionalQueryParam(params, "status", state.statusFilter);
  setOptionalQueryParam(params, "date_from", state.dateFrom);
  setOptionalQueryParam(params, "date_to", state.dateTo);

  if (state.pageIndex > 0) {
    params.set("page", String(state.pageIndex + 1));
  } else {
    params.delete("page");
  }

  if (state.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("page_size", String(state.pageSize));
  } else {
    params.delete("page_size");
  }
}

function buildOrdersHref(params: URLSearchParams) {
  const queryString = params.toString();
  return queryString ? `/orders?${queryString}` : "/orders";
}

/* ─── Helpers ────────────────────────────────────────────── */
function mapRawToOrderRow(order: RawOrder): OrderRow {
  const customer = order.customer;
  const product = order.product;
  const contacts = (customer?.customer_contacts || []).map((c) => ({
    id: c.id,
    channel: c.channel || "other",
    value: c.value || "",
    is_verified: !!c.is_verified,
  }));
  const primaryContact = contacts[0];

  return {
    ...order,
    customerName: customer?.full_name || order.customer_id,
    productName: product?.name || order.product_id,
    customerEmail: primaryContact?.value ?? "No contact",
    customerContacts: contacts,
    salesChannelName: order.sales_channel?.name ?? null,
    paymentSourceName: order.payment_source?.name ?? null,
    payment_method: order.payment_method ?? null,
    payment_terms: order.payment_terms ?? null,
    payment_state: order.payment_state ?? null,
    balance_due_vnd: order.balance_due_vnd ?? undefined,
    is_fully_paid: order.is_fully_paid ?? undefined,
    unit_price_vnd: order.unit_price_vnd ?? null,
    cost_price_vnd: order.cost_price_vnd ?? null,
    sales_note: order.sales_note ?? null,
    contact_snapshot: order.contact_snapshot ?? null,
    proof_image_urls: order.proof_image_urls ?? null,
  } as OrderRow;
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialListState = readOrdersListState(searchParams);
  const [pageIndex, setPageIndex] = useState(initialListState.pageIndex);
  const [pageSize, setPageSize] = useState(initialListState.pageSize);
  const [searchQuery, setSearchQuery] = useState(initialListState.searchQuery);
  const [statusFilter, setStatusFilter] = useState(initialListState.statusFilter);
  const [dateFrom, setDateFrom] = useState(initialListState.dateFrom);
  const [dateTo, setDateTo] = useState(initialListState.dateTo);

  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState<OrderRow | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkSelectValue, setBulkSelectValue] = useState("");
  const [isRenewalDrawerOpen, setIsRenewalDrawerOpen] = useState(false);
  const [renewingOrder, setRenewingOrder] = useState<OrderRow | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingOrder, setPayingOrder] = useState<OrderRow | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<OrderWithItems | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 500);
  const deferredQuery = useDeferredValue(debouncedQuery);
  const hasSearchQuery = hasSearchTokens(deferredQuery);

  useEffect(() => {
    const nextListState = readOrdersListState(searchParams);
    setPageIndex(nextListState.pageIndex);
    setPageSize(nextListState.pageSize);
    setSearchQuery(nextListState.searchQuery);
    setStatusFilter(nextListState.statusFilter);
    setDateFrom(nextListState.dateFrom);
    setDateTo(nextListState.dateTo);
  }, [searchParams]);

  const { data: pageData, isLoading, isFetching } = useOrders({
    page: pageIndex + 1,
    limit: pageSize,
    search: hasSearchQuery ? deferredQuery.trim() : undefined,
    status: statusFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const { mutateAsync: updateOrder } = useUpdateOrder();
  const { mutateAsync: deleteOrder } = useDeleteOrder();
  const { mutateAsync: batchDeleteOrders, isPending: isBatchDeleting } = useBatchDeleteOrders();

  useOrdersRealtime();

  const meta = pageData?.meta || { count: 0, totalPages: 0 };
  const isLocalFixture = pageData?.meta?.source === "local-fixture";
  const mappedOrders = useMemo(() => {
    const rawOrdersData = pageData?.data || [];
    const rawOrders = rawOrdersData as unknown as RawOrder[];
    return rawOrders.map(mapRawToOrderRow);
  }, [pageData?.data]);
  const selectedOrderIdsArray = useMemo(() => Array.from(selectedOrderIds), [selectedOrderIds]);
  const selectedOrderCount = selectedOrderIdsArray.length;
  const handleToggleOrderSelect = useCallback((orderId: string) => {
    setSelectedOrderIds((previous) => {
      const next = new Set(previous);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const { openContextMenu, ContextMenuRender } = useContextMenu();

  const replaceListQuery = useCallback(
    (nextState: Partial<OrdersListState>) => {
      const mergedState: OrdersListState = {
        pageIndex,
        pageSize,
        searchQuery,
        statusFilter,
        dateFrom,
        dateTo,
        ...nextState,
      };
      const params = new URLSearchParams(searchParams.toString());
      writeOrdersListState(params, mergedState);
      router.replace(buildOrdersHref(params), { scroll: false });
    },
    [dateFrom, dateTo, pageIndex, pageSize, router, searchParams, searchQuery, statusFilter],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPageIndex(0);
    replaceListQuery({ searchQuery: value, pageIndex: 0 });
  }, [replaceListQuery]);

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPageIndex(0);
    replaceListQuery({ statusFilter: value, pageIndex: 0 });
  }, [replaceListQuery]);

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
    setPageIndex(0);
    replaceListQuery({ dateFrom: value, pageIndex: 0 });
  }, [replaceListQuery]);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
    setPageIndex(0);
    replaceListQuery({ dateTo: value, pageIndex: 0 });
  }, [replaceListQuery]);

  const handlePaginationChange = useCallback((newPageIndex: number, newPageSize: number) => {
    setPageIndex(newPageIndex);
    setPageSize(newPageSize);
    replaceListQuery({ pageIndex: newPageIndex, pageSize: newPageSize });
  }, [replaceListQuery]);

  const handleRowClick = useCallback((row: OrderRow) => {
    router.push(`/orders/${row.id}`);
  }, [router]);

  const handleUpdateStatus = useCallback(async (orderId: string, status: string) => {
    try {
      await updateOrder({ id: orderId, status });
      setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
      appToast.success(`Đã chuyển trạng thái thành ${status.toUpperCase()}`);
    } catch {
      appToast.error("Lỗi cập nhật trạng thái");
    }
  }, [updateOrder]);

  const handleDeleteOrder = useCallback(async () => {
    if (!deletingOrder) return;
    try {
      await deleteOrder(deletingOrder.id);
      setDeletingOrder(null);
      setIsDrawerOpen(false);
      appToast.success("Đã xóa đơn hàng!");
    } catch {
      appToast.error("Lỗi xóa đơn hàng");
    }
  }, [deletingOrder, deleteOrder]);

  async function handleBulkStatusUpdate(newStatus: string) {
    if (selectedOrderCount === 0 || !newStatus) return;
    try {
      await Promise.all(selectedOrderIdsArray.map((id) => updateOrder({ id, status: newStatus })));
      appToast.success(`Đã cập nhật ${selectedOrderCount} đơn hàng`);
      setSelectedOrderIds(new Set());
      setBulkSelectValue("");
    } catch {
      appToast.error("Có lỗi xảy ra khi cập nhật nhiều đơn hàng");
    }
  }

  async function handleBatchDelete() {
    if (selectedOrderCount === 0) return;
    try {
      await batchDeleteOrders(selectedOrderIdsArray);
      appToast.success(`Đã xóa ${selectedOrderCount} đơn hàng`);
      setSelectedOrderIds(new Set());
      setBulkSelectValue("");
      setShowBatchDeleteConfirm(false);
    } catch (error) {
      appToast.error(error instanceof Error && error.message ? error.message : "Có lỗi xảy ra khi xóa hàng loạt");
    }
  }

  async function handleRenewOrder(formData: FormData) {
    if (!renewingOrder) return;
    const expiresAt = formData.get("expires_at") as string;
    if (!expiresAt) return;
    try {
      await updateOrder({ id: renewingOrder.id, expires_at: new Date(expiresAt).toISOString() });
      appToast.success("Đã cập nhật ngày hết hạn!");
      setIsRenewalDrawerOpen(false);
    } catch {
      appToast.error("Lỗi khi gia hạn");
    }
  }

  async function fetchAndPrint(orderId: string) {
    appToast.loading("Đang tải chi tiết hóa đơn...", { id: `print-${orderId}` });
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setPrintingOrder(data);
      setIsPrintModalOpen(true);
      appToast.dismiss(`print-${orderId}`);
    } catch {
      appToast.error("Lỗi khi tải dữ liệu hóa đơn", { id: `print-${orderId}` });
    }
  }

  function handleRowContextMenu(e: React.MouseEvent, order: OrderRow) {
    openContextMenu(e, [
      { label: "Xem chi tiết", icon: <Eye className="size-4" />, onClick: () => router.push(`/orders/${order.id}`) },
      { label: "Ghi nhận thanh toán", icon: <CheckCircle2 className="size-4" />, onClick: () => { setPayingOrder(order); setIsPaymentModalOpen(true); } },
      { label: "Gia hạn / Sửa ngày HH", icon: <Clock className="size-4" />, onClick: () => { setRenewingOrder(order); setIsRenewalDrawerOpen(true); } },
      { label: "In hóa đơn", icon: <Printer className="size-4" />, onClick: () => fetchAndPrint(order.id) },
      { label: "Xóa đơn hàng", icon: <Trash2 className="size-4" />, danger: true, onClick: () => setDeletingOrder(order) },
    ]);
  }

  return (
    <AppLayout>
      <ContextMenuRender />

      <OrdersPageModals
        deletingOrder={deletingOrder}
        isBatchDeleting={isBatchDeleting}
        isDrawerOpen={isDrawerOpen}
        isPaymentModalOpen={isPaymentModalOpen}
        isPrintModalOpen={isPrintModalOpen}
        isRenewalDrawerOpen={isRenewalDrawerOpen}
        onBatchDeleteConfirm={handleBatchDelete}
        onCloseBatchDelete={() => setShowBatchDeleteConfirm(false)}
        onCloseDelete={() => setDeletingOrder(null)}
        onCloseDrawer={() => setIsDrawerOpen(false)}
        onClosePayment={() => setIsPaymentModalOpen(false)}
        onClosePrint={() => setIsPrintModalOpen(false)}
        onCloseRenewal={() => setIsRenewalDrawerOpen(false)}
        onDeleteConfirm={handleDeleteOrder}
        onPaymentSuccess={() => {
          setIsPaymentModalOpen(false);
          setPayingOrder(null);
        }}
        onRenewSubmit={handleRenewOrder}
        onStatusChange={handleUpdateStatus}
        onPaymentClick={() => {
          if (selectedOrder) {
            setPayingOrder(selectedOrder);
            setIsPaymentModalOpen(true);
          }
        }}
        onRenewClick={() => {
          if (selectedOrder) {
            setRenewingOrder(selectedOrder);
            setIsRenewalDrawerOpen(true);
          }
        }}
        onPrintClick={() => {
          if (selectedOrder) {
            fetchAndPrint(selectedOrder.id);
          }
        }}
        onDeleteClick={() => {
          if (selectedOrder) {
            setDeletingOrder(selectedOrder);
            setIsDrawerOpen(false);
          }
        }}
        payingOrder={payingOrder}
        printingOrder={printingOrder}
        renewingOrder={renewingOrder}
        selectedOrder={selectedOrder}
        selectedOrderIdsCount={selectedOrderCount}
        showBatchDeleteConfirm={showBatchDeleteConfirm}
      />

      <PageContainer className="relative">
        <OrdersPageHeader
          totalOrders={meta.count}
          isFetching={isFetching && !isLoading}
          hasFilters={Boolean(hasSearchQuery || statusFilter || dateFrom || dateTo)}
          isLocalFixture={isLocalFixture}
        />

        <OrdersKPIs
          search={deferredQuery || undefined}
          status={statusFilter || undefined}
          date_from={dateFrom || undefined}
          date_to={dateTo || undefined}
        />

        <OrdersFilterBar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          dateFrom={dateFrom}
          onDateFromChange={handleDateFromChange}
          dateTo={dateTo}
          onDateToChange={handleDateToChange}
        />

        <div className={`mt-6 ${isFetching && !isLoading ? "pointer-events-none opacity-60" : ""}`}>
          <OrdersTable
            isLoading={isLoading}
            pageCount={meta.totalPages}
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalElements={meta.count}
            onPaginationChange={handlePaginationChange}
            mappedOrders={mappedOrders}
            selectedOrderIds={selectedOrderIds}
            onToggleSelect={handleToggleOrderSelect}
            setSelectedOrderIds={setSelectedOrderIds}
            onRowClick={handleRowClick}
            onRowContextMenu={handleRowContextMenu}
          />
        </div>
      </PageContainer>

      {selectedOrderCount > 0 && (
        <BulkActionBar
          selectedCount={selectedOrderCount}
          bulkSelectValue={bulkSelectValue}
          onBulkSelectChange={setBulkSelectValue}
          onApplyStatus={() => {
            if (bulkSelectValue) handleBulkStatusUpdate(bulkSelectValue);
          }}
          onBatchDelete={() => setShowBatchDeleteConfirm(true)}
          onClear={() => {
            setSelectedOrderIds(new Set());
            setBulkSelectValue("");
          }}
        />
      )}
    </AppLayout>
  );
}
