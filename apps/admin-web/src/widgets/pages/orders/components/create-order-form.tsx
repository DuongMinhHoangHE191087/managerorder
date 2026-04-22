"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  useForm,
  useFieldArray,
  useWatch,
  type UseFieldArrayAppend,
  type UseFormSetValue,
} from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { appToast } from "@/shared/ui/app-toast";
import { vi } from "@/shared/messages/vi";
import {
  Plus, Trash2,
  ChevronDown, Warehouse,
  AlertTriangle, CreditCard, Banknote,
  UploadCloud, CalendarDays, StickyNote, DollarSign, Copy,
  ExternalLink, Sparkles, ArrowRight,
} from "lucide-react";

import { createOrderInputSchema, type CreateOrderInput, type CreateOrderFieldValues } from "@/lib/domain/schemas";
import type { Customer as _Customer, ProductService as _ProductService, SourceAccount as _SourceAccount, PaymentSource as _PaymentSource, SalesChannel as _SalesChannel } from "@/lib/domain/types";
import { formatMoney, formatDateShort } from "@/lib/utils";
import { FadeIn, SlideUp, ScaleButton } from "@/shared/ui/animations";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import { CustomerCreateModal } from "@/widgets/pages/customers/components/customer-create-modal";
import { ProductCreateModal } from "@/widgets/pages/products/components/product-create-modal";
import { useCustomers } from "@/widgets/pages/customers/hooks/use-customers";
import { useProducts } from "@/widgets/pages/products/hooks/use-products";
import { useSourceAccounts } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { useSystemSettings, usePaymentSources, useSalesChannels } from "@/widgets/pages/settings/hooks/use-settings";
import { useCreateOrder } from "@/widgets/pages/orders/hooks/use-orders";
import { useProviderPrices } from "@/widgets/pages/orders/new/hooks/use-provider-product-prices";
import { buildInvoiceNumber, buildPaymentInstructionText, hasConfiguredPaymentInstructions } from "@/lib/settings/system-settings";
import { toLegacyPaymentMethod } from "@/lib/domain/financial";
import type { OrderSuccessSnapshot } from "@/lib/orders/order-share";

import { CustomerCombobox, ProductCombobox, SourceAccountCombobox, PaymentSourceCombobox, SalesChannelCombobox } from "./create-form/comboboxes";
import { DuolingoNickField } from "./create-form/duolingo-nick-field";
import { ProofUploader } from "./create-form/proof-uploader";
import { OrderSummaryPanel } from "./create-form/order-summary-panel";
import type { AccountSuggestion } from "@/lib/domain/allocation-engine";

type FormItem = {
  productId: string;
  quantity: number;
  costPriceVnd?: number;
  sellPriceVnd?: number;
  notes?: string;
  assignedSourceAccountId?: string;
  customerNickUsed?: string;
};

type CreatedOrderResponse = {
  id: string;
  order_code?: string | null;
  created_at?: string | null;
  warning?: string | null;
};

type DuplicateOrderHit = {
  id: string;
  order_code: string | null;
  status: string;
  product_name: string | null;
  quantity: number | null;
  total_amount: number | null;
  created_at: string;
};

type DuplicateOrderCheck = {
  isDuplicate: boolean;
  existingOrders: DuplicateOrderHit[];
  message?: string;
};

function DuplicateOrderBanner({
  duplicateCheck,
}: {
  duplicateCheck: DuplicateOrderCheck;
}) {
  if (!duplicateCheck.isDuplicate || duplicateCheck.existingOrders.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-ios border border-amber-300/60 bg-amber-50/80 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-widest text-amber-700">
            <AlertTriangle className="size-4" />
            Cảnh báo đơn trùng
          </div>
          <p className="text-[13px] font-medium text-amber-800">
            {duplicateCheck.message || "Hệ thống phát hiện đơn tương tự của cùng khách và cùng ngày."}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-300/50 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Số đơn trùng</p>
          <p className="text-2xl font-black text-amber-700">{duplicateCheck.existingOrders.length}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {duplicateCheck.existingOrders.slice(0, 4).map((order) => (
          <div key={order.id} className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[var(--fg-base)]">
                #{order.order_code || order.id.slice(0, 8).toUpperCase()} • {order.product_name || "Sản phẩm"}
              </p>
              <p className="text-[11px] text-[var(--fg-muted)]">
                {order.quantity ?? 1} sản phẩm • {formatMoney(Number(order.total_amount ?? 0))} • {formatDateShort(order.created_at)}
              </p>
            </div>
            <Link
              href={`/orders/${order.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-200"
            >
              <ExternalLink className="size-3.5" />
              Mở đơn
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

const orderText = vi.orders.createForm;

/* ─── CostPriceField (Giá nhập + NCC dropdown) ─────────────────────── */

function CostPriceField({ productId: _productId, defaultCost, value, onChange }: {
  productId: string;
  defaultCost?: number;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  const { data: providerPrices = [] } = useProviderPrices(_productId || undefined);
  const displayValue = value ?? defaultCost ?? 0;

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest flex items-center gap-1.5">
        <DollarSign className="size-3 text-[var(--accent)]" />
        {orderText.labels.costPrice}
      </label>
      <Input
        type="number"
        min={0}
        value={displayValue}
        onChange={e => {
          const v = parseInt(e.target.value);
          onChange(isNaN(v) ? undefined : v);
        }}
        placeholder={orderText.labels.costPricePlaceholder}
        className="text-[13px] font-bold bg-white hover:border-[var(--accent)] transition-colors"
      />
      {providerPrices.length > 0 && (
        <select
          value=""
          onChange={e => {
            const cost = parseInt(e.target.value);
            if (!isNaN(cost)) onChange(cost);
          }}
          className="w-full px-3 py-2 text-[11px] font-bold rounded-lg border border-dashed border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--fg-base)] hover:border-[var(--accent)] transition-colors cursor-pointer"
        >
          <option value="">{orderText.labels.providerPrice}</option>
          {providerPrices.map(pp => (
            <option key={pp.id} value={pp.cost_vnd}>
              {pp.provider_name}: {formatMoney(pp.cost_vnd)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/* ─── SellPriceField (Giá bán linh hoạt + gợi ý) ─────────────────────── */

function SellPriceField({ productId: _productId, defaultPrice, customerType: _customerType, value, onChange }: {
  productId: string;
  defaultPrice?: number;
  customerType?: "retail" | "wholesale" | "agency";
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  const base = defaultPrice ?? 0;
  const displayValue = value ?? base;

  // Quick-fill price suggestions (actual VND amounts)
  const suggestions = [
    { label: orderText.labels.originalPrice, price: base },
    ...(base > 0 ? [
      { label: orderText.labels.ctv, price: Math.round(base * 0.9) },
      { label: orderText.labels.vip, price: Math.round(base * 0.95) },
    ] : []),
  ];

  // Badge showing discount vs original
  const discount = base > 0 && displayValue < base
    ? Math.round((1 - displayValue / base) * 100)
    : 0;

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-2 uppercase tracking-widest flex items-center gap-1.5">
        <DollarSign className="size-3 text-emerald-500" />
        {orderText.labels.sellPrice}
        {discount > 0 && (
          <span className="ml-1 text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 rounded-full font-black">-{discount}%</span>
        )}
      </label>
      <Input
        type="number"
        min={0}
        value={displayValue}
        onChange={e => {
          const v = parseInt(e.target.value);
          onChange(isNaN(v) ? undefined : v);
        }}
        placeholder={orderText.labels.sellPricePlaceholder}
        className="text-[13px] font-bold bg-white hover:border-emerald-500 transition-colors"
      />
      {base > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {suggestions.map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => onChange(s.price)}
              className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${
                displayValue === s.price
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                  : "border-[var(--border-soft)] text-[var(--fg-muted)] hover:border-emerald-500/50 hover:text-emerald-600"
              }`}
            >
              {s.label}: {formatMoney(s.price)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Form ───────────────────────────────────────────────────────────── */

const PAYMENT_METHODS = [
  { key: "prepaid", label: orderText.paymentTerms.prepaid, icon: CreditCard, color: "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" },
  { key: "credit", label: orderText.paymentTerms.credit, icon: Banknote, color: "border-[var(--warning)] bg-[var(--warning)]/10 text-[var(--warning)]" },
  { key: "cod", label: orderText.paymentTerms.cod, icon: Banknote, color: "border-blue-500 bg-blue-50 text-blue-600" },
] as const;

type CustomerLike = _Customer;
type ProductLike = _ProductService;
type SourceAccountLike = _SourceAccount;
type PaymentSourceLike = _PaymentSource;
type SalesChannelLike = _SalesChannel;

const OrderCustomerSection = memo(function OrderCustomerSection({
  customers,
  value,
  selectedContact,
  selCustomer,
  isCreateCustomerOpen,
  onCreateCustomerOpenChange,
  onCustomerChange,
  onCreateCustomerSuccess,
  onSelectedContactChange,
  errorMessage,
}: {
  customers: CustomerLike[];
  value: string;
  selectedContact: string;
  selCustomer?: CustomerLike;
  isCreateCustomerOpen: boolean;
  onCreateCustomerOpenChange: (open: boolean) => void;
  onCustomerChange: (id: string) => void;
  onCreateCustomerSuccess: (newCust: CustomerLike) => void;
  onSelectedContactChange: (value: string) => void;
  errorMessage?: string;
}) {
  return (
    <SlideUp delay={0.1} className="glass-card rounded-ios p-6 shadow-sm border border-[var(--border-soft)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[14px] font-bold text-white">1</span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{orderText.sections.customer.title}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{orderText.sections.customer.description}</p>
        </div>
      </div>
      <CustomerCombobox
        customers={customers}
        value={value}
        onCreateNew={() => onCreateCustomerOpenChange(true)}
        onChange={onCustomerChange}
      />
      <CustomerCreateModal
        isOpen={isCreateCustomerOpen}
        onClose={() => onCreateCustomerOpenChange(false)}
        onSuccess={onCreateCustomerSuccess}
      />
      {errorMessage ? (
        <p className="mt-2 flex items-center gap-1 text-[12px] font-medium text-[var(--danger)]">
          <AlertTriangle className="size-3.5" />
          {errorMessage}
        </p>
      ) : null}
      {selCustomer && selCustomer.contacts.length > 0 ? (
        <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-4 transition-all">
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
            {orderText.labels.transactionContact} <span className="ml-1 rounded border bg-[var(--bg-app)] px-1 text-[9px] font-normal lowercase">{orderText.labels.editable}</span>
          </label>
          <Input
            value={selectedContact}
            onChange={(event) => onSelectedContactChange(event.target.value)}
            className="bg-white font-medium"
            placeholder={orderText.labels.linkEmail}
          />
        </div>
      ) : null}
    </SlideUp>
  );
});

const OrderProductItem = memo(function OrderProductItem({
  index,
  pid,
  item,
  product,
  products,
  sourceAccounts,
  isWH,
  hasProductError,
  setValue,
  remove,
  setWarehouseOpen,
  onCreateProductOpenChange,
}: {
  index: number;
  pid: string;
  item: FormItem | undefined;
  product?: ProductLike;
  products: ProductLike[];
  sourceAccounts: SourceAccountLike[];
  isWH: boolean;
  hasProductError?: string;
  setValue: UseFormSetValue<CreateOrderFieldValues>;
  remove: (index: number) => void;
  setWarehouseOpen: Dispatch<SetStateAction<boolean[]>>;
  onCreateProductOpenChange: (open: boolean) => void;
}) {
  const customerNickUsed = typeof item?.customerNickUsed === "string" ? item.customerNickUsed : "";
  const itemNotes = typeof item?.notes === "string" ? item.notes : "";
  const sourceAccountId = typeof item?.assignedSourceAccountId === "string" ? item.assignedSourceAccountId : "";
  const quantity = item?.quantity || 1;
  const allocationQuery = useQuery<AccountSuggestion[]>({
    queryKey: [...queryKeys.orders, "suggest-account", pid, quantity, customerNickUsed],
    queryFn: async () =>
      fetcher<AccountSuggestion[]>("/api/orders/suggest-account", {
        method: "POST",
        body: JSON.stringify({
          productId: pid,
          quantity,
          customerNick: customerNickUsed || undefined,
        }),
      }),
    enabled: Boolean(pid),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const rankedSuggestions = allocationQuery.data ?? [];

  function applySuggestedAccount(suggestion: AccountSuggestion) {
    setValue(`items.${index}.assignedSourceAccountId`, suggestion.sourceAccountId, { shouldValidate: true });
    const account = sourceAccounts.find((candidate) => candidate.id === suggestion.sourceAccountId);
    if (account?.reservedNicks?.length && !customerNickUsed) {
      setValue(`items.${index}.customerNickUsed`, account.reservedNicks[0], { shouldValidate: true });
      appToast.success(orderText.labels.autoNick + ` ${account.reservedNicks[0]}`);
    }
  }

  return (
    <div className="group/item relative flex flex-col gap-4 rounded-2xl border-2 border-[var(--border-soft)] bg-[var(--surface-light)] p-5 shadow-sm transition-all hover:border-[var(--accent)]/30">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent)]/10 text-[11px] font-black text-[var(--accent)]">{index + 1}</span>
        <span className="text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.productItem}{index + 1}</span>
        {index > 0 ? (
          <button
            type="button"
            onClick={() => {
              remove(index);
              setWarehouseOpen((current) => current.filter((_, i) => i !== index));
            }}
            className="ml-auto flex size-8 items-center justify-center rounded-full bg-[var(--danger)]/10 text-[var(--danger)]/70 transition-all hover:bg-[var(--danger)]/20 hover:text-[var(--danger)]"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>

      <ProductCombobox
        products={products}
        value={pid}
        onCreateNew={() => onCreateProductOpenChange(true)}
        onChange={(id) => setValue(`items.${index}.productId`, id, { shouldValidate: true })}
      />

      {hasProductError ? (
        <p className="mt-[-0.5rem] flex items-center gap-1 text-[12px] font-medium text-[var(--danger)]">
          <AlertTriangle className="size-3.5" />
          {hasProductError}
        </p>
      ) : null}

      <div className="space-y-4 rounded-xl border border-[var(--border-soft)]/50 bg-[var(--bg-app)]/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">Số lượng</label>
            <Input
              type="number"
              min={1}
              value={item?.quantity || 1}
              onChange={(e) => setValue(`items.${index}.quantity`, parseInt(e.target.value, 10) || 1, { shouldValidate: true })}
              className="bg-white text-center text-[14px] font-black transition-colors hover:border-[var(--accent)]"
            />
          </div>
          <div className="md:col-span-2">
            <SellPriceField
              productId={pid}
              defaultPrice={product?.sellPriceVnd}
              value={item?.sellPriceVnd}
              onChange={(v) => setValue(`items.${index}.sellPriceVnd`, v)}
            />
          </div>
          <div className="md:col-span-1">
            <CostPriceField
              productId={pid}
              defaultCost={product?.buyPriceVnd}
              value={item?.costPriceVnd}
              onChange={(v) => setValue(`items.${index}.costPriceVnd`, v)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              {isWH ? orderText.labels.customerNick : orderText.labels.linkEmail}
              {product?.name?.toLowerCase().includes("duolingo") ? (
                <span className="ml-1 rounded bg-green-500/20 px-1 py-0.5 text-[9px] font-black text-green-400">{orderText.labels.auto}</span>
              ) : null}
            </label>
            {product?.name?.toLowerCase().includes("duolingo") ? (
              <DuolingoNickField
                value={customerNickUsed}
                notes={itemNotes}
                onValueChange={(v) => setValue(`items.${index}.customerNickUsed`, v)}
                onNotesChange={(v) => setValue(`items.${index}.notes`, v)}
              />
            ) : (
              <Input
                value={customerNickUsed}
                onChange={(e) => setValue(`items.${index}.customerNickUsed`, e.target.value)}
                placeholder={isWH ? `${orderText.labels.customerNick}...` : `${orderText.labels.linkEmail}...`}
                className="bg-white text-[13px] shadow-sm"
              />
            )}
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.note}</label>
            <Input
              value={itemNotes}
              onChange={(e) => setValue(`items.${index}.notes`, e.target.value)}
              placeholder={orderText.labels.notePlaceholder}
              className="bg-white text-[13px] shadow-sm"
            />
          </div>
        </div>
      </div>

      {sourceAccounts.length > 0 ? (
        <div className="border-t border-[var(--border-soft)]/60 pt-3">
          <button
            type="button"
            onClick={() => {
              setWarehouseOpen((current) => current.map((value, itemIndex) => (itemIndex === index ? !value : value)));
              if (isWH) setValue(`items.${index}.assignedSourceAccountId`, "");
            }}
            className={`flex items-center gap-2 text-[12px] font-bold transition-colors ${
              isWH ? "text-[var(--accent)]" : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
            }`}
          >
            <Warehouse className="size-4" />
            {orderText.labels.connectWarehouse}
            <span className={`ml-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              isWH ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-[var(--border-soft)] text-[var(--fg-muted)]"
              }`}>{isWH ? orderText.labels.warehouseOn : orderText.labels.warehouseOff}</span>
            <ChevronDown className={`ml-auto size-3.5 transition-transform ${isWH ? "rotate-180" : ""}`} />
          </button>
          {isWH ? (
            <FadeIn className="mt-3">
              <p className="mb-2 text-[11px] text-[var(--fg-muted)]">{orderText.labels.chooseWarehouseAccount}</p>
              <SourceAccountCombobox
                accounts={sourceAccounts}
                productId={pid}
                value={sourceAccountId}
                onChange={(id) => {
                  setValue(`items.${index}.assignedSourceAccountId`, id);
                  const acct = sourceAccounts.find((account) => account.id === id);
                  if (acct?.reservedNicks?.length && !customerNickUsed) {
                    setValue(`items.${index}.customerNickUsed`, acct.reservedNicks[0], { shouldValidate: true });
                        appToast.success(orderText.labels.autoNick + ` ${acct.reservedNicks[0]}`);
                  }
                }}
              />
              {allocationQuery.isLoading ? (
                <div className="mt-3 rounded-xl border border-[var(--border-soft)]/70 bg-[var(--surface-light)] px-3 py-3 text-[11px] font-medium text-[var(--fg-muted)]">
                  Đang phân tích kho phù hợp...
                </div>
              ) : null}
              {rankedSuggestions.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-300/40 bg-amber-50/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-700">
                    <Sparkles className="size-4" />
                    Gợi ý kho tối ưu
                  </div>
                  <div className="space-y-2">
                    {rankedSuggestions.map((suggestion, suggestionIndex) => {
                      const isSelected = sourceAccountId === suggestion.sourceAccountId;

                      return (
                        <div
                          key={suggestion.sourceAccountId}
                          className={`flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${
                            isSelected
                              ? "border-emerald-300 bg-emerald-50/80"
                              : "border-amber-200 bg-white"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--fg-base)]">
                              <span>{suggestion.email}</span>
                              {suggestionIndex === 0 ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                                  Tốt nhất
                                </span>
                              ) : null}
                              {isSelected ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                                  Đang dùng
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                              {suggestion.reason}
                            </p>
                            <p className="text-[11px] text-[var(--fg-muted)]">
                              Còn {suggestion.availableSlots} slot • Hết hạn sau {suggestion.daysLeft} ngày
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              applySuggestedAccount(suggestion);
                              appToast.success(`Đã áp dụng gợi ý: ${suggestion.email}`);
                            }}
                            disabled={isSelected}
                            className={`h-9 shrink-0 rounded-lg px-3 text-[11px] font-bold ${
                              isSelected
                                ? "border border-emerald-300 bg-emerald-100 text-emerald-700"
                                : "border border-amber-300 bg-white text-amber-700 hover:bg-amber-100"
                            }`}
                          >
                            {isSelected ? "Đã chọn" : "Áp dụng"}
                            <ArrowRight className="ml-1.5 size-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </FadeIn>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

const OrderProductsSection = memo(function OrderProductsSection({
  fields,
  formItems,
  products,
  sourceAccounts,
  warehouseOpen,
  setWarehouseOpen,
  remove,
  append,
  setValue,
  onCreateProductOpenChange,
  errorMessages,
}: {
  fields: { id: string }[];
  formItems: FormItem[];
  products: ProductLike[];
  sourceAccounts: SourceAccountLike[];
  warehouseOpen: boolean[];
  setWarehouseOpen: Dispatch<SetStateAction<boolean[]>>;
  remove: (index: number) => void;
  append: UseFieldArrayAppend<CreateOrderFieldValues, "items">;
  setValue: UseFormSetValue<CreateOrderFieldValues>;
  onCreateProductOpenChange: (open: boolean) => void;
  errorMessages: Array<string | undefined>;
}) {
  return (
    <SlideUp delay={0.2} className="glass-card rounded-ios p-6 shadow-sm border border-[var(--border-soft)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[14px] font-bold text-white">2</span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{orderText.sections.products.title}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{orderText.sections.products.description}</p>
        </div>
      </div>
      <div className="space-y-5">
        {fields.map((field, idx) => (
          <OrderProductItem
            key={field.id}
            index={idx}
            pid={formItems[idx]?.productId ?? ""}
            item={formItems[idx]}
            product={products.find((product) => product.id === formItems[idx]?.productId)}
            products={products}
            sourceAccounts={sourceAccounts}
            isWH={warehouseOpen[idx] ?? false}
            hasProductError={errorMessages[idx]}
            setValue={setValue}
            remove={remove}
            setWarehouseOpen={setWarehouseOpen}
            onCreateProductOpenChange={onCreateProductOpenChange}
          />
        ))}
        <ScaleButton>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              append({ productId: "", quantity: 1, costPriceVnd: undefined, sellPriceVnd: undefined, notes: "", assignedSourceAccountId: "", customerNickUsed: "" });
              setWarehouseOpen((current) => [...current, false]);
            }}
            className="group h-[60px] w-full border-2 border-dashed border-[var(--border-soft)] bg-transparent font-bold transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
          >
            <div className="mr-3 flex size-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-white">
              <Plus className="size-4" />
            </div>
            {orderText.labels.addAnotherProduct}
          </Button>
        </ScaleButton>
      </div>
    </SlideUp>
  );
});

const OrderPaymentSection = memo(function OrderPaymentSection({
  total,
  paymentTerms,
  paymentSources,
  salesChannels,
  paymentSourceId,
  salesChannelId,
  proofUrls,
  paymentInstructionText,
  paymentInstructionsReady,
  paymentNote,
  systemSettings,
  setPaymentTerms,
  setPaymentSourceId,
  setSalesChannelId,
  setProofUrls,
  setPaymentNote,
  onCopyText,
}: {
  total: number;
  paymentTerms: "prepaid" | "credit" | "cod";
  paymentSources: PaymentSourceLike[];
  salesChannels: SalesChannelLike[];
  paymentSourceId: string;
  salesChannelId: string;
  proofUrls: string[];
  paymentInstructionText: string | null;
  paymentInstructionsReady: boolean;
  paymentNote: string;
  systemSettings?: { bank_name?: string | null; bank_account?: string | null; personal_name?: string | null } | undefined;
  setPaymentTerms: (value: "prepaid" | "credit" | "cod") => void;
  setPaymentSourceId: (value: string) => void;
  setSalesChannelId: (value: string) => void;
  setProofUrls: (urls: string[]) => void;
  setPaymentNote: (value: string) => void;
  onCopyText: () => void;
}) {
  return (
    <SlideUp delay={0.3} className="glass-card rounded-ios border border-[var(--border-soft)] p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[14px] font-bold text-white">3</span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{orderText.sections.payment.title}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{orderText.sections.payment.description}</p>
        </div>
      </div>

      <div className="mb-5">
        <label className="mb-3 block text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.paymentMethods}</label>
        <div className="grid grid-cols-3 gap-3">
          {PAYMENT_METHODS.map((method) => {
            const Icon = method.icon;
            const active = paymentTerms === method.key;
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => setPaymentTerms(method.key)}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-[12px] font-bold transition-all ${
                  active ? method.color + " shadow-sm" : "border-[var(--border-soft)] bg-white text-[var(--fg-muted)] hover:border-[var(--accent)]/40"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {method.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.paymentSource}</label>
          <PaymentSourceCombobox sources={paymentSources} value={paymentSourceId} onChange={setPaymentSourceId} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.salesChannel}</label>
          <SalesChannelCombobox channels={salesChannels} value={salesChannelId} onChange={setSalesChannelId} />
        </div>
      </div>

      <div>
        <label className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
          <UploadCloud className="size-4 text-[var(--accent)]" />
          {orderText.labels.paymentProof}
          <span className="text-[9px] font-bold normal-case tracking-normal text-[var(--fg-muted)]/60">{orderText.labels.paymentProofNote}</span>
        </label>
        <ProofUploader value={proofUrls} onChange={setProofUrls} />
      </div>

      {total > 0 && paymentTerms === "prepaid" && paymentInstructionsReady && paymentInstructionText ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border-2 border-[var(--accent)]/20 bg-[var(--accent)]/5 p-6">
          <h3 className="mb-4 flex items-center gap-2 text-[14px] font-black text-[var(--accent)]">
            <CreditCard className="size-5" />
            {orderText.labels.paymentGuide}
          </h3>
          <div className="mb-4 w-full max-w-sm">
            <label className="mb-1.5 block text-center text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.transferNoteLabel}</label>
            <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder={orderText.labels.transferNotePlaceholder} className="bg-white text-center text-[13px] font-bold" />
          </div>
          <pre className="w-full max-w-xl whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-white p-4 text-[12px] font-medium text-[var(--fg-base)]">
            {paymentInstructionText}
          </pre>
          <div className="mt-4 flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={onCopyText} className="h-auto px-3 py-1.5 text-[12px] font-bold">
              <Copy className="mr-1 size-3.5" />
              {orderText.labels.copyTransfer}
            </Button>
          </div>
          <p className="mt-4 text-center text-[12px] font-bold text-[var(--fg-muted)]">
            {orderText.labels.bank} <span className="text-[var(--fg-base)]">{systemSettings?.bank_name}</span><br />
            {orderText.labels.accountNumber} <span className="text-[var(--fg-base)]">{systemSettings?.bank_account}</span><br />
            {orderText.labels.accountOwner} <span className="text-[var(--fg-base)]">{systemSettings?.personal_name}</span><br />
            {orderText.labels.transferContent} <span className="text-[var(--fg-base)]">{paymentNote || orderText.labels.optional}</span>
          </p>
        </div>
      ) : null}
    </SlideUp>
  );
});

const OrderScheduleSection = memo(function OrderScheduleSection({
  registeredAt,
  autoExpiresAt,
  products,
  primaryProductId,
  orderNotes,
  setRegisteredAt,
  setOrderNotes,
}: {
  registeredAt: string;
  autoExpiresAt: string;
  products: ProductLike[];
  primaryProductId: string | undefined;
  orderNotes: string;
  setRegisteredAt: (value: string) => void;
  setOrderNotes: (value: string) => void;
}) {
  return (
    <SlideUp delay={0.4} className="glass-card rounded-ios border border-[var(--border-soft)] p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[14px] font-bold text-white">4</span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{orderText.sections.schedule.title}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{orderText.sections.schedule.description}</p>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
            <CalendarDays className="size-3.5 text-[var(--accent)]" />
            {orderText.labels.registeredAt}
          </label>
          <Input type="date" value={registeredAt} onChange={(e) => setRegisteredAt(e.target.value)} className="w-full bg-white text-[14px] font-bold text-[var(--fg-base)] hover:border-[var(--accent)] focus:border-[var(--accent)]" />
          <p className="mt-1.5 text-[10px] font-medium text-[var(--fg-muted)]">{orderText.labels.registeredAtHint}</p>
        </div>
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
            <CalendarDays className="size-3.5 text-[var(--warning)]" />
            {orderText.labels.expiresAt}
          </label>
          <div className="flex w-full items-center justify-between rounded-xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-3 text-[14px] font-bold text-[var(--fg-base)]">
            <span>{autoExpiresAt || orderText.labels.chooseProductFirst}</span>
            {autoExpiresAt && primaryProductId ? (
              <span className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[9px] font-black uppercase text-[var(--warning)]">
                {(() => {
                  const product = products.find((entry) => entry.id === primaryProductId);
                  if (!product) return "";
                  return `${product.durationValue} ${product.durationType === "months" ? orderText.labels.durationUnits.months : product.durationType === "years" ? orderText.labels.durationUnits.years : orderText.labels.durationUnits.days}`;
                })()}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[10px] font-medium text-[var(--fg-muted)]">{orderText.labels.expiresAtHint}</p>
        </div>
      </div>
      <div>
        <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[var(--fg-muted)]">
          <StickyNote className="size-3.5 text-blue-500" />
          Ghi chú đơn hàng
          <span className="text-[9px] font-bold normal-case tracking-normal text-[var(--fg-muted)]/60">Tuỳ chọn • Tối đa 1000 ký tự</span>
        </label>
        <textarea
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Ghi chú nội bộ cho đơn hàng này (VD: Khách VIP, cần ưu tiên, yêu cầu đặc biệt...)"
          className="w-full resize-none rounded-xl border-2 border-[var(--border-soft)] bg-white px-4 py-3 text-[13px] text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 outline-none transition-all hover:border-[var(--accent)]/50 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
        {orderNotes.length > 0 ? (
          <p className="mt-1 text-right text-[10px] font-medium text-[var(--fg-muted)]">{orderNotes.length}/1000</p>
        ) : null}
      </div>
    </SlideUp>
  );
});

const OrderBillingSection = memo(function OrderBillingSection({
  requireInvoice,
  setRequireInvoice,
  setValue,
}: {
  requireInvoice: boolean;
  setRequireInvoice: (value: boolean) => void;
  setValue: UseFormSetValue<CreateOrderFieldValues>;
}) {
  return (
    <SlideUp delay={0.5} className="glass-card rounded-ios border border-[var(--border-soft)] p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[14px] font-bold text-white">5</span>
          <div>
          <h2 className="text-xl font-bold tracking-tight">{orderText.sections.billing.title}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{orderText.sections.billing.description}</p>
          </div>
        </div>
        <button type="button" onClick={() => setRequireInvoice(!requireInvoice)} className={`relative h-6 w-12 rounded-full transition-colors ${requireInvoice ? "bg-[var(--accent)]" : "bg-gray-300"}`}>
          <div className={`absolute left-1 top-1 size-4 rounded-full bg-white transition-transform ${requireInvoice ? "translate-x-6" : "translate-x-0"}`} />
        </button>
      </div>
      {requireInvoice ? (
        <div className="animate-in fade-in slide-in-from-top-2 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.invoiceCompany}</label>
            <Input placeholder={orderText.labels.invoiceCompanyPlaceholder} onChange={(e) => setValue("billingDetails.companyName", e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.invoiceTaxId}</label>
            <Input placeholder={orderText.labels.invoiceTaxIdPlaceholder} onChange={(e) => setValue("billingDetails.taxId", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.invoiceAddress}</label>
            <Input placeholder={orderText.labels.invoiceAddressPlaceholder} onChange={(e) => setValue("billingDetails.companyAddress", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">{orderText.labels.invoiceEmail}</label>
            <Input placeholder={orderText.labels.invoiceEmailPlaceholder} onChange={(e) => setValue("billingDetails.email", e.target.value)} />
          </div>
        </div>
      ) : null}
    </SlideUp>
  );
});

export function CreateOrderForm() {
  // React Query Hooks
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: sourceAccounts = [] } = useSourceAccounts();
  const { data: paymentSources = [] } = usePaymentSources();
  const { data: salesChannels = [] } = useSalesChannels();
  const { data: systemSettings } = useSystemSettings();
  const { mutateAsync: createOrder } = useCreateOrder();

  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [requireInvoice, setRequireInvoice] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState<"prepaid"|"credit"|"cod">("prepaid");
  const [paymentSourceId, setPaymentSourceId] = useState("");
  const [salesChannelId, setSalesChannelId] = useState("");
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const [paymentNote, setPaymentNote] = useState("");
  const [registeredAt, setRegisteredAt] = useState(() => {
    // Default to today in local timezone (YYYY-MM-DD format for date input)
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [orderNotes, setOrderNotes] = useState("");
  const [successSnapshot, setSuccessSnapshot] = useState<OrderSuccessSnapshot | null>(null);
  
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState([false]);
  const [selectedContact, setSelectedContact] = useState<string>("");
  const paymentInstructionsReady = hasConfiguredPaymentInstructions(systemSettings);
  const paymentInstructionText = buildPaymentInstructionText(systemSettings, paymentNote);

  const { handleSubmit, setValue, reset, control, formState: { errors, isSubmitting } } = useForm<CreateOrderFieldValues, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderInputSchema),
    defaultValues: {
      customerId: "",
      items: [{ productId: "", quantity: 1, costPriceVnd: undefined, sellPriceVnd: undefined, notes: "", assignedSourceAccountId: "", customerNickUsed: "" }],
      paymentMethod: "paid",
      paymentTerms: "prepaid",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedFormItems = useWatch({ control, name: "items" }) as FormItem[] | undefined;
  const formItems = useMemo(() => watchedFormItems ?? [], [watchedFormItems]);
  const total = formItems.reduce((a, i) => {
    const p = products.find(p => p.id === i.productId);
    const unitPrice = i.sellPriceVnd ?? p?.sellPriceVnd ?? 0;
    return a + unitPrice * (i.quantity || 1);
  }, 0);
  const selCustomer = customers.find(c => c.id === customerId);
  const selectedProductIds = useMemo(
    () => Array.from(new Set(formItems.map((item) => item.productId).filter(Boolean))),
    [formItems],
  );
  const duplicateOrderCheck = useQuery<DuplicateOrderCheck>({
    queryKey: [...queryKeys.orders, "duplicate-check", customerId, registeredAt, selectedProductIds.join(",")],
    queryFn: async () =>
      fetcher<DuplicateOrderCheck>("/api/orders/check-duplicate", {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId,
          product_ids: selectedProductIds,
          date: registeredAt || undefined,
        }),
      }),
    enabled: Boolean(customerId && selectedProductIds.length > 0),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const primaryProductId = formItems[0]?.productId;

  // Auto-calculate expiry date based on primary product duration
  const autoExpiresAt = (() => {
    if (!primaryProductId || !registeredAt) return "";
    const product = products.find(p => p.id === primaryProductId);
    if (!product) return "";
    const dt = new Date(registeredAt);
    if (product.durationType === 'years') {
      dt.setFullYear(dt.getFullYear() + (product.durationValue ?? 1));
    } else if (product.durationType === 'months') {
      dt.setMonth(dt.getMonth() + (product.durationValue ?? 1));
    } else {
      dt.setDate(dt.getDate() + (product.durationValue ?? 30));
    }
    return dt.toISOString().split('T')[0];
  })();
  const selPaySrc = paymentSources.find(s => s.id === paymentSourceId);
  const selChannel = salesChannels.find(c => c.id === salesChannelId);
  const hasDraftContent =
    Boolean(
      customerId ||
        paymentSourceId ||
        salesChannelId ||
        proofUrls.length ||
        paymentNote.trim() ||
        orderNotes.trim() ||
        selectedContact.trim() ||
        requireInvoice ||
        formItems.some(item =>
          Boolean(
            item.productId ||
              item.quantity !== 1 ||
              item.costPriceVnd ||
              item.sellPriceVnd ||
              item.notes?.trim() ||
              item.assignedSourceAccountId ||
              item.customerNickUsed,
          ),
        ),
    );

  const visibleSuccessSnapshot = successSnapshot && !hasDraftContent ? successSnapshot : null;
  const visibleApiNotice = hasDraftContent ? null : apiNotice;
  const customersRef = useRef(customers);
  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);
  const itemProductErrorMessages = useMemo(
    () => ((errors.items ?? []) as Array<{ productId?: { message?: string } } | undefined>).map(
      (itemError) => itemError?.productId?.message,
    ),
    [errors.items]
  );

  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    setValue("customerId", id, { shouldValidate: true });
    const customer = customersRef.current.find((entry) => entry.id === id);
    if (customer && customer.contacts.length > 0) {
      const mainContact = customer.contacts.find((entry) => entry.isPrimary) || customer.contacts[0];
      setSelectedContact(mainContact?.value ?? "");
      return;
    }
    setSelectedContact("");
  };

  const handleCreateCustomerSuccess = useCallback((newCustomer: CustomerLike) => {
    setCustomerId(newCustomer.id);
    setValue("customerId", newCustomer.id, { shouldValidate: true });
    if (newCustomer.contacts.length > 0) {
      setSelectedContact(newCustomer.contacts[0].value);
    }
  }, [setCustomerId, setSelectedContact, setValue]);

  const handleSelectedContactChange = useCallback((value: string) => {
    setSelectedContact(value);
  }, [setSelectedContact]);

  const handleCreateProductOpenChange = useCallback((open: boolean) => {
    setIsCreateProductOpen(open);
  }, [setIsCreateProductOpen]);

  const handleCopyText = useCallback(() => {
    if (!paymentInstructionText) {
      appToast.error(orderText.actions.copyMissing);
      return;
    }
    navigator.clipboard.writeText(paymentInstructionText).then(() => {
      appToast.success(orderText.actions.copySuccess);
    });
  }, [paymentInstructionText]);

  const handleSetPaymentTerms = useCallback((value: "prepaid" | "credit" | "cod") => {
    setPaymentTerms(value);
    setValue("paymentTerms", value);
    setValue("paymentMethod", toLegacyPaymentMethod(value) ?? undefined);
  }, [setValue]);

  const handleSetPaymentSourceId = useCallback((value: string) => {
    setPaymentSourceId(value);
  }, []);

  const handleSetSalesChannelId = useCallback((value: string) => {
    setSalesChannelId(value);
  }, []);

  const handleSetProofUrls = useCallback((urls: string[]) => {
    setProofUrls(urls);
    setValue("proofImageUrls", urls);
  }, [setValue]);

  const handleSetPaymentNote = useCallback((value: string) => {
    setPaymentNote(value);
  }, []);

  const handleSetRegisteredAt = useCallback((value: string) => {
    setRegisteredAt(value);
  }, []);

  const handleSetOrderNotes = useCallback((value: string) => {
    setOrderNotes(value);
  }, []);

  const handleSetRequireInvoice = useCallback((value: boolean) => {
    setRequireInvoice(value);
  }, []);

  async function onSubmit(values: CreateOrderInput) {
    setApiNotice(null);
    const loadingId = appToast.loading(orderText.actions.create);
    try {
      const createdOrder = await createOrder({
        ...values, 
        paymentTerms,
        paymentMethod: toLegacyPaymentMethod(paymentTerms) ?? undefined,
        paymentSourceId: paymentSourceId || undefined, 
        salesChannelId: salesChannelId || undefined, 
        proofImageUrls: proofUrls.length ? proofUrls : undefined, 
        contactSnapshot: selectedContact || undefined,
        billingDetails: requireInvoice ? values.billingDetails : undefined,
        registeredAt: registeredAt ? new Date(registeredAt).toISOString() : undefined,
        orderNotes: orderNotes || undefined,
      }) as CreatedOrderResponse;
      appToast.dismiss(loadingId);
      const customerContact =
        selectedContact ||
        selCustomer?.contacts.find(c => c.isPrimary)?.value ||
        selCustomer?.contacts[0]?.value ||
        null;
      const orderCode = createdOrder.order_code || createdOrder.id.slice(0, 8).toUpperCase();
      const createdAtIso = createdOrder.created_at || new Date().toISOString();
      const successItems = values.items.map((item) => {
        const product = products.find(p => p.id === item.productId);
        const unitPrice = item.sellPriceVnd ?? product?.sellPriceVnd ?? 0;
        const durationLabel = product
          ? `${product.durationValue} ${product.durationType === "months" ? "tháng" : product.durationType === "years" ? "năm" : "ngày"}`
          : null;

        return {
          name: product?.name ?? orderText.labels.productFallback,
          quantity: item.quantity || 1,
          unitPriceVnd: unitPrice,
          lineTotalVnd: unitPrice * (item.quantity || 1),
          durationLabel,
        };
      });

      const snapshot: OrderSuccessSnapshot = {
        orderId: createdOrder.id,
        orderCode,
        invoiceNumber: buildInvoiceNumber(systemSettings, createdAtIso, createdOrder.id),
        customerName: selCustomer?.name ?? null,
        customerContact,
        paymentMethodLabel: PAYMENT_METHODS.find(m => m.key === paymentTerms)?.label ?? "",
        paymentSourceName: selPaySrc?.name ?? null,
        salesChannelName: selChannel?.name ?? null,
        totalVnd: total,
        registeredAt,
        expiresAt: autoExpiresAt,
        paymentInstructionText:
          paymentTerms === "prepaid" && paymentInstructionsReady && paymentInstructionText
            ? paymentInstructionText
            : null,
        paymentNote: paymentNote || null,
        items: successItems,
        billingDetails: requireInvoice ? values.billingDetails ?? undefined : undefined,
        warning: createdOrder.warning ?? null,
        createdAt: createdAtIso,
      };

      setSuccessSnapshot(snapshot);
      if (createdOrder.warning) { setApiNotice(createdOrder.warning); appToast.warning(createdOrder.warning); }
      else { setApiNotice(null); }
      appToast.success(orderText.actions.created, {
        description: selCustomer?.name ? orderText.actions.customerLabel(selCustomer.name) : undefined,
        duration: 4000,
      });
      
      // Reset ALL form states — triệt để 100%
      reset({ 
        customerId: "", 
        items: [{ productId: "", quantity: 1, costPriceVnd: undefined, sellPriceVnd: undefined, notes: "", assignedSourceAccountId: "", customerNickUsed: "" }], 
        paymentMethod: "paid",
        paymentTerms: "prepaid",
      });
      setCustomerId("");
      setPaymentTerms("prepaid");
      setPaymentSourceId("");
      setSalesChannelId("");
      setProofUrls([]);
      setPaymentNote("");
      setOrderNotes("");
      setRequireInvoice(false);
      setSelectedContact("");
      setWarehouseOpen([false]);
      setRegisteredAt(() => {
        const now = new Date();
        return now.toISOString().split('T')[0];
      });
      
      // Scroll to top for clean UX
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      appToast.dismiss(loadingId);
      const msg = err instanceof Error ? err.message : orderText.actions.failed;
      appToast.error(orderText.actions.failedTitle, { description: msg, duration: 6000, showProgress: true });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-8 text-[var(--fg-base)] lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <OrderCustomerSection
          customers={customers}
          value={customerId}
          selectedContact={selectedContact}
          selCustomer={selCustomer}
          isCreateCustomerOpen={isCreateCustomerOpen}
          onCreateCustomerOpenChange={setIsCreateCustomerOpen}
          onCustomerChange={handleCustomerChange}
          onCreateCustomerSuccess={handleCreateCustomerSuccess}
          onSelectedContactChange={handleSelectedContactChange}
          errorMessage={errors.customerId?.message}
        />

        {duplicateOrderCheck.data?.isDuplicate ? (
          <DuplicateOrderBanner duplicateCheck={duplicateOrderCheck.data} />
        ) : null}

        <OrderProductsSection
          fields={fields}
          formItems={formItems}
          products={products}
          sourceAccounts={sourceAccounts}
          warehouseOpen={warehouseOpen}
          setWarehouseOpen={setWarehouseOpen}
          remove={remove}
          append={append}
          setValue={setValue}
          onCreateProductOpenChange={handleCreateProductOpenChange}
          errorMessages={itemProductErrorMessages}
        />

        <OrderPaymentSection
          total={total}
          paymentTerms={paymentTerms}
          paymentSources={paymentSources}
          salesChannels={salesChannels}
          paymentSourceId={paymentSourceId}
          salesChannelId={salesChannelId}
          proofUrls={proofUrls}
          paymentInstructionText={paymentInstructionText}
          paymentInstructionsReady={paymentInstructionsReady}
          paymentNote={paymentNote}
          systemSettings={systemSettings}
          setPaymentTerms={handleSetPaymentTerms}
          setPaymentSourceId={handleSetPaymentSourceId}
          setSalesChannelId={handleSetSalesChannelId}
          setProofUrls={handleSetProofUrls}
          setPaymentNote={handleSetPaymentNote}
          onCopyText={handleCopyText}
        />

        <OrderScheduleSection
          registeredAt={registeredAt}
          autoExpiresAt={autoExpiresAt}
          products={products}
          primaryProductId={primaryProductId}
          orderNotes={orderNotes}
          setRegisteredAt={handleSetRegisteredAt}
          setOrderNotes={handleSetOrderNotes}
        />

        <OrderBillingSection
          requireInvoice={requireInvoice}
          setRequireInvoice={handleSetRequireInvoice}
          setValue={setValue}
        />
      </div>

      <div className="lg:col-span-1">
        <OrderSummaryPanel
          formItems={formItems}
          products={products}
          total={total}
          customerId={customerId}
          selCustomer={selCustomer}
          paymentMethod={paymentTerms}
          paymentMethodLabel={PAYMENT_METHODS.find((m) => m.key === paymentTerms)?.label ?? ""}
          selPaySrc={selPaySrc}
          selChannel={selChannel}
          proofUrlsCount={proofUrls.length}
          registeredAt={registeredAt}
          expiresAt={autoExpiresAt}
          apiNotice={visibleApiNotice}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit(onSubmit)}
          successSnapshot={visibleSuccessSnapshot}
          onClearSuccess={() => {
            setSuccessSnapshot(null);
            setApiNotice(null);
          }}
        />
      </div>

      <ProductCreateModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        onSuccess={(_newProd) => {}}
      />
    </form>
  );
}
