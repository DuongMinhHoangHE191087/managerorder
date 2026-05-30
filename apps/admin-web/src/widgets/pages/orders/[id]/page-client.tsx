"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Mail, Phone, User, Store, Key,
  Banknote, CreditCard, Clock, Package,
  FileText, Copy, ArrowLeft, RefreshCw, AlertTriangle, Wallet, History,
  Printer, Plus, Edit3, ImagePlus, TrendingUp, Loader2, Trash2
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { vi } from "@/shared/messages/vi";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { Button } from "@/shared/ui/button";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import { getStatusLabel, getStatusStyle } from "@/widgets/pages/orders/lib/status";
import { useUpdateOrder, useOrder } from "@/widgets/pages/orders/hooks/use-orders";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import { getOrderNextStatuses } from "@/lib/domain/order-state-machine";
import type { OrderStatus } from "@/lib/domain/types";
import { usePurgeItems, useRestoreItems } from "@/widgets/pages/trash/hooks/use-trash";
import { SoftDeletedBadge } from "@/shared/ui/soft-deleted-badge";
import { AccountShareLauncher } from "@/widgets/pages/inventory/components/account-share-launcher";

/* ─── Types ──────────────────────────────────────────────── */
interface LicenseKey {
  id: string;
  key_code: string;
}

interface OrderItemWithRelations {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_vnd: number;
  cost_price_vnd: number | null;
  subtotal_vnd: number;
  notes: string | null;
  product_name_snapshot: string | null;
  assigned_source_account_id: string | null;
  customer_nick_used: string | null;
  created_at: string;
  assigned_source_account?: { id: string; email: string; provider: string } | null;
  license_keys?: LicenseKey[] | null;
}

interface OrderDetail {
  id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  total_amount_vnd: number;
  total_paid: number;
  total_cost_vnd: number | null;
  unit_price_vnd: number | null;
  cost_price_vnd: number | null;
  payment_method: string | null;
  payment_terms?: string | null;
  payment_state?: string | null;
  balance_due_vnd?: number;
  is_fully_paid?: boolean;
  payment_source_id: string | null;
  sales_channel_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  sales_note: string | null;
  contact_snapshot: string | null;
  proof_image_urls: string[] | null;
  customer?: {
    id: string;
    full_name: string;
    type?: string;
    customer_contacts: { id: string; channel: string; value: string; is_verified: boolean }[];
  } | null;
  product?: {
    id: string;
    name: string;
    mode?: string;
  } | null;
  sales_channel?: {
    id: string;
    name: string;
  } | null;
  payment_source?: {
    id: string;
    name: string;
    icon?: string | null;
  } | null;
  items: OrderItemWithRelations[];
}

function AsyncPanelFallback({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/40 p-6 text-[13px] font-medium text-[var(--fg-muted)]">
      <Loader2 className="mr-2 size-4 animate-spin text-[var(--accent)]" />
      {vi.orders.detail.loadingTab(label)}
    </div>
  );
}

const PaymentModal = dynamic(
  () =>
    import("@/widgets/pages/orders/components/payment-modal").then((mod) => ({
      default: mod.PaymentModal,
    })),
  { ssr: false }
);

const EditOrderModal = dynamic(
  () =>
    import("@/widgets/pages/orders/components/edit-order-modal").then((mod) => ({
      default: mod.EditOrderModal,
    })),
  { ssr: false }
);

const RenewOrderModal = dynamic(
  () =>
    import("@/widgets/pages/orders/components/renew-order-modal").then((mod) => ({
      default: mod.RenewOrderModal,
    })),
  { ssr: false }
);

const AllocateOrderButton = dynamic(
  () =>
    import("@/widgets/pages/orders/components/allocate-order-button").then((mod) => ({
      default: mod.AllocateOrderButton,
    })),
  {
    loading: () => (
      <Button variant="secondary" disabled className="text-[13px] font-bold">
        {vi.orders.detail.loadingTab("cấp phát")}
      </Button>
    ),
    ssr: false,
  }
);

const RefundDetailPanel = dynamic(
  () =>
    import("@/widgets/pages/orders/components/refund-detail-panel").then((mod) => ({
      default: mod.RefundDetailPanel,
    })),
  {
    loading: () => <AsyncPanelFallback label="hoàn tiền" />,
  }
);

const ActivityTimeline = dynamic(
  () =>
    import("@/widgets/pages/activity-logs/components/activity-timeline").then((mod) => ({
      default: mod.ActivityTimeline,
    })),
  {
    loading: () => <AsyncPanelFallback label="lịch sử hoạt động" />,
  }
);

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const trashMode = searchParams.get("trash") === "1";
  const queryClient = useQueryClient();

  const { data: rawOrderResult, isLoading, error } = useOrder(orderId, trashMode);
  const order = (rawOrderResult?.data as OrderDetail | undefined | null) ?? null;
  const isTrashView = trashMode || Boolean(rawOrderResult?.softDeleted);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const restoreItems = useRestoreItems();
  const purgeItems = usePurgeItems();
  
  const { mutateAsync: updateOrder } = useUpdateOrder();

  /* ─── Handlers ──────────────────────────────────────────── */
  async function handleUpdateStatus(newStatus: string) {
    if (!order) return;
    try {
      await updateOrder({ id: order.id, status: newStatus });
      queryClient.setQueryData(queryKeys.order(order.id), (old: OrderDetail | undefined | null) => old ? { ...old, status: newStatus } : old);
       appToast.success(vi.orders.detail.statusUpdated(getStatusLabel(newStatus)));
     } catch {
       appToast.error(vi.orders.detail.statusError);
     }
  }

  function refetchOrder() {
    queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
  }

  function handleDuplicateOrder() {
    if (!order) return;
    const params = new URLSearchParams({
      customer_id: order.customer_id,
      product_id: order.product_id,
      quantity: String(order.quantity),
    });
    router.push(`/orders/new?${params.toString()}`);
  }

  async function handleRestoreFromTrash() {
    if (!order) return;
    await restoreItems.mutateAsync({ type: "orders", ids: [order.id] });
    router.replace(`/orders/${order.id}`);
  }

  async function handlePurgeFromTrash() {
    if (!order) return;
    await purgeItems.mutateAsync({ type: "orders", ids: [order.id] });
    router.push("/trash?type=orders");
  }

  async function fetchAndPrint(orderId: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`);
       if (!res.ok) { appToast.error(vi.orders.detail.invoiceError); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) w.onload = () => w.print();
    } catch {
       appToast.error(vi.orders.detail.invoicePrintError);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="size-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error || !order) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <Package className="size-16 text-[var(--fg-muted)] mx-auto mb-4 opacity-30" />
          <h2 className="text-2xl font-bold text-[var(--fg-base)] mb-2">{vi.orders.detail.notFoundTitle}</h2>
          <p className="text-[var(--fg-muted)] text-[15px] mb-6">{vi.orders.detail.notFoundDescription}</p>
          <Button variant="primary" onClick={() => router.push("/orders")}>
            <ArrowLeft className="size-4 mr-2" /> {vi.orders.detail.backToList}
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Computed
  const customerName = order.customer?.full_name || order.customer_id;
  const productName = order.product?.name || order.product_id;
  const contacts = order.customer?.customer_contacts || [];
  const salesChannelName = order.sales_channel?.name || order.sales_channel_id || "Chưa gán kênh bán";
  const paymentSourceName = order.payment_source?.name || order.payment_source_id || "Chưa gán nguồn tiền";
  
  const totalAmount = order.total_amount_vnd || 0;
  const totalPaid = order.total_paid || 0;
  const totalCost = order.total_cost_vnd || 0;
  const profit = totalAmount - totalCost;
  const remaining = order.balance_due_vnd ?? Math.max(totalAmount - totalPaid, 0);
  const paidPercent = totalAmount > 0 ? Math.min((totalPaid / totalAmount) * 100, 100) : 0;
  const isDebt = remaining > 0 && order.status !== "refunded";

  return (
    <AppLayout>
      <PageContainer className="relative pb-10">
        {/* ── Breadcrumbs & Header ── */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-2 mt-2">
          <div>
            <div className="flex items-center gap-2 text-[var(--accent)] text-[13px] font-bold mb-1.5">
               <Link className="hover:underline flex items-center gap-1" href="/orders"><ArrowLeft className="size-3" /> {vi.orders.detail.breadcrumbRoot}</Link>
              <ChevronRight className="size-3" />
               <span className="text-[var(--fg-muted)]">{vi.orders.detail.title} #{order.id.slice(0,8)}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-[var(--fg-base)] tracking-tight">{vi.orders.detail.title}</h1>
              {isTrashView ? <SoftDeletedBadge /> : null}
              <span className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider ${getStatusStyle(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push(isTrashView ? "/trash?type=orders" : "/orders")}
            className="text-[13px] font-bold"
          >
            <ArrowLeft className="size-4 mr-1.5" /> {vi.orders.detail.back}
          </Button>
          <Button variant="secondary" onClick={handleDuplicateOrder} className="text-[13px] font-bold">
            <Plus className="size-4 mr-1.5" /> {vi.orders.detail.duplicate}
          </Button>
          <Button variant="secondary" onClick={() => fetchAndPrint(order.id)} className="text-[13px] font-bold">
            <Printer className="size-4 mr-1.5" /> {vi.orders.detail.printInvoice}
          </Button>
            {!isTrashView && order.expires_at && (
              <Button
                variant="secondary"
                onClick={() => setIsRenewModalOpen(true)}
                className="text-[13px] font-bold"
              >
              <RefreshCw className="size-4 mr-1.5" /> {vi.orders.detail.renew}
              </Button>
            )}
            {!isTrashView ? (
              <>
                <Button variant="secondary" onClick={() => setIsEditModalOpen(true)} className="text-[13px] font-bold">
                  <Edit3 className="size-4 mr-1.5" /> {vi.orders.detail.editInfo}
                </Button>
                <Button variant="primary" onClick={() => setIsPaymentModalOpen(true)} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 active:scale-[0.98] shadow-sm text-[13px] font-bold border-none text-white">
                  <CreditCard className="size-4 mr-1.5" /> {vi.orders.detail.payment}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  isLoading={restoreItems.isPending}
                  onClick={handleRestoreFromTrash}
                  className="bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-[13px] font-bold text-white"
                >
                  <RefreshCw className="size-4 mr-1.5" /> Khôi phục
                </Button>
                <Button
                  variant="danger"
                  isLoading={purgeItems.isPending}
                  onClick={handlePurgeFromTrash}
                  className="text-[13px] font-bold"
                >
                  <Trash2 className="size-4 mr-1.5" /> Xóa vĩnh viễn
                </Button>
              </>
            )}
          </div>
        </div>

        {isTrashView ? (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-[12px] font-medium text-amber-700">
            Đơn hàng đã xóa (Thùng rác).
          </div>
        ) : null}

        <div className="grid grid-cols-12 gap-6">
          {/* ── Left Column ── */}
          <div className="col-span-12 xl:col-span-4 space-y-5">
            
            {/* Customer Box */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm relative overflow-hidden group hover:border-[var(--accent)]/30 transition-[background-color,border-color,box-shadow,color,opacity,transform,width]">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
              <h3 className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <User className="size-3.5" /> {vi.orders.detail.customer}
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="size-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-lg font-black shrink-0">
                  {customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <Link href={`/customers/${order.customer?.id || order.customer_id}`} className="text-[16px] font-bold text-[var(--fg-base)] hover:text-[var(--accent)] transition-colors truncate block max-w-[200px]">
                    {customerName}
                  </Link>
                  <span className="text-[12px] text-[var(--fg-muted)] inline-flex px-2 py-0.5 bg-[var(--border-soft)] rounded-md mt-1">
                    {order.customer?.type === "wholesale" || order.customer?.type === "agency" ? "⭐ " + (order.customer.type === "wholesale" ? vi.orders.detail.customerTypes.wholesale : vi.orders.detail.customerTypes.agency) : vi.orders.detail.customerTypes.retail}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2 mt-4 pt-4 border-t border-[var(--border-soft)]">
                 {contacts.length === 0 && <p className="text-[12px] text-[var(--fg-muted)] italic">{vi.orders.detail.noContacts}</p>}
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between group/copy">
                    <div className="flex items-center gap-2">
                       {c.channel === "phone" || c.channel === "zalo" ? <Phone className="size-3.5 text-[var(--fg-muted)]" /> :
                        c.channel === "email" ? <Mail className="size-3.5 text-blue-500" /> : <User className="size-3.5 text-[var(--accent)]" />}
                       <span className="text-[13px] font-medium text-[var(--fg-base)]">{c.value}</span>
                    </div>
                     <button onClick={() => { navigator.clipboard.writeText(c.value); appToast.success(vi.orders.detail.copied); }} className="text-[var(--fg-muted)] hover:text-[var(--accent)] opacity-0 group-hover/copy:opacity-100 transition-opacity">
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales Channel / Payment Source */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm">
               <h3 className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                 <Store className="size-3.5" /> Kênh bán & nguồn tiền
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-[var(--fg-muted)] font-medium">Kênh bán</span>
                  <span className="max-w-[60%] truncate rounded-lg bg-[var(--surface-light)] px-3 py-1.5 font-bold text-[var(--fg-base)] border border-[var(--border-soft)]">
                    {salesChannelName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-[var(--fg-muted)] font-medium">Nguồn tiền</span>
                  <span className="max-w-[60%] truncate rounded-lg bg-[var(--surface-light)] px-3 py-1.5 font-bold text-[var(--fg-base)] border border-[var(--border-soft)]">
                    {paymentSourceName}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Summary Box */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm">
               <h3 className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                 <Wallet className="size-3.5" /> {vi.orders.detail.finance}
              </h3>
              
              <div className="mb-5 pb-5 border-b border-[var(--border-soft)]">
                 <p className="text-[12px] font-medium text-[var(--fg-muted)] mb-1">{vi.orders.detail.totalPaid}</p>
                <p className="text-3xl font-black text-[var(--fg-base)] tracking-tight">{formatMoney(totalAmount)}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--fg-muted)] font-medium">{vi.orders.detail.totalPaid}</span>
                  <span className="font-bold text-emerald-500">{formatMoney(totalPaid)}</span>
                </div>
                
                <div className="w-full bg-[var(--border-soft)] h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[background-color,border-color,box-shadow,color,opacity,transform,width] duration-500 bg-gradient-to-r ${
                      paidPercent >= 100 ? "from-emerald-400 to-emerald-500" :
                      paidPercent > 0 ? "from-amber-400 to-amber-500" : "from-[var(--border-soft)] to-[var(--border-soft)]"
                    }`}
                    style={{ width: `${Math.max(paidPercent, 2)}%` }}
                  />
                </div>
                
                {isDebt && (
                  <div className="flex items-center justify-between mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Banknote className="size-4 text-red-500" />
                       <span className="text-[12px] font-bold text-red-600">{vi.orders.detail.remainingDebt}</span>
                    </div>
                    <span className="font-black text-[14px] text-red-600">{formatMoney(remaining)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions / Status change */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] rounded-2xl shadow-sm overflow-hidden">
               <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--surface-light)]/50">
                 <h3 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-1.5">
                   <RefreshCw className="size-3.5" /> {vi.orders.detail.changeStatus}
                </h3>
               </div>
                {isTrashView ? (
                  <div className="p-4 space-y-3">
                    <div className="rounded-xl border border-amber-100 bg-amber-50/30 px-3 py-2 text-[11px] font-medium text-amber-600">
                      Đơn hàng trong Thùng rác.
                    </div>
                   <div className="grid grid-cols-2 gap-2">
                     <Button
                       variant="primary"
                       isLoading={restoreItems.isPending}
                       onClick={handleRestoreFromTrash}
                       className="text-[13px] font-bold"
                     >
                       <RefreshCw className="size-4 mr-1.5" /> Khôi phục
                     </Button>
                     <Button
                       variant="danger"
                       isLoading={purgeItems.isPending}
                       onClick={handlePurgeFromTrash}
                       className="text-[13px] font-bold"
                     >
                       <Trash2 className="size-4 mr-1.5" /> Xóa vĩnh viễn
                     </Button>
                   </div>
                 </div>
               ) : (
                 <div className="p-4 grid grid-cols-2 gap-2">
                   {/* Current status (highlighted) */}
                   <div className={`px-3 py-2.5 rounded-xl text-[11px] font-bold border shadow-sm border-transparent col-span-2 text-center ${getStatusStyle(order.status)}`}>
                      {vi.orders.detail.currentStatus} {getStatusLabel(order.status)}
                   </div>
                   {/* Only valid next statuses from state machine */}
                   {getOrderNextStatuses(order.status as OrderStatus).map(s => (
                    <button
                      key={s}
                      onClick={() => handleUpdateStatus(s)}
                      className="px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-[background-color,border-color,box-shadow,color,opacity,transform,width] cursor-pointer border-[var(--border-soft)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] bg-[var(--surface-light)]"
                    >
                      → {getStatusLabel(s)}
                    </button>
                  ))}
                  {getOrderNextStatuses(order.status as OrderStatus).length === 0 && (
                     <p className="col-span-2 text-[12px] text-[var(--fg-muted)] italic text-center py-2">{vi.orders.detail.finalStatus}</p>
                  )}
                 </div>
               )}
            </div>

          </div>

          {/* ── Right Column ── */}
          <div className="col-span-12 xl:col-span-8 space-y-6">
            
            {/* Product Row */}
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-soft)] overflow-hidden">
               <div className="p-5 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface-light)]/50">
                <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
                  <Package className="text-[var(--accent)] size-5" />
                   {vi.orders.detail.productSelected}
                </h3>
              </div>
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xl font-bold text-[var(--fg-base)] mb-1">{productName}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-[13px] text-[var(--fg-muted)]">
                       <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {vi.orders.detail.createdAt} {formatDateLabel(order.created_at)}</span>
                       {order.expires_at && <span className="flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-[var(--warning)]" /> {vi.orders.detail.expiryLabel} {formatDateLabel(order.expires_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 px-4 py-3 bg-[var(--surface-light)] rounded-xl border border-[var(--border-soft)]">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">{vi.orders.detail.quantity}</p>
                      <p className="text-[16px] font-black text-[var(--fg-base)]">{order.quantity}</p>
                    </div>
                    <div className="w-px h-8 bg-[var(--border-soft)]" />
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">{vi.orders.detail.unitPrice}</p>
                      <p className="text-[16px] font-black text-[var(--fg-base)]">{formatMoney(order.unit_price_vnd || 0)}</p>
                    </div>
                    {order.cost_price_vnd != null && order.cost_price_vnd > 0 && (
                      <>
                        <div className="w-px h-8 bg-[var(--border-soft)]" />
                        <div className="text-center">
                           <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1">{vi.orders.detail.costPrice}</p>
                          <p className="text-[16px] font-black text-orange-500">{formatMoney(order.cost_price_vnd)}</p>
                        </div>
                        <div className="w-px h-8 bg-[var(--border-soft)]" />
                        <div className="text-center">
                           <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp className="size-3" />{vi.orders.detail.profit}</p>
                          <p className={`text-[16px] font-black ${profit >= 0 ? "text-emerald-500" : "text-red-500"}`}>{formatMoney(profit)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Inventory Allocation Section ── */}
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-soft)] overflow-hidden">
               <div className="p-5 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface-light)]/50">
                <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
                   <Key className="text-[var(--accent)] size-5" />
                   {vi.orders.detail.allocationTitle}
                </h3>
              </div>
              <div className="p-6">
                {order.items.length === 0 ? (
                   <p className="text-[13px] text-[var(--fg-muted)] italic text-center py-4">{vi.orders.detail.noAllocation}</p>
                ) : (
                  <div className="space-y-6">
                    {order.items.map((item, idx) => {
                      const hasSlot = !!item.assigned_source_account;
                      const allocatedKeys = item.license_keys || [];
                      const hasKeys = allocatedKeys.length > 0;
                      const isAllocated = hasSlot || hasKeys;
                      
                      return (
                        <div key={item.id} className="border border-[var(--border-soft)] rounded-xl p-5 bg-[var(--surface-light)]">
                          <h4 className="text-[14px] font-bold text-[var(--fg-base)] mb-4 pb-2 border-b border-[var(--border-soft)] flex items-center gap-2">
                            <span className="bg-[var(--accent)]/10 text-[var(--accent)] size-6 rounded flex items-center justify-center text-[12px]">{idx + 1}</span>
                            Sản phẩm {item.product_id === order.product_id ? productName : "Khác"} - SL: {item.quantity}
                          </h4>
                          
                          {!isAllocated ? (
                            <div className="flex flex-col items-center justify-center text-center py-4">
                              <p className="text-[13px] text-[var(--fg-muted)] mb-3">
                                 {vi.orders.detail.noAllocation}<br/>
                                 {vi.orders.detail.manageNote}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {hasSlot && item.assigned_source_account && (
                                <div className="space-y-3">
                                   <h5 className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{vi.orders.detail.slotTitle}</h5>
                                  <div className="bg-white border border-[var(--border-soft)] rounded-lg p-3">
                                    <div className="flex items-center gap-3">
                                      <div className="size-8 bg-purple-500/10 rounded flex items-center justify-center shrink-0">
                                        <User className="size-4 text-purple-500" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="text-[13px] font-medium text-[var(--fg-base)]">{item.assigned_source_account.email}</div>
                                        <div className="text-[11px] text-[var(--fg-muted)] capitalize">{item.assigned_source_account.provider}</div>
                                      </div>
                                      <AccountShareLauncher
                                        account={{
                                          id: item.assigned_source_account.id,
                                          email: item.assigned_source_account.email,
                                        }}
                                        orderId={order.id}
                                        orderItemId={item.id}
                                        customerId={order.customer_id}
                                        className="h-8 rounded-lg px-3 text-[12px] font-bold"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {hasKeys && (
                                <div className="space-y-3 mt-4">
                                  <h5 className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex justify-between">
                                     <span>{vi.orders.detail.licenseKeys} {vi.orders.detail.itemCount(allocatedKeys.length, item.quantity)}</span>
                                  </h5>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {allocatedKeys.map((k: LicenseKey) => (
                                      <div key={k.id} className="bg-white border border-[var(--border-soft)] rounded-lg p-2.5 flex justify-between items-center group/key">
                                        <div className="flex items-center gap-2 text-[12px]">
                                          <Key className="size-3.5 text-blue-500" />
                                          <span className="font-mono">{k.key_code}</span>
                                        </div>
                                           <button onClick={() => { navigator.clipboard.writeText(k.key_code); appToast.success(vi.orders.detail.copyKey); }} className="text-[var(--fg-muted)] hover:text-blue-500 opacity-0 group-hover/key:opacity-100 transition-opacity">
                                          <Copy className="size-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Allocation Actions */}
                <div className="mt-6 pt-5 border-t border-[var(--border-soft)] flex items-center justify-between">
                  <p className="text-[12px] text-[var(--fg-muted)]">
                    {vi.orders.detail.manageNote}
                  </p>
                   <div className="flex gap-2">
                     <AllocateOrderButton orderId={order.id} onSuccess={refetchOrder} />
                     <Link href="/inventory" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface-light)] text-[var(--fg-base)] border border-[var(--border-soft)] hover:bg-[var(--border-soft)] text-[13px] font-bold rounded-xl shadow-sm transition-colors cursor-pointer">
                        <Store className="size-4" /> {vi.orders.detail.goWarehouse}
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes & Proof Images */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-soft)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--surface-light)]/50">
                  <h3 className="text-[13px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-2">
                     <FileText className="size-4 text-[var(--accent)]" /> 
                     {vi.orders.detail.noteTitle}
                  </h3>
                </div>
                <div className="p-5">
                  <p className="text-[13px] text-[var(--fg-base)] whitespace-pre-wrap leading-relaxed">
                     {order.sales_note || <span className="text-[var(--fg-muted)] italic">{vi.orders.detail.noNote}</span>}
                  </p>
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-soft)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--surface-light)]/50 flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-2">
                     <History className="size-4 text-[var(--accent)]" /> 
                     {vi.orders.detail.proofTitle}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors"
                  >
                     <ImagePlus className="size-3.5" /> {vi.orders.detail.addMore}
                  </button>
                </div>
                <div className="p-5">
                  {(!order.proof_image_urls || order.proof_image_urls.length === 0) ? (
                     <p className="text-[13px] text-[var(--fg-muted)] italic">{vi.orders.detail.noProof}</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {order.proof_image_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg border border-[var(--border-soft)] overflow-hidden hover:border-[var(--accent)] transition-colors block relative group cursor-pointer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Proof ${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                             <span className="text-white text-[10px] font-bold uppercase tracking-wider">{vi.orders.detail.view}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Refund Detail Panel */}
            <RefundDetailPanel
              orderId={order.id}
              orderStatus={order.status}
              orderTotalPaid={order.total_paid}
              productName={productName}
              customerName={customerName}
            />

            {/* Activity Timeline */}
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-soft)] overflow-hidden">
               <div className="p-5 border-b border-[var(--border-soft)] bg-[var(--surface-light)]/50">
                <h3 className="text-[15px] font-bold text-[var(--fg-base)] flex items-center gap-2">
                   <Clock className="text-[var(--accent)] size-5" />
                   {vi.orders.detail.activityTitle}
                </h3>
              </div>
              <div className="p-5 max-h-[400px] overflow-y-auto custom-scrollbar">
                <ActivityTimeline orderId={order.id} />
              </div>
            </div>

          </div>
        </div>
      </PageContainer>

      {order && isPaymentModalOpen && (
        <PaymentModal
          key={`${order.id}-${isPaymentModalOpen ? "open" : "closed"}`}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          orderId={order.id}
          totalAmountVnd={order.total_amount_vnd}
          totalPaid={order.total_paid || 0}
          currentPaymentTerms={order.payment_terms ?? order.payment_method}
          currentSourceId={order.payment_source_id}
          onSuccess={refetchOrder}
        />
      )}
      {order && isEditModalOpen && (
        <EditOrderModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          order={order}
          onSuccess={refetchOrder}
        />
      )}
      {order && isRenewModalOpen && (
        <RenewOrderModal
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          orderId={order.id}
          currentExpiresAt={order.expires_at}
          onSuccess={refetchOrder}
        />
      )}

    </AppLayout>
  );
}
