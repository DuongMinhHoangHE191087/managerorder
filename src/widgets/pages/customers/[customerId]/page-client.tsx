"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Edit, Plus, Mail, Phone, ShoppingCart,
  History, User, Key, Star, StickyNote,
  Clock, AlertCircle
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { formatDateLabel, formatMoney } from "@/lib/utils";
import { RfmBadge } from "@/widgets/pages/customers/components/rfm-badge";
import {
  useCustomerDetail,
  useCustomerOrders,
} from "@/widgets/pages/customers/hooks/use-customer-detail";
import type { CustomerOrder } from "@/shared/types/customers";

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
  { id: "orders", label: "Đơn hàng & TT", icon: <ShoppingCart className="size-4" /> },
  { id: "nicks", label: "Tài khoản", icon: <Key className="size-4" /> },
  { id: "activity", label: "Lịch sử", icon: <History className="size-4" /> },
];

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;

  // React Query hooks (replaces raw fetch)
  const {
    data: customer,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
    error: customerError,
  } = useCustomerDetail(customerId);

  const {
    data: orders = [],
    isLoading: isOrdersLoading,
  } = useCustomerOrders(customerId);

  // UI State
  const [activeTab, setActiveTab] = useState<DetailTab>("orders");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [payingOrder, setPayingOrder] = useState<CustomerOrder | null>(null);

  /* ─── Computed Stats ──────────────────────────────────── */
  const stats = useMemo(() => {
    const lifetimeValue = orders.reduce((s, o) => s + o.total_amount, 0);
    const totalPaid = orders.reduce((s, o) => s + o.total_paid, 0);
    const completedOrders = orders.filter(o => o.status === "completed" || o.status === "active" || o.status === "paid").length;
    return { lifetimeValue, totalPaid, completedOrders };
  }, [orders]);

  // Debt comes from customer record (source of truth), NOT computed from orders
  const customerDebt = customer?.debtAmountVnd ?? 0;

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
            {isCustomerError ? "Lỗi tải dữ liệu" : "Không tìm thấy khách hàng"}
          </h2>
          <p className="text-[var(--fg-muted)] text-sm mb-4">
            {customerError instanceof Error ? customerError.message : "Khách hàng không tồn tại hoặc đã bị xóa."}
          </p>
          <Link href="/customers" className="text-[var(--accent)] font-bold text-sm hover:underline">← Quay lại danh sách</Link>
        </div>
      </AppLayout>
    );
  }

  const contacts = customer.contacts ?? [];

  return (
    <AppLayout>
      <PageContainer className="relative pb-16">
        <div className="app-card flex flex-col gap-4 border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:flex-row md:items-end md:justify-between mt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--accent)]">
              <Link className="hover:underline" href="/customers">Khách hàng</Link>
              <ChevronRight className="size-3" />
              <span className="truncate text-[var(--fg-muted)]">{customer.name}</span>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--fg-base)]">Hồ sơ khách hàng</h1>
            <p className="mt-1 text-[14px] font-medium text-[var(--fg-muted)]">
              Quản lý liên hệ, công nợ, RFM và toàn bộ đơn hàng.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-colors hover:border-[var(--accent)]/30 hover:bg-white"
            >
              <Edit className="size-4" />
              Cập nhật hồ sơ
            </button>
            <Link
              href={`/orders/new?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}`}
              className="flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)] active:scale-[0.98]"
            >
              <Plus className="size-4" />
              Tạo đơn mới
            </Link>
          </div>
        </div>

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
                    {customer.customerType === "agency" ? "🏢 Đại lý" : customer.customerType === "wholesale" ? "⭐ Bán sỉ" : "Khách lẻ"}
                  </span>
                  {customer.segment && (
                    <RfmBadge segment={customer.segment} rfmScore={customer.rfmScore} showScore size="md" />
                  )}
                </div>
              </div>
              <div className="space-y-3 border-t border-[var(--border-soft)] px-5 py-5">
                {contacts.length === 0 && <p className="text-[13px] text-[var(--fg-muted)] italic">Chưa có thông tin liên hệ</p>}
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
                      <span className="text-[10px] text-[var(--fg-muted)] font-bold uppercase tracking-wider block">{c.type}{c.isPrimary ? " (Chính)" : ""}</span>
                      <span className="text-[13px] font-bold text-[var(--fg-base)] truncate block">{c.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">Tổng đơn</p>
                <p className="text-2xl font-black text-[var(--fg-base)]">{isOrdersLoading ? "—" : orders.length}</p>
                <p className="text-[10px] text-emerald-500 font-bold mt-0.5">{stats.completedOrders} hoàn thành</p>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">Chi tiêu</p>
                <p className="text-xl font-black text-[var(--accent)]">{formatMoney(stats.lifetimeValue)}</p>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">Đã TT</p>
                <p className="text-xl font-black text-emerald-500">{formatMoney(stats.totalPaid)}</p>
              </div>
              <div className={`border p-4 rounded-xl shadow-sm ${customerDebt > 0 ? "bg-red-50 border-red-200" : "bg-[var(--bg-surface)] border-[var(--border-soft)]"}`}>
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-1">Công nợ</p>
                <p className={`text-xl font-black ${customerDebt > 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {customerDebt > 0 ? formatMoney(customerDebt) : "0đ ✅"}
                </p>
              </div>
            </div>

            {/* Reliability Score */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest flex items-center gap-1.5">
                  <Star className="size-3" /> Tín nhiệm
                </p>
                <span className="text-[13px] font-black text-[var(--accent)]">{customer.reliabilityScore}/100</span>
              </div>
              <div className="w-full bg-[var(--border-soft)] h-2 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${customer.reliabilityScore}%` }} />
              </div>
            </div>

            {/* RFM Insights Card */}
            {customer.segment && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  📊 RFM Insights
                </p>
                <div className="space-y-2">
                  {([
                    { label: "Recency (R)", value: customer.rfmRecency ?? 0, color: "bg-blue-500" },
                    { label: "Frequency (F)", value: customer.rfmFrequency ?? 0, color: "bg-emerald-500" },
                    { label: "Monetary (M)", value: customer.rfmMonetary ?? 0, color: "bg-amber-500" },
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
                    <span className="text-[var(--fg-muted)] font-bold">Tổng điểm</span>
                    <span className="text-[var(--accent)] font-black text-[14px]">{customer.rfmScore ?? 0}/100</span>
                  </div>
                  {customer.lastRfmCalculatedAt && (
                    <p className="text-[10px] text-[var(--fg-muted)] pt-1">
                      Cập nhật: {formatDateLabel(customer.lastRfmCalculatedAt)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {customer.notes && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-soft)] p-4 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-[var(--fg-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <StickyNote className="size-3" /> Ghi chú
                </p>
                <p className="text-[13px] text-[var(--fg-base)] whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>

          {/* ── Right Column ─────────────────────────────── */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Tab Navigation */}
            <div className="app-card flex items-center gap-1 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-1 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-[0.95rem] px-4 py-2.5 text-[12px] font-bold transition-all cursor-pointer ${
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
              <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-4">
                  <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--fg-base)]">
                    <Clock className="text-[var(--accent)] size-5" />
                    Lịch sử hoạt động
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
          onSuccess={() => appToast.success("Cập nhật thành công!")}
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
