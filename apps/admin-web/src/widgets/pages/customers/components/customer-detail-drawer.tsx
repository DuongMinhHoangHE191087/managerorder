"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ClipboardCopy,
  Edit,
  ExternalLink,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";

import { appToast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { SlideOverDrawer } from "@/shared/ui/slide-over-drawer";
import { cn, formatDateLabel, formatMoney } from "@/lib/utils";
import { vi } from "@/shared/messages/vi";
import type { Customer } from "@/lib/domain/types";
import type { CustomerGroup } from "@/shared/types/customers";
import { RfmBadge } from "@/widgets/pages/customers/components/rfm-badge";
import {
  useCustomerDetail,
  useCustomerOrders,
} from "@/widgets/pages/customers/hooks/use-customer-detail";
import { useCustomer360Stats } from "@/widgets/pages/customers/hooks/use-customers";

interface CustomerDetailDrawerProps {
  isOpen: boolean;
  customerId: string | null;
  fallbackCustomer: Customer | null;
  groups: CustomerGroup[];
  onClose: () => void;
  onEditCustomer: (customer: Customer) => void;
  onRenewCustomer: (customer: Customer) => void;
  onClearDebt: (id: string) => void;
}

const customerDetailText = vi.customers.detail;
const customerListText = vi.customers.list;

function getCustomerTypeLabel(type: Customer["customerType"]) {
  switch (type) {
    case "agency":
      return customerDetailText.typeLabels.agency;
    case "wholesale":
      return customerDetailText.typeLabels.wholesale;
    default:
      return customerDetailText.typeLabels.retail;
  }
}

function getTierLabel(tier: Customer["tier"]) {
  return tier === "vip" ? customerListText.tierVip : customerListText.tierLoyal;
}

function getOrderStatusClass(status: string) {
  if (status === "completed" || status === "active" || status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "pending" || status === "pending_payment" || status === "provisioning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "cancelled" || status === "refunded") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-[var(--border-soft)] bg-[var(--surface-light)] text-[var(--fg-muted)]";
}

function DrawerMetric({
  label,
  value,
  accent = "text-[var(--fg-base)]",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[1rem] border border-[var(--border-soft)] bg-white/85 p-3.5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">{label}</p>
      <p className={cn("mt-1 text-[14px] font-black tracking-tight", accent)}>{value}</p>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-5">
      <div className="animate-pulse rounded-[1.4rem] border border-[var(--border-soft)] bg-white/85 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="size-16 rounded-full bg-[var(--border-soft)]" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-2/3 rounded bg-[var(--border-soft)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--border-soft)]" />
            <div className="flex gap-2">
              <div className="h-7 w-24 rounded-full bg-[var(--border-soft)]" />
              <div className="h-7 w-20 rounded-full bg-[var(--border-soft)]" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-[1rem] border border-[var(--border-soft)] bg-[var(--border-soft)]/60" />
        ))}
      </div>
      <div className="animate-pulse space-y-3 rounded-[1.4rem] border border-[var(--border-soft)] bg-white/85 p-5 shadow-sm">
        <div className="h-4 w-32 rounded bg-[var(--border-soft)]" />
        <div className="h-20 rounded-[1rem] bg-[var(--border-soft)]/70" />
        <div className="h-20 rounded-[1rem] bg-[var(--border-soft)]/70" />
      </div>
    </div>
  );
}

export function CustomerDetailDrawer({
  isOpen,
  customerId,
  fallbackCustomer,
  groups,
  onClose,
  onEditCustomer,
  onRenewCustomer,
  onClearDebt,
}: CustomerDetailDrawerProps) {
  const activeCustomerId = customerId ?? fallbackCustomer?.id ?? "";

  const customerQuery = useCustomerDetail(activeCustomerId, isOpen);
  const ordersQuery = useCustomerOrders(activeCustomerId, isOpen);
  const statsQuery = useCustomer360Stats(activeCustomerId, isOpen);

  const customer = customerQuery.data ?? fallbackCustomer ?? null;
  const customerGroup = useMemo(() => {
    if (!customer?.group_id) {
      return null;
    }

    return groups.find((group) => group.id === customer.group_id) ?? null;
  }, [customer?.group_id, groups]);

  const contacts = customer?.contacts ?? [];
  const tags = customer?.tags ?? [];
  const orders = ordersQuery.data ?? [];
  const recentOrders = orders.slice(0, 4);
  const stats = statsQuery.data;

  const lifetimeValue = stats?.totalSpentVnd ?? orders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalPaid = stats?.totalPaymentsVnd ?? orders.reduce((sum, order) => sum + order.total_paid, 0);
  const totalOrders = stats?.totalOrders ?? orders.length;
  const avgOrderValue = stats?.avgOrderValueVnd ?? (totalOrders > 0 ? lifetimeValue / totalOrders : 0);
  const outstandingDebt = customer?.debtAmountVnd ?? stats?.outstandingDebtVnd ?? 0;
  const customerIsLoading = customerQuery.isLoading && !customer;

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(message);
    } catch (error) {
      console.error("[copyCustomerDetail]", error);
      appToast.error(vi.common.copyFailed);
    }
  };

  if (!isOpen) {
    return null;
  }

  const headerTitle = customer ? customer.name : customerDetailText.title;
  const customerHref = customer ? `/customers/${customer.id}` : null;
  const createOrderHref = customer
    ? `/orders/new?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}`
    : null;

  return (
    <SlideOverDrawer isOpen={isOpen} onClose={onClose} title={headerTitle} width="max-w-2xl">
      {customerIsLoading ? (
        <DrawerSkeleton />
      ) : customer ? (
        <div className="space-y-5">
          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,244,0.88))] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-[24px] font-black text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)]">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--fg-muted)]">
                    {vi.customers.detail.breadcrumbRoot}
                  </p>
                  <h3 className="mt-1 truncate text-[22px] font-black tracking-tight text-[var(--fg-base)]">
                    {customer.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--border-soft)] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      {getCustomerTypeLabel(customer.customerType)}
                    </span>
                    <span className="rounded-full border border-[var(--border-soft)] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      {getTierLabel(customer.tier)}
                    </span>
                    {customer.segment ? (
                      <RfmBadge segment={customer.segment} rfmScore={customer.rfmScore} showScore size="sm" />
                    ) : null}
                    {customerGroup ? (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${customerGroup.color}12`,
                          color: customerGroup.color,
                          borderColor: `${customerGroup.color}30`,
                        }}
                      >
                        {customerGroup.name}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {customerHref ? (
                  <Link
                    href={customerHref}
                    className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
                  >
                    <ExternalLink className="size-4" />
                    {vi.common.view}
                  </Link>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onEditCustomer(customer)}
                  className="rounded-[1rem] px-4 py-2.5 text-[13px] font-bold"
                >
                  <Edit className="size-4" />
                  {vi.customers.detail.edit}
                </Button>
                {createOrderHref ? (
                  <Link
                    href={createOrderHref}
                    className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
                  >
                    <Plus className="size-4" />
                    {vi.customers.detail.createOrder}
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DrawerMetric label={vi.customers.detail.cards.totalOrders} value={String(totalOrders)} />
              <DrawerMetric label={vi.customers.detail.cards.spending} value={formatMoney(lifetimeValue)} accent="text-[var(--accent)]" />
              <DrawerMetric label={vi.customers.detail.cards.paid} value={formatMoney(totalPaid)} accent="text-emerald-600" />
              <DrawerMetric
                label={vi.customers.detail.cards.debt}
                value={outstandingDebt > 0 ? formatMoney(outstandingDebt) : vi.customers.detail.cards.noDebt}
                accent={outstandingDebt > 0 ? "text-[var(--danger)]" : "text-emerald-600"}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <DrawerMetric label="Giá trị trung bình/đơn" value={formatMoney(avgOrderValue)} />
              <DrawerMetric
                label="Độ tin cậy"
                value={`${customer.reliabilityScore}/100`}
                accent="text-[var(--accent)]"
              />
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[14px] font-bold text-[var(--fg-base)]">Thông tin liên hệ</h4>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">Dùng dữ liệu chính từ hồ sơ khách hàng để điều hướng các hành động nhanh.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void copyToClipboard(customer.id, "Đã sao chép ID khách hàng")}
                className="rounded-[0.9rem] px-3 py-2 text-[12px] font-bold"
              >
                <ClipboardCopy className="size-4" />
                Sao chép ID
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {contacts.length === 0 ? (
                <div className="rounded-[1rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)] p-4 text-[13px] text-[var(--fg-muted)]">
                  {customerDetailText.noContacts}
                </div>
              ) : (
                contacts.map((contact, index) => {
                  const icon =
                    contact.type === "email" ? (
                      <Mail className="size-4 text-blue-600" />
                    ) : contact.type === "phone" || contact.type === "zalo" || contact.type === "telegram" ? (
                      <Phone className="size-4 text-emerald-600" />
                    ) : (
                      <UserRound className="size-4 text-[var(--accent)]" />
                    );

                  return (
                    <div
                      key={contact.id || `${contact.type}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                            {contact.type}
                            {contact.isPrimary ? ` · ${vi.common.primary}` : ""}
                          </p>
                          <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">{contact.value}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void copyToClipboard(contact.value, "Đã sao chép liên hệ")}
                        className="rounded-[0.85rem] px-3 py-1.5 text-[11px] font-bold"
                      >
                        <ClipboardCopy className="size-3.5" />
                        Copy
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="flex items-center gap-2 text-[14px] font-bold text-[var(--fg-base)]">
                <Tag className="size-4 text-[var(--accent)]" />
                Thẻ, nhóm và ghi chú
              </h4>
              {tags.length > 0 ? (
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-light)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  {tags.length} thẻ
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Nhóm khách</p>
                  {customerGroup ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
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

                <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Thẻ</p>
                  {tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tags.map((tag) => (
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

                <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-[var(--accent)]" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                      RFM và lịch sử
                    </p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <DrawerMetric
                      label="Recency"
                      value={String(customer.rfmRecency ?? 0)}
                    />
                    <DrawerMetric
                      label="Frequency"
                      value={String(customer.rfmFrequency ?? 0)}
                    />
                    <DrawerMetric
                      label="Monetary"
                      value={String(customer.rfmMonetary ?? 0)}
                    />
                  </div>
                  <div className="mt-3 rounded-[1rem] border border-[var(--border-soft)] bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">RFM score</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-[18px] font-black text-[var(--accent)]">{customer.rfmScore ?? 0}/100</p>
                      {customer.segment ? (
                        <RfmBadge segment={customer.segment} rfmScore={customer.rfmScore} showScore size="sm" />
                      ) : null}
                    </div>
                    {customer.lastRfmCalculatedAt ? (
                      <p className="mt-2 text-[11px] text-[var(--fg-muted)]">
                        Cập nhật {formatDateLabel(customer.lastRfmCalculatedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Ghi chú</p>
                  {customer.notes ? (
                    <p className="mt-2 whitespace-pre-wrap rounded-[1rem] border border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] leading-6 text-[var(--fg-base)]">
                      {customer.notes}
                    </p>
                  ) : (
                    <p className="mt-2 text-[13px] text-[var(--fg-muted)]">Chưa có ghi chú</p>
                  )}
                </div>

                <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fg-muted)]">Dấu vết hồ sơ</p>
                  <div className="mt-3 grid gap-3">
                    <DrawerMetric label="Tạo lúc" value={formatDateLabel(customer.createdAt)} />
                    <DrawerMetric label="Tín nhiệm" value={`${customer.reliabilityScore}/100`} />
                    <DrawerMetric
                      label="Số dư"
                      value={formatMoney(customer.balanceVnd ?? 0)}
                      accent="text-[var(--accent)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[14px] font-bold text-[var(--fg-base)]">{customerDetailText.nicksPanel.title}</h4>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{customerDetailText.nicksPanel.description}</p>
              </div>
              <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
                {(customer.nicksRegistry ?? []).length} {customerDetailText.nicksPanel.countSuffix}
              </span>
            </div>

            {(customer.nicksRegistry ?? []).length === 0 ? (
              <div className="mt-4 rounded-[1rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)] p-5 text-[13px] text-[var(--fg-muted)]">
                {customerDetailText.nicksPanel.emptyTitle}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {(customer.nicksRegistry ?? []).slice(0, 6).map((nick, index) => (
                  <div
                    key={`${nick.nick}-${index}`}
                    className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">{nick.nick}</p>
                        <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{nick.type}</p>
                      </div>
                      {nick.notes ? (
                        <span className="max-w-[50%] truncate text-right text-[12px] italic text-[var(--fg-muted)]">
                          {nick.notes}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(customer.nicksRegistry ?? []).length > 6 ? (
                  <p className="text-[12px] text-[var(--fg-muted)]">
                    +{(customer.nicksRegistry ?? []).length - 6} mục nữa
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[14px] font-bold text-[var(--fg-base)]">Đơn hàng gần đây</h4>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Dữ liệu đơn hàng được lấy từ luồng API chính, cho phép theo dõi doanh thu và công nợ ngay trong drawer.
                </p>
              </div>
              <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
                {orders.length} đơn
              </span>
            </div>

            {ordersQuery.isLoading && orders.length === 0 ? (
              <div className="mt-4 space-y-3 animate-pulse">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-28 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]"
                  />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="mt-4 rounded-[1rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)] p-5 text-[13px] text-[var(--fg-muted)]">
                {customerDetailText.ordersPanel.emptyTitle}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {recentOrders.map((order) => {
                  const remaining = Math.max(order.total_amount - order.total_paid, 0);
                  const paidPercent = order.total_amount > 0 ? Math.min((order.total_paid / order.total_amount) * 100, 100) : 0;
                  const productNames = order.items
                    .map((item) => item.productName ?? item.product_name ?? customerDetailText.ordersPanel.productLabel)
                    .join(", ");
                  const statusLabel =
                    customerDetailText.ordersPanel.statusLabels[order.status as keyof typeof customerDetailText.ordersPanel.statusLabels] ??
                    order.status;

                  return (
                    <div
                      key={order.id}
                      className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-[var(--fg-base)]">{productNames || customerDetailText.ordersPanel.orderLabel}</p>
                          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                            {formatDateLabel(order.created_at)} · #{order.id.slice(0, 8)}
                          </p>
                        </div>
                        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", getOrderStatusClass(order.status))}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wider">
                            <span className="text-[var(--fg-muted)]">{customerDetailText.ordersPanel.paymentLabel}</span>
                            <span className={paidPercent >= 100 ? "text-emerald-500" : "text-[var(--fg-base)]"}>
                              {formatMoney(order.total_paid)} / {formatMoney(order.total_amount)}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                paidPercent >= 100 ? "bg-emerald-500" : paidPercent > 0 ? "bg-amber-500" : "bg-[var(--border-soft)]",
                              )}
                              style={{ width: `${paidPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <DrawerMetric label="Tổng" value={formatMoney(order.total_amount)} />
                        <DrawerMetric label="Đã thu" value={formatMoney(order.total_paid)} accent="text-emerald-600" />
                        <DrawerMetric
                          label="Còn lại"
                          value={remaining > 0 ? formatMoney(remaining) : vi.customers.detail.cards.noDebt}
                          accent={remaining > 0 ? "text-[var(--danger)]" : "text-emerald-600"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-[14px] font-bold text-[var(--fg-base)]">Hành động nhanh</h4>
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Điều hướng được giữ nguyên trên trang đầy đủ, còn drawer này chỉ gom các hành động cốt lõi của luồng khách hàng.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {outstandingDebt > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onClearDebt(customer.id)}
                    className="rounded-[1rem] px-4 py-2.5 text-[13px] font-bold"
                  >
                    <Trash2 className="size-4" />
                    {customerListText.actions.collectAllDebt}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onRenewCustomer(customer)}
                  className="rounded-[1rem] px-4 py-2.5 text-[13px] font-bold"
                >
                  <RefreshCw className="size-4" />
                  {customerListText.actions.debt}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onEditCustomer(customer)}
                  className="rounded-[1rem] px-4 py-2.5 text-[13px] font-bold"
                >
                  <Edit className="size-4" />
                  {vi.customers.detail.edit}
                </Button>
                {customerHref ? (
                  <Link
                    href={customerHref}
                    className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_16px_30px_rgba(var(--accent-rgb),0.2)] transition-all hover:shadow-[0_20px_36px_rgba(var(--accent-rgb),0.28)]"
                  >
                    <ExternalLink className="size-4" />
                    {vi.common.viewAll}
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-[1.3rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface-light)] p-6 text-[13px] text-[var(--fg-muted)]">
          {customerQuery.isError
            ? customerQuery.error instanceof Error
              ? customerQuery.error.message
              : customerDetailText.errorDescription
            : customerDetailText.notFoundTitle}
        </div>
      )}
    </SlideOverDrawer>
  );
}
