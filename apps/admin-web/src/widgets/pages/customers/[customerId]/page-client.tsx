"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Edit, Plus, Mail, Phone, ShoppingCart,
  History, User, Key, Star, StickyNote,
  Clock, AlertCircle, Tag, RefreshCw, Trash2
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { SoftDeletedBadge } from "@/shared/ui/soft-deleted-badge";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import { RfmBadge } from "@/widgets/pages/customers/components/rfm-badge";
import { vi } from "@/shared/messages/vi";
import {
  useCustomerDetail,
  useCustomerOrders,
} from "@/widgets/pages/customers/hooks/use-customer-detail";
import { useCustomer360Stats } from "@/widgets/pages/customers/hooks/use-customers";
import { useCustomerGroups } from "@/widgets/pages/customers/hooks/use-customer-groups";
import { usePurgeItems, useRestoreItems } from "@/widgets/pages/trash/hooks/use-trash";
import type { CustomerOrder } from "@/shared/types/customers";
import { buildCustomerProfileInsights, type CustomerProfileActionTone } from "./lib/profile-insights";

function DetailPanelSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm overflow-hidden border border-[var(--border-soft)] p-5 space-y-4">
      <div className="h-6 w-48 rounded bg-gray-200 animate-pulse" />
      <div className="space-y-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-24 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

const CustomerEditModal = dynamic(() => import("@/widgets/pages/customers/components/customer-edit-modal").then(m => ({ default: m.CustomerEditModal })), { ssr: false });
const ActivityTimeline = dynamic(() => import("@/widgets/pages/activity-logs/components/activity-timeline").then(m => ({ default: m.ActivityTimeline })), { ssr: false });
const CustomerOrdersPanel = dynamic(() => import("@/widgets/pages/customers/components/customer-orders-panel").then(m => ({ default: m.CustomerOrdersPanel })), {
  ssr: false,
  loading: () => <DetailPanelSkeleton />,
});
const CustomerNicksPanel = dynamic(() => import("@/widgets/pages/customers/components/customer-nicks-panel").then(m => ({ default: m.CustomerNicksPanel })), {
  ssr: false,
  loading: () => <DetailPanelSkeleton />,
});
const CustomerOrderPaymentModal = dynamic(() => import("@/widgets/pages/customers/components/customer-order-payment-modal").then(m => ({ default: m.CustomerOrderPaymentModal })), {
  ssr: false,
});

/* ─── Tab Types ──────────────────────────────────────────── */
type DetailTab = "orders" | "nicks" | "activity";

const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: "orders", label: vi.customers.detail.tabs.orders, icon: <ShoppingCart className="size-4" /> },
  { id: "nicks", label: vi.customers.detail.tabs.nicks, icon: <Key className="size-4" /> },
  { id: "activity", label: vi.customers.detail.tabs.activity, icon: <History className="size-4" /> },
];

const ACTION_TONE_STYLES: Record<
  CustomerProfileActionTone,
  { container: string; badge: string; cta: string }
> = {
  critical: {
    container: "border-red-200 bg-red-50/80",
    badge: "bg-red-100 text-red-600",
    cta: "text-red-600",
  },
  warning: {
    container: "border-amber-200 bg-amber-50/80",
    badge: "bg-amber-100 text-amber-700",
    cta: "text-amber-700",
  },
  positive: {
    container: "border-emerald-200 bg-emerald-50/80",
    badge: "bg-emerald-100 text-emerald-700",
    cta: "text-emerald-700",
  },
  neutral: {
    container: "border-[var(--border-soft)] bg-[var(--surface-light)]",
    badge: "bg-[var(--border-soft)] text-[var(--fg-muted)]",
    cta: "text-[var(--accent)]",
  },
};

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const trashMode = searchParams.get("trash") === "1";

  // React Query hooks (replaces raw fetch)
  const {
    data: customerResult,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
    error: customerError,
  } = useCustomerDetail(customerId, true, trashMode);
  const customer = customerResult?.data ?? null;
  const isTrashView = trashMode || Boolean(customerResult?.softDeleted);

  const {
    data: orders = [],
    isLoading: isOrdersLoading,
  } = useCustomerOrders(customerId);
  const { data: customer360Stats } = useCustomer360Stats(customerId);
  const { data: groups = [] } = useCustomerGroups();

  // UI State
  const [activeTab, setActiveTab] = useState<DetailTab>("orders");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [payingOrder, setPayingOrder] = useState<CustomerOrder | null>(null);
  const restoreItems = useRestoreItems();
  const purgeItems = usePurgeItems();

  /* ─── Computed Stats ──────────────────────────────────── */
  const stats = useMemo(() => {
    const lifetimeValue = orders.reduce((s, o) => s + o.total_amount, 0);
    const totalPaid = orders.reduce((s, o) => s + o.total_paid, 0);
    const completedOrders = orders.filter(o => o.status === "completed" || o.status === "active" || o.status === "paid").length;
    return { lifetimeValue, totalPaid, completedOrders };
  }, [orders]);
  const profileInsights = useMemo(() => buildCustomerProfileInsights({
    customerId,
    customerName: customer?.name ?? "",
    stats: customer360Stats,
    orders,
  }), [customer?.name, customer360Stats, customerId, orders]);

  // Debt comes from customer record (source of truth), NOT computed from orders
  const customerDebt = customer?.debtAmountVnd ?? 0;

  async function handleRestoreFromTrash() {
    if (!customer) {
      return;
    }

    await restoreItems.mutateAsync({ type: "customers", ids: [customer.id] });
    router.replace(`/customers/${customer.id}`);
  }

  async function handlePurgeFromTrash() {
    if (!customer) {
      return;
    }

    await purgeItems.mutateAsync({ type: "customers", ids: [customer.id] });
    router.push("/trash?type=customers");
  }

  /* ─── Loading State ───────────────────────────────────── */
  if (isCustomerLoading) {
    return (
        <AppLayout>
          <PageContainer className="mt-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-12 bg-gray-200 rounded w-1/2" />
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-4 space-y-4">
                <div className="h-64 bg-gray-200 rounded-2xl" />
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
                </div>
              </div>
              <div className="col-span-8 space-y-4">
                <div className="h-96 bg-gray-200 rounded-2xl" />
              </div>
            </div>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  /* ─── Error State ─────────────────────────────────────── */
  if (isCustomerError || !customer) {
    return (
      <AppLayout>
        <div className="text-center py-20 max-w-md mx-auto">
          <AlertCircle className="size-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[var(--fg-base)] mb-2">
            {isCustomerError ? vi.customers.detail.errorTitle : vi.customers.detail.notFoundTitle}
          </h2>
          <p className="text-[var(--fg-muted)] text-sm mb-4">
            {customerError instanceof Error ? customerError.message : vi.customers.detail.errorDescription}
          </p>
          <Link href="/customers" className="text-[var(--accent)] font-bold text-sm hover:underline">{vi.customers.detail.backToList}</Link>
        </div>
      </AppLayout>
    );
  }

  const contacts = customer.contacts ?? [];
  const customerTags = customer.tags ?? [];
  const customerGroup = customer.group_id ? groups.find((group) => group.id === customer.group_id) ?? null : null;

  return (
    <AppLayout>
      <PageContainer className="relative pb-16">
        <div className="app-card flex flex-col gap-4 border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:flex-row md:items-end md:justify-between mt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--accent)]">
              <Link className="hover:underline" href="/customers">{vi.customers.detail.breadcrumbRoot}</Link>
              <ChevronRight className="size-3" />
              <span className="truncate text-[var(--fg-muted)]">{customer.name}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-[var(--fg-base)]">{vi.customers.detail.title}</h1>
              {isTrashView ? <SoftDeletedBadge /> : null}
            </div>
            <p className="mt-1 text-[14px] font-medium text-[var(--fg-muted)]">
              {vi.customers.detail.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isTrashView ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleRestoreFromTrash()}
                  className="flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-[box-shadow,transform] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)] active:scale-[0.98]"
                >
                  <RefreshCw className="size-4" />
                  Khôi phục
                </button>
                <button
                  type="button"
                  onClick={() => void handlePurgeFromTrash()}
                  className="flex items-center gap-2 rounded-[1rem] border border-[var(--danger)]/30 bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--danger)] shadow-sm transition-colors hover:bg-[var(--danger)]/10"
                >
                  <Trash2 className="size-4" />
                  Xóa vĩnh viễn
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-colors hover:border-[var(--accent)]/30 hover:bg-white"
                >
                  <Edit className="size-4" />
                  {vi.customers.detail.edit}
                </button>
                <Link
                  href={`/orders/new?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}`}
                  className="flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-[box-shadow,transform] hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)] active:scale-[0.98]"
                >
                  <Plus className="size-4" />
                  {vi.customers.detail.createOrder}
                </Link>
              </>
            )}
          </div>
        </div>

        {isTrashView ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] font-medium text-amber-700">
            Khách hàng này đang ở thùng rác. Bạn có thể khôi phục hoặc xóa vĩnh viễn ngay trên màn chi tiết này.
          </div>
        ) : null}

        <div className="grid grid-cols-12 gap-6">
          {/* ── Left Column ──────────────────────────────── */}
          <div className="col-span-12 lg:col-span-4 space-y-5">
            {/* Profile Card */}
            <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col items-center text-center px-6 py-6">
                <div className="mb-3 flex size-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-[28px] font-black text-white shadow-lg">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--fg-base)]">{customer.name}</h2>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  customer.customerType === "agency" ? "bg-emerald-100 text-emerald-600" :
                  customer.customerType === "wholesale" ? "bg-amber-100 text-amber-600" :
                  "bg-[var(--border-soft)] text-[var(--fg-muted)]"
                  }`}>
                    {customer.customerType === "agency" ? `🏢 ${vi.customers.detail.typeLabels.agency}` : customer.customerType === "wholesale" ? `⭐ ${vi.customers.detail.typeLabels.wholesale}` : vi.customers.detail.typeLabels.retail}
                  </span>
                  {customer.segment && (
                    <RfmBadge segment={customer.segment} rfmScore={customer.rfmScore} showScore size="md" />
                  )}
                </div>
              </div>
              <div className="space-y-3 border-t border-[var(--border-soft)] px-5 py-5">
                {contacts.length === 0 && <p className="text-[13px] text-[var(--fg-muted)] italic">{vi.customers.detail.noContacts}</p>}
                {contacts.map((c, i) => (
                  <div key={c.id || i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-light)] transition-colors">
                    {c.type === "phone" || c.type === "zalo" || c.type === "telegram" ? (
                      <div className="size-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><Phone className="size-4" /></div>
                    ) : c.type === "email" ? (
                      <div className="size-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Mail className="size-4" /></div>
                    ) : (
                      <div className="size-8 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0"><User className="size-4" /></div>
                    )}
                    <div className="min-w-0">
                      <span className="text-[10px] text-[var(--fg-muted)] font-bold uppercase tracking-wider block">{c.type}{c.isPrimary ? vi.customers.detail.primarySuffix : ""}</span>
                      <span className="text-[13px] font-bold text-[var(--fg-base)] truncate block">{c.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Group & Tags Card */}
            <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-5 py-4">
                <Tag className="size-4 text-[var(--accent)]" />
                <h3 className="text-[14px] font-bold text-[var(--fg-base)]">Nhóm & thẻ</h3>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Nhóm khách</p>
                  {customerGroup ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold"
                        style={{
                          backgroundColor: `${customerGroup.color}12`,
                          color: customerGroup.color,
                          borderColor: `${customerGroup.color}30`,
                        }}
                      >
                        {customerGroup.name}
                      </span>
                      {customerGroup.description ? (
                        <span className="text-[12px] text-[var(--fg-muted)]">{customerGroup.description}</span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] text-[var(--fg-muted)]">Chưa gán nhóm</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Thẻ</p>
                  {customerTags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customerTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold"
                          style={{
                            backgroundColor: `${tag.color}12`,
                            color: tag.color,
                            borderColor: `${tag.color}30`,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] text-[var(--fg-muted)]">Chưa có thẻ</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Ghi chú</p>
                  {customer.notes ? (
                    <p className="mt-2 whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] px-3 py-2 text-[13px] leading-6 text-[var(--fg-base)]">
                      {customer.notes}
                    </p>
                  ) : (
                    <p className="mt-2 text-[13px] text-[var(--fg-muted)]">Chưa có ghi chú</p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">{vi.customers.detail.cards.totalOrders}</p>
                <p className="text-2xl font-black text-[var(--fg-base)]">{isOrdersLoading ? "—" : orders.length}</p>
                <p className="text-[10px] text-emerald-500 font-bold mt-0.5">{stats.completedOrders} {vi.customers.detail.cards.completedSuffix}</p>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">{vi.customers.detail.cards.spending}</p>
                <p className="text-xl font-black text-[var(--accent)]">{formatMoney(stats.lifetimeValue)}</p>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">{vi.customers.detail.cards.paid}</p>
                <p className="text-xl font-black text-emerald-500">{formatMoney(stats.totalPaid)}</p>
              </div>
              <div className={`border p-4 rounded-xl shadow-sm ${customerDebt > 0 ? "bg-red-50 border-red-200" : "bg-[var(--bg-surface)] border-[var(--border-soft)]"}`}>
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">{vi.customers.detail.cards.debt}</p>
                <p className={`text-xl font-black ${customerDebt > 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {customerDebt > 0 ? formatMoney(customerDebt) : vi.customers.detail.cards.noDebt}
                </p>
              </div>
              <div className="col-span-2 bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2">360° hồ sơ khách hàng</p>
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="rounded-lg bg-[var(--surface-light)] px-3 py-2">
                    <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Giá trị TB/đơn</p>
                    <p className="mt-1 font-black text-[var(--fg-base)]">
                      {formatMoney(customer360Stats?.avgOrderValueVnd ?? (orders.length > 0 ? stats.lifetimeValue / orders.length : 0))}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-light)] px-3 py-2">
                    <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Tổng thanh toán</p>
                    <p className="mt-1 font-black text-[var(--fg-base)]">
                      {formatMoney(customer360Stats?.totalPaymentsVnd ?? stats.totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-light)] px-3 py-2">
                    <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Mua đầu tiên</p>
                    <p className="mt-1 font-black text-[var(--fg-base)]">
                      {customer360Stats?.firstOrderDate ? formatDateLabel(customer360Stats.firstOrderDate) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--surface-light)] px-3 py-2">
                    <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">Mua gần nhất</p>
                    <p className="mt-1 font-black text-[var(--fg-base)]">
                      {customer360Stats?.lastOrderDate ? formatDateLabel(customer360Stats.lastOrderDate) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reliability Score */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest flex items-center gap-1.5">
                    <Star className="size-3" /> {vi.customers.detail.cards.trust}
                  </p>
                  <span className="text-[13px] font-black text-[var(--accent)]">{customer.reliabilityScore}/100</span>
                </div>
              <div className="w-full bg-[var(--border-soft)] h-2 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${customer.reliabilityScore}%` }} />
              </div>
            </div>

            {/* RFM Insights Card */}
            {customer.segment && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  📊 {vi.customers.detail.cards.rfm}
                </p>
                <div className="space-y-2">
                  {([
                    { label: vi.customers.detail.rfm.recency, value: customer.rfmRecency ?? 0, color: "bg-blue-500" },
                    { label: vi.customers.detail.rfm.frequency, value: customer.rfmFrequency ?? 0, color: "bg-emerald-500" },
                    { label: vi.customers.detail.rfm.monetary, value: customer.rfmMonetary ?? 0, color: "bg-amber-500" },
                  ] as const).map(item => (
                    <div key={item.label} className="flex justify-between items-center text-[12px]">
                      <span className="text-[var(--fg-muted)] font-medium">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[var(--border-soft)] h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(item.value * 20, 100)}%` }} />
                        </div>
                        <span className="font-bold text-[var(--fg-base)] w-4 text-right">{item.value}</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-[var(--border-soft)] flex justify-between items-center text-[12px]">
                    <span className="text-[var(--fg-muted)] font-bold">{vi.customers.detail.cards.totalScore}</span>
                    <span className="text-[var(--accent)] font-black text-[14px]">{customer.rfmScore ?? 0}/100</span>
                  </div>
                  {customer.lastRfmCalculatedAt && (
                    <p className="text-[10px] text-[var(--fg-muted)] pt-1">
                      {vi.customers.detail.cards.updatedAt} {formatDateLabel(customer.lastRfmCalculatedAt)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {customer.notes && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <StickyNote className="size-3" /> {vi.customers.detail.notes}
                </p>
                <p className="text-[13px] text-[var(--fg-base)] whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>

          {/* ── Right Column ─────────────────────────────── */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <div
              id="health-panel"
              className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]"
            >
              <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">360 profile health</h3>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                      Tong hop toc do thu tien, nhip mua va mix trang thai don de uu tien xu ly.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
                    {profileInsights.statusBreakdown.length > 0 ? `${profileInsights.statusBreakdown.length} tin hieu` : "No signals"}
                  </span>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Collection rate</p>
                    <p className="mt-1 text-2xl font-black text-[var(--fg-base)]">{profileInsights.collectionRate}%</p>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">Ty le da thu tren tong doanh so cua khach nay.</p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Recent 30d</p>
                    <p className="mt-1 text-2xl font-black text-[var(--fg-base)]">{profileInsights.recentOrders30d}</p>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">So don moi phat sinh trong 30 ngay gan nhat.</p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Cadence</p>
                    <p className="mt-1 text-2xl font-black text-[var(--fg-base)]">
                      {profileInsights.averageDaysBetweenOrders === null ? "—" : `${profileInsights.averageDaysBetweenOrders}d`}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">Khoang cach trung binh giua hai lan mua hang.</p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Debt orders</p>
                    <p className="mt-1 text-2xl font-black text-[var(--fg-base)]">{profileInsights.activeDebtOrders}</p>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">So don con balance can theo doi tiep.</p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-[var(--border-soft)] px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-[13px] font-bold text-[var(--fg-base)]">Status mix</h4>
                    <span className="text-[11px] font-medium text-[var(--fg-muted)]">
                      {customer360Stats?.totalOrders ?? orders.length} don da ghi nhan
                    </span>
                  </div>
                  {profileInsights.statusBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {profileInsights.statusBreakdown.map((item) => (
                        <div key={item.status} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-[12px]">
                            <span className="font-bold text-[var(--fg-base)]">{item.label}</span>
                            <span className="text-[var(--fg-muted)]">{item.count} don · {item.share}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[var(--border-soft)]">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))]"
                              style={{ width: `${item.share}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--fg-muted)]">Chua co du lieu don hang de phan tich status mix.</p>
                  )}
                </div>
              </div>

              <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
                  <h3 className="text-[15px] font-bold tracking-tight text-[var(--fg-base)]">Next best actions</h3>
                  <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                    Goi y thao tac uu tien dua tren cong no, pipeline va nhiet do mua hang hien tai.
                  </p>
                </div>
                <div className="space-y-3 p-5">
                  {profileInsights.nextActions.map((action) => {
                    const toneStyle = ACTION_TONE_STYLES[action.tone];

                    return (
                      <Link
                        key={action.id}
                        href={action.href}
                        className={`block rounded-[1rem] border p-4 transition-transform hover:-translate-y-0.5 ${toneStyle.container}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${toneStyle.badge}`}>
                              {action.tone}
                            </span>
                            <h4 className="mt-2 text-[14px] font-bold tracking-tight text-[var(--fg-base)]">{action.title}</h4>
                            <p className="mt-1 text-[12px] leading-6 text-[var(--fg-muted)]">{action.description}</p>
                          </div>
                          <span className={`shrink-0 text-[11px] font-bold ${toneStyle.cta}`}>
                            {action.cta}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="app-card flex items-center gap-1 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-1 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-[0.95rem] px-4 py-2.5 text-[12px] font-bold transition-[background-color,color,box-shadow] cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--fg-muted)] hover:bg-[var(--surface-light)]"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Orders & Payments */}
            {activeTab === "orders" && (
              <CustomerOrdersPanel
                panelId="orders-panel"
                orders={orders}
                isLoading={isOrdersLoading}
                onOpenPayment={setPayingOrder}
              />
            )}

            {/* Tab: Nicks Registry */}
            {activeTab === "nicks" && (
              <CustomerNicksPanel nicksRegistry={customer.nicksRegistry} />
            )}

            {/* Tab: Activity History Timeline */}
            {activeTab === "activity" && (
              <div
                id="activity-panel"
                className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
                  <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--fg-base)]">
                    <Clock className="text-[var(--accent)] size-5" />
                    {vi.customers.detail.activityTitle}
                  </h3>
                </div>
                <div className="max-h-[500px] overflow-y-auto p-5 custom-scrollbar">
                  <ActivityTimeline customerId={customerId} />
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>

      {/* ===== EDIT CUSTOMER MODAL ===== */}
      {customer && isEditOpen && (
        <CustomerEditModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => appToast.success(vi.customers.detail.updated)}
          customer={customer}
        />
      )}

      {payingOrder && (
        <CustomerOrderPaymentModal
          key={payingOrder.id}
          customerId={customerId}
          order={payingOrder}
          onClose={() => setPayingOrder(null)}
        />
      )}
    </AppLayout>
  );
}
