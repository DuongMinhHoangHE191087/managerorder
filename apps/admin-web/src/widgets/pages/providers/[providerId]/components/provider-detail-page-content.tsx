"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Banknote,
  Building2,
  ChevronRight,
  Edit,
  Mail,
  Package,
  Phone,
  Plus,
  Star,
  StickyNote,
  User,
} from "lucide-react";
import { useProviderDetail, useProviderPurchaseOrders } from "@/widgets/pages/providers/hooks/use-provider-detail";
import { appToast } from "@/shared/ui/app-toast";
import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { formatDateCustom, formatDateLabel, formatMoney } from "@/lib/utils";
import type { ProviderPurchaseOrder } from "@/shared/types/providers";
import { vi } from "@/shared/messages/vi";

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

const ProviderEditModal = dynamic(
  () =>
    import("@/widgets/pages/providers/components/provider-edit-modal").then((m) => ({
      default: m.ProviderEditModal,
    })),
  { ssr: false },
);
const CreatePurchaseOrderModal = dynamic(
  () =>
    import("@/widgets/pages/providers/components/create-purchase-order-modal").then((m) => ({
      default: m.CreatePurchaseOrderModal,
    })),
  { ssr: false },
);
const ProviderPurchaseOrderPaymentModal = dynamic(
  () =>
    import("@/widgets/pages/providers/components/provider-purchase-order-payment-modal").then((m) => ({
      default: m.ProviderPurchaseOrderPaymentModal,
    })),
  { ssr: false },
);
const ProviderPurchaseOrdersPanel = dynamic(
  () =>
    import("@/widgets/pages/providers/components/provider-purchase-orders-panel").then((m) => ({
      default: m.ProviderPurchaseOrdersPanel,
    })),
  {
    ssr: false,
    loading: () => <DetailPanelSkeleton />,
  },
);
const ProviderFinancialsPanel = dynamic(
  () =>
    import("@/widgets/pages/providers/components/provider-financials-panel").then((m) => ({
      default: m.ProviderFinancialsPanel,
    })),
  {
    ssr: false,
    loading: () => <DetailPanelSkeleton />,
  },
);

type DetailTab = "purchase-orders" | "financials";

const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: "purchase-orders", label: vi.providers.detail.tabs.purchaseOrders, icon: <Package className="size-4" /> },
  { id: "financials", label: vi.providers.detail.tabs.financials, icon: <Banknote className="size-4" /> },
];

function formatProviderStatus(status?: string) {
  if (status === "active") {
    return vi.providers.detail.status.active;
  }
  if (status === "inactive") {
    return vi.providers.detail.status.inactive;
  }
  return status || vi.providers.detail.status.unknown;
}

export default function ProviderDetailPage() {
  const params = useParams();
  const providerId = params.providerId as string;

  const {
    data: provider,
    isLoading: isProviderLoading,
    isError: isProviderError,
    error: providerError,
  } = useProviderDetail(providerId);
  const {
    data: purchaseOrders = [],
    isLoading: isPOLoading,
  } = useProviderPurchaseOrders(providerId);

  const [activeTab, setActiveTab] = useState<DetailTab>("purchase-orders");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);
  const [payingPO, setPayingPO] = useState<ProviderPurchaseOrder | null>(null);

  const stats = useMemo(() => {
    const totalPurchases = purchaseOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const totalPaid = purchaseOrders.reduce((sum, order) => sum + order.total_paid, 0);
    const totalDebt = Math.max(totalPurchases - totalPaid, 0);
    const completedPOs = purchaseOrders.filter(
      (order) => order.status === "received" || order.status === "completed",
    ).length;

    return {
      totalPurchases,
      totalPaid,
      totalDebt,
      completedPOs,
    };
  }, [purchaseOrders]);

  if (isProviderLoading) {
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
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="h-24 bg-gray-200 rounded-xl" />
                  ))}
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

  if (isProviderError || !provider) {
    return (
      <AppLayout>
        <div className="text-center py-20 max-w-md mx-auto">
          <AlertCircle className="size-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[var(--fg-base)] mb-2">
            {isProviderError ? vi.providers.detail.errorTitle : vi.providers.detail.notFoundTitle}
          </h2>
          <p className="text-[var(--fg-muted)] text-sm mb-4">
            {providerError instanceof Error
              ? providerError.message
              : vi.providers.detail.errorDescription}
          </p>
          <Link
            href="/providers"
            className="text-[var(--accent)] font-bold text-sm hover:underline"
          >
            {vi.providers.detail.backToList}
          </Link>
        </div>
      </AppLayout>
    );
  }

  const contacts = (provider.contacts ?? []).map((contact, index) => ({
    ...contact,
    id: contact.id || `contact-${index}`,
  }));

  return (
    <AppLayout>
      <PageContainer className="relative pb-16">
        <div className="app-card flex flex-col gap-4 border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:flex-row md:items-end md:justify-between mt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--accent)]">
              <Link className="hover:underline" href="/providers">
                {vi.providers.detail.breadcrumbRoot}
              </Link>
              <ChevronRight className="size-3" />
              <span className="truncate text-[var(--fg-muted)]">{provider.name}</span>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--fg-base)]">
              {vi.providers.detail.title}
            </h1>
            <p className="mt-1 text-[14px] font-medium text-[var(--fg-muted)]">
              {vi.providers.detail.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.84)] px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-colors hover:border-[var(--accent)]/30 hover:bg-white"
            >
              <Edit className="size-4" />
              {vi.providers.detail.edit}
            </button>
            <button
              onClick={() => setIsCreatePOOpen(true)}
              className="flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)] active:scale-[0.98]"
            >
              <Plus className="size-4" />
              {vi.providers.detail.createPurchaseOrder}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] px-6 py-5">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 flex size-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-[28px] font-black text-white shadow-lg">
                    {provider.name.charAt(0).toUpperCase()}
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-[var(--fg-base)]">
                    {provider.name}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                      {formatProviderStatus(provider.status)}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      {provider.tier === "vip" ? vi.providers.page.tiers.vip : vi.providers.page.tiers.regular}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-5">
                {contacts.length === 0 ? (
                  <div className="rounded-[1rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-4 py-5 text-center">
                    <p className="text-[13px] italic text-[var(--fg-muted)]">{vi.providers.detail.contacts.empty}</p>
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/60 p-3 transition-colors hover:bg-white"
                    >
                      {contact.type === "phone" || contact.type === "zalo" || contact.type === "telegram" ? (
                        <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                          <Phone className="size-4" />
                        </div>
                      ) : contact.type === "email" ? (
                        <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 shrink-0">
                          <Mail className="size-4" />
                        </div>
                      ) : (
                        <div className="flex size-9 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
                          <User className="size-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                          {contact.type}
                          {contact.isPrimary ? vi.providers.detail.contacts.primarySuffix : ""}
                        </span>
                        <span className="block truncate text-[13px] font-bold text-[var(--fg-base)]">
                          {contact.value}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="app-card border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{vi.providers.detail.cards.purchaseOrders}</p>
                <p className="mt-1 text-2xl font-black text-[var(--fg-base)]">{purchaseOrders.length}</p>
                <p className="mt-0.5 text-[10px] font-bold text-emerald-500">{stats.completedPOs} {vi.providers.detail.cards.completedSuffix}</p>
              </div>
              <div className="app-card border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{vi.providers.detail.cards.totalPurchases}</p>
                <p className="mt-1 text-xl font-black text-[var(--accent)]">{formatMoney(stats.totalPurchases)}</p>
              </div>
              <div className="app-card border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{vi.providers.detail.cards.totalPaid}</p>
                <p className="mt-1 text-xl font-black text-emerald-500">{formatMoney(stats.totalPaid)}</p>
              </div>
              <div className={`app-card border p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)] ${stats.totalDebt > 0 ? "border-red-200 bg-red-50/70" : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)]"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{vi.providers.detail.cards.totalDebt}</p>
                <p className={`mt-1 text-xl font-black ${stats.totalDebt > 0 ? "text-red-500" : "text-emerald-500"}`}>
                  {stats.totalDebt > 0 ? formatMoney(stats.totalDebt) : "0đ"}
                </p>
              </div>
            </div>

            <div className="app-card border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  <Star className="size-3" />
                  {vi.providers.detail.cards.trust}
                </p>
                <span className="text-[13px] font-black text-[var(--accent)]">
                  {provider.reliabilityScore}/100
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${provider.reliabilityScore}%` }}
                />
              </div>
            </div>

            <div className="app-card border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)] space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                <Building2 className="size-3" />
                {vi.providers.detail.summary.title}
              </p>
              <p className="text-[13px] text-[var(--fg-base)]">
                {vi.providers.detail.summary.code} <span className="font-bold">{provider.code}</span>
              </p>
              <p className="text-[13px] text-[var(--fg-base)]">
                {vi.providers.detail.summary.joined} <span className="font-bold">{formatDateLabel(provider.createdAt)}</span>
              </p>
              <p className="text-[13px] text-[var(--fg-base)]">
                {vi.providers.detail.summary.updated} <span className="font-bold">{formatDateCustom(provider.createdAt)}</span>
              </p>
            </div>

            {provider.notes && (
              <div className="app-card border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                  <StickyNote className="size-3" />
                  {vi.providers.detail.notes}
                </p>
                <p className="whitespace-pre-wrap text-[13px] text-[var(--fg-base)]">
                  {provider.notes}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-1 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-[0.95rem] px-4 py-2.5 text-[12px] font-bold transition-all ${
                      activeTab === tab.id
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "text-[var(--fg-muted)] hover:bg-white"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-5">
                {activeTab === "purchase-orders" && (
                  <ProviderPurchaseOrdersPanel
                    purchaseOrders={purchaseOrders}
                    isLoading={isPOLoading}
                    onPayPurchaseOrder={setPayingPO}
                  />
                )}

                {activeTab === "financials" && (
                  <ProviderFinancialsPanel purchaseOrders={purchaseOrders} stats={stats} />
                )}
              </div>
            </div>
          </div>
        </div>

        {provider && isEditOpen && (
          <ProviderEditModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
          onSuccess={() => appToast.success(vi.providers.detail.updated)}
            provider={provider}
          />
        )}

        {isCreatePOOpen && (
          <CreatePurchaseOrderModal
            providerId={providerId}
            isOpen={isCreatePOOpen}
            onClose={() => setIsCreatePOOpen(false)}
          />
        )}

        {payingPO && (
          <ProviderPurchaseOrderPaymentModal
            providerId={providerId}
            purchaseOrder={payingPO}
            onClose={() => setPayingPO(null)}
          />
        )}
      </PageContainer>
    </AppLayout>
  );
}
