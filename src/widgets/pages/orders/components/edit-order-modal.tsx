"use client";

import { memo, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { appToast } from "@/shared/ui/app-toast";
import {
  Calendar, DollarSign, Image as ImageIcon,
  TrendingUp, Warehouse, Unlink, Link2, CheckCircle2, AlertTriangle,
  StickyNote, ArrowUpRight, ArrowDownRight, User, FileText,
  Loader2, ChevronDown, ChevronUp
} from "lucide-react";

import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useUpdateOrder } from "@/widgets/pages/orders/hooks/use-orders";
import { useSourceAccounts, useDisconnectSourceAccount, useConnectSourceAccount } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { ProofUploader } from "./create-form/proof-uploader";
import { SourceAccountCombobox } from "./create-form/comboboxes";
import { formatMoney } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/react-query/query-keys";

/* ─── Types ──────────────────────────────────────────── */
interface OrderItem {
  id: string;
  product_id: string;
  notes: string | null;
  customer_nick_used: string | null;
  product_name_snapshot: string | null;
  quantity: number;
  assigned_source_account_id: string | null;
  assigned_source_account?: { id: string; email: string; provider: string } | null;
}

interface OrderData {
  id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  unit_price_vnd: number | null;
  cost_price_vnd: number | null;
  total_amount_vnd: number;
  total_cost_vnd: number | null;
  sales_note: string | null;
  expires_at: string | null;
  created_at?: string;
  proof_image_urls: string[] | null;
  items: OrderItem[];
}

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderData;
  onSuccess?: () => void;
}

/* ─── Tab Types ──────────────────────────────────────── */
type TabId = "pricing" | "allocation" | "proof";

interface TabDef {
  id: TabId;
  label: string;
  icon: ReactNode;
  badge?: string;
}

/* ─── Reusable Sub-Components ────────────────────────── */

function SectionCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/60 backdrop-blur-sm overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function FieldLabel({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider mb-1.5">
      {icon}
      {children}
    </label>
  );
}

function StatBlock({
  label,
  value,
  color = "var(--fg-base)",
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <span className="text-[16px] font-black tabular-nums" style={{ color }}>
        {value}
      </span>
      {sub}
    </div>
  );
}

const EditOrderTabBar = memo(function EditOrderTabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabDef[];
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div className="mb-5 flex gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/80 p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`
              flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5
              text-[12px] font-semibold transition-all duration-200 ease-out
              ${isActive
                ? "bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/20"
                : "text-[var(--fg-muted)] hover:bg-[var(--border-soft)]/50 hover:text-[var(--fg-base)]"
              }
            `}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge ? (
              <span
                className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none ${
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-[var(--accent)]/10 text-[var(--accent)]"
                }`}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});

const EditOrderPricingTab = memo(function EditOrderPricingTab({
  unitPrice,
  costPrice,
  salesNote,
  createdAt,
  expiresAt,
  totalAmount,
  totalCost,
  profit,
  profitPercent,
  qty,
  setUnitPrice,
  setCostPrice,
  setSalesNote,
  setCreatedAt,
  setExpiresAt,
}: {
  unitPrice: number;
  costPrice: number;
  salesNote: string;
  createdAt: string;
  expiresAt: string;
  totalAmount: number;
  totalCost: number;
  profit: number;
  profitPercent: string;
  qty: number;
  setUnitPrice: (value: number) => void;
  setCostPrice: (value: number) => void;
  setSalesNote: (value: string) => void;
  setCreatedAt: (value: string) => void;
  setExpiresAt: (value: string) => void;
}) {
  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
      <SectionCard>
        <div className="grid grid-cols-1 divide-y divide-[var(--border-soft)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <FieldLabel icon={<ArrowUpRight className="size-3 text-emerald-500" />}>
              Giá bán (VND)
            </FieldLabel>
            <Input
              type="number"
              min={0}
              value={unitPrice || ""}
              onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
              placeholder="Nhập giá bán..."
            />
          </div>
          <div className="p-4">
            <FieldLabel icon={<ArrowDownRight className="size-3 text-orange-500" />}>
              Giá vốn (VND)
            </FieldLabel>
            <Input
              type="number"
              min={0}
              value={costPrice || ""}
              onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
              placeholder="Nhập giá vốn..."
            />
          </div>
        </div>
      </SectionCard>

      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-gradient-to-br from-[var(--surface-light)] via-white/50 to-[var(--accent)]/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-around gap-4">
          <StatBlock
            label="Doanh thu"
            value={formatMoney(totalAmount)}
            color="var(--fg-base)"
            sub={<span className="text-[10px] text-[var(--fg-muted)]">SL {qty} × {formatMoney(unitPrice)}</span>}
          />
          <div className="hidden h-8 w-px bg-[var(--border-soft)] sm:block" />
          <StatBlock label="Tổng vốn" value={formatMoney(totalCost)} color="#f97316" />
          <div className="hidden h-8 w-px bg-[var(--border-soft)] sm:block" />
          <StatBlock
            label="Lợi nhuận"
            value={formatMoney(profit)}
            color={profit >= 0 ? "#10b981" : "#ef4444"}
            sub={
              <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                <TrendingUp className="size-3" />
                {profitPercent}%
              </span>
            }
          />
        </div>
      </div>

      <SectionCard>
        <div className="grid grid-cols-1 divide-y divide-[var(--border-soft)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <FieldLabel icon={<Calendar className="size-3" />}>Ngày bắt đầu</FieldLabel>
            <Input
              type="datetime-local"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
            />
          </div>
          <div className="p-4">
            <FieldLabel icon={<Calendar className="size-3 text-red-400" />}>Ngày hết hạn</FieldLabel>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <div>
        <FieldLabel icon={<StickyNote className="size-3" />}>Ghi chú đơn hàng</FieldLabel>
        <textarea
          className="w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-4 py-3 text-[13px] text-[var(--fg-base)] placeholder:text-[var(--fg-muted)]/50 outline-none transition-all duration-200 hover:border-[var(--accent)]/50 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/40"
          rows={3}
          value={salesNote}
          onChange={(e) => setSalesNote(e.target.value)}
          placeholder="Nhập ghi chú cho đơn hàng..."
        />
      </div>
    </div>
  );
});

type AllocationItemState = {
  id: string;
  notes: string;
  customer_nick_used: string;
  assigned_source_account_id: string;
  currentAccount: { id: string; email: string; provider: string } | null;
};

const EditOrderAllocationItem = memo(function EditOrderAllocationItem({
  index,
  originalItem,
  itemState,
  isExpanded,
  hasConnection,
  sourceAccounts,
  isDisconnecting,
  isConnecting,
  onToggleItem,
  onDisconnect,
  onConnect,
  onUpdateItemField,
}: {
  index: number;
  originalItem: OrderItem;
  itemState: AllocationItemState;
  isExpanded: boolean;
  hasConnection: boolean;
  sourceAccounts: { id: string; email: string; provider: string; maxSlots: number; usedSlots: number; productIds: string[]; expiresAt: string }[];
  isDisconnecting: boolean;
  isConnecting: boolean;
  onToggleItem: (index: number) => void;
  onDisconnect: (index: number) => void;
  onConnect: (index: number, newSourceAccountId: string) => void;
  onUpdateItemField: (index: number, field: "notes" | "customer_nick_used", value: string) => void;
}) {
  return (
    <SectionCard>
      <button
        type="button"
        onClick={() => onToggleItem(index)}
        className="flex w-full cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-[var(--border-soft)]/20"
      >
        <span className={`size-2.5 shrink-0 rounded-full ${hasConnection ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" : "animate-pulse bg-amber-400"}`} />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-bold text-[var(--fg-base)]">
            {originalItem.product_name_snapshot}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">
            {hasConnection ? (
              <>
                Kho: <span className="font-semibold text-emerald-600">{itemState.currentAccount!.email}</span>
              </>
            ) : (
              <span className="text-amber-500">Chưa kết nối kho</span>
            )}
            {originalItem.customer_nick_used ? (
              <span className="ml-1.5">• Nick: <strong>{originalItem.customer_nick_used}</strong></span>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--border-soft)] px-2 py-1 text-[10px] font-bold text-[var(--fg-muted)]">
          ×{originalItem.quantity}
        </span>
        {isExpanded ? (
          <ChevronUp className="size-4 shrink-0 text-[var(--fg-muted)]" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-[var(--fg-muted)]" />
        )}
      </button>

      {isExpanded ? (
        <div className="space-y-4 border-t border-[var(--border-soft)] p-4 pt-3">
          {hasConnection ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-emerald-700">
                  {itemState.currentAccount!.email}
                </p>
                <p className="text-[11px] text-emerald-600/70">
                  {itemState.currentAccount!.provider}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDisconnect(index)}
                disabled={isDisconnecting}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                {isDisconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <Unlink className="size-3.5" />}
                Gỡ
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <p className="text-[12px] text-amber-700">Chưa kết nối kho — Chọn tài khoản bên dưới</p>
            </div>
          )}

          <div>
            <FieldLabel icon={<Link2 className="size-3" />}>{hasConnection ? "Chuyển sang kho khác" : "Kết nối kho"}</FieldLabel>
            <SourceAccountCombobox
              accounts={sourceAccounts}
              productId={originalItem.product_id}
              value=""
              onChange={(newId) => {
                if (newId && newId !== itemState.currentAccount?.id) {
                  onConnect(index, newId);
                }
              }}
            />
            {isConnecting ? (
              <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--accent)]">
                <Loader2 className="size-3 animate-spin" />
                Đang kết nối...
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel icon={<User className="size-3" />}>Nick/Email khách</FieldLabel>
              <Input
                value={itemState.customer_nick_used}
                onChange={(e) => onUpdateItemField(index, "customer_nick_used", e.target.value)}
                placeholder="myemail@gmail.com..."
              />
            </div>
            <div>
              <FieldLabel icon={<FileText className="size-3" />}>Ghi chú</FieldLabel>
              <Input
                value={itemState.notes}
                onChange={(e) => onUpdateItemField(index, "notes", e.target.value)}
                placeholder="Ghi chú thêm..."
              />
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
});

const EditOrderAllocationTab = memo(function EditOrderAllocationTab({
  orderItems,
  items,
  expandedItems,
  sourceAccounts,
  connectedCount,
  totalItemCount,
  isDisconnecting,
  isConnecting,
  onToggleItem,
  onDisconnect,
  onConnect,
  onUpdateItemField,
}: {
  orderItems: OrderItem[];
  items: AllocationItemState[];
  expandedItems: Record<number, boolean>;
  sourceAccounts: { id: string; email: string; provider: string; maxSlots: number; usedSlots: number; productIds: string[]; expiresAt: string }[];
  connectedCount: number;
  totalItemCount: number;
  isDisconnecting: boolean;
  isConnecting: boolean;
  onToggleItem: (index: number) => void;
  onDisconnect: (index: number) => void;
  onConnect: (index: number, newSourceAccountId: string) => void;
  onUpdateItemField: (index: number, field: "notes" | "customer_nick_used", value: string) => void;
}) {
  return (
    <div className="space-y-3 animate-in fade-in-0 duration-200">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-4 py-3">
        <Warehouse className="size-4 text-[var(--accent)]" />
        <span className="text-[12px] font-semibold text-[var(--fg-base)]">Trạng thái kết nối:</span>
        <span className={`text-[12px] font-bold ${connectedCount === totalItemCount ? "text-emerald-500" : "text-amber-500"}`}>
          {connectedCount}/{totalItemCount} sản phẩm đã kết nối kho
        </span>
      </div>

      <div className="max-h-[50vh] space-y-2.5 overflow-y-auto pr-0.5 custom-scrollbar">
        {orderItems.map((originalItem, index) => {
          const itemState = items[index];
          if (!itemState) return null;

          return (
            <EditOrderAllocationItem
              key={originalItem.id}
              index={index}
              originalItem={originalItem}
              itemState={itemState}
              isExpanded={expandedItems[index] ?? false}
              hasConnection={Boolean(itemState.currentAccount)}
              sourceAccounts={sourceAccounts}
              isDisconnecting={isDisconnecting}
              isConnecting={isConnecting}
              onToggleItem={onToggleItem}
              onDisconnect={onDisconnect}
              onConnect={onConnect}
              onUpdateItemField={onUpdateItemField}
            />
          );
        })}
      </div>
    </div>
  );
});

const EditOrderProofTab = memo(function EditOrderProofTab({
  proofUrls,
  setProofUrls,
}: {
  proofUrls: string[];
  setProofUrls: (urls: string[]) => void;
}) {
  return (
    <div className="space-y-4 animate-in fade-in-0 duration-200">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)]/60 px-4 py-3">
        <ImageIcon className="size-4 text-[var(--accent)]" />
        <span className="text-[12px] font-semibold text-[var(--fg-base)]">Ảnh xác minh thanh toán</span>
        {proofUrls.length > 0 ? (
          <span className="rounded-full bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
            {proofUrls.length} ảnh
          </span>
        ) : null}
      </div>
      <ProofUploader value={proofUrls} onChange={setProofUrls} />
    </div>
  );
});

/* ─── Main Component ─────────────────────────────────── */
export function EditOrderModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: EditOrderModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("pricing");

  // ── Pricing state ──
  const [unitPrice, setUnitPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [salesNote, setSalesNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  // ── Proof state ──
  const [proofUrls, setProofUrls] = useState<string[]>([]);

  // ── Items state ──
  const [items, setItems] = useState<AllocationItemState[]>([]);

  // ── Expand/collapse per item ──
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  // Source accounts
  const { data: rawSourceAccounts } = useSourceAccounts();
  const sourceAccounts = useMemo(() => {
    if (!rawSourceAccounts) return [];
    return (rawSourceAccounts as {
      id: string; email: string; provider?: string; platform?: string;
      max_slots?: number; maxSlots?: number; used_slots?: number; usedSlots?: number; product_ids?: string[]; productIds?: string[]; expires_at?: string; expiresAt?: string;
    }[]).map((sa) => ({
      id: sa.id,
      email: sa.email,
      provider: sa.provider || sa.platform || "",
      maxSlots: sa.max_slots ?? sa.maxSlots ?? 0,
      usedSlots: sa.used_slots ?? sa.usedSlots ?? 0,
      productIds: sa.product_ids ?? sa.productIds ?? [],
      expiresAt: sa.expires_at ?? sa.expiresAt ?? new Date().toISOString(),
    }));
  }, [rawSourceAccounts]);

  // Hooks
  const { mutateAsync: disconnectAccount, isPending: isDisconnecting } = useDisconnectSourceAccount();
  const { mutateAsync: connectAccount, isPending: isConnecting } = useConnectSourceAccount();
  const { mutateAsync: updateOrder, isPending } = useUpdateOrder();

  // Reset state on modal open
  useEffect(() => {
    if (isOpen) {
      Promise.resolve().then(() => {
        setActiveTab("pricing");
        setUnitPrice(order.unit_price_vnd ?? 0);
        setCostPrice(order.cost_price_vnd ?? 0);
        setSalesNote(order.sales_note || "");
        setExpiresAt(order.expires_at ? new Date(order.expires_at).toISOString().slice(0, 16) : "");
        setCreatedAt(order.created_at ? new Date(order.created_at).toISOString().slice(0, 16) : "");
        setProofUrls(order.proof_image_urls || []);
        setItems(order.items.map(i => ({
          id: i.id,
          notes: i.notes || "",
          customer_nick_used: i.customer_nick_used || "",
          assigned_source_account_id: i.assigned_source_account_id || "",
          currentAccount: i.assigned_source_account || null,
        })));
        // Expand first item by default
        const expanded: Record<number, boolean> = {};
        order.items.forEach((_, i) => { expanded[i] = i === 0; });
        setExpandedItems(expanded);
      });
    }
  }, [isOpen, order]);

  // Computed
  const qty = order.quantity;
  const totalAmount = qty * unitPrice;
  const totalCost = qty * costPrice;
  const profit = totalAmount - totalCost;
  const profitPercent = totalAmount > 0 ? ((profit / totalAmount) * 100).toFixed(1) : "0.0";

  const connectedCount = items.filter(i => !!i.currentAccount).length;
  const totalItemCount = items.length;

  // Tab definitions
  const tabs: TabDef[] = useMemo(() => [
    {
      id: "pricing",
      label: "Giá & Ngày",
      icon: <DollarSign className="size-4" />,
    },
    {
      id: "allocation",
      label: "Cấp phát kho",
      icon: <Warehouse className="size-4" />,
      badge: `${connectedCount}/${totalItemCount}`,
    },
    {
      id: "proof",
      label: "Ảnh xác minh",
      icon: <ImageIcon className="size-4" />,
      badge: proofUrls.length > 0 ? `${proofUrls.length}` : undefined,
    },
  ], [connectedCount, totalItemCount, proofUrls.length]);

  // ── Handlers ──
  const handleDisconnect = useCallback(async (itemIndex: number) => {
    const item = items[itemIndex];
    const originalItem = order.items[itemIndex];
    if (!item.currentAccount) return;

    try {
      await disconnectAccount({
        sourceAccountId: item.currentAccount.id,
        orderItemId: item.id,
        quantity: originalItem.quantity,
      });
      const newItems = [...items];
      newItems[itemIndex] = { ...newItems[itemIndex], assigned_source_account_id: "", currentAccount: null };
      setItems(newItems);
      queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) });
      appToast.success("Đã gỡ kết nối kho thành công");
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Lỗi gỡ kết nối");
    }
  }, [items, order, disconnectAccount, queryClient]);

  const handleConnect = useCallback(async (itemIndex: number, newSourceAccountId: string) => {
    const item = items[itemIndex];
    const originalItem = order.items[itemIndex];

    try {
      if (item.currentAccount) {
        await disconnectAccount({
          sourceAccountId: item.currentAccount.id,
          orderItemId: item.id,
          quantity: originalItem.quantity,
        });
      }
      await connectAccount({
        sourceAccountId: newSourceAccountId,
        orderItemId: item.id,
        quantity: originalItem.quantity,
      });
      const newAccount = sourceAccounts.find(sa => sa.id === newSourceAccountId);
      const newItems = [...items];
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        assigned_source_account_id: newSourceAccountId,
        currentAccount: newAccount ? { id: newAccount.id, email: newAccount.email, provider: newAccount.provider } : null,
      };
      setItems(newItems);
      queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sourceAccounts });
      appToast.success("Đã kết nối kho mới thành công");
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Lỗi kết nối kho");
    }
  }, [items, order, sourceAccounts, disconnectAccount, connectAccount, queryClient]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> & { id: string } = {
        id: order.id,
        sales_note: salesNote || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      if (createdAt && order.created_at) {
        const newCreatedAt = new Date(createdAt).toISOString();
        if (newCreatedAt !== order.created_at) payload.created_at = newCreatedAt;
      }
      if (unitPrice !== (order.unit_price_vnd ?? 0)) payload.unit_price_vnd = unitPrice;
      if (costPrice !== (order.cost_price_vnd ?? 0)) payload.cost_price_vnd = costPrice;

      const oldUrls = order.proof_image_urls || [];
      const urlsChanged = proofUrls.length !== oldUrls.length || proofUrls.some((u, i) => u !== oldUrls[i]);
      if (urlsChanged) payload.proof_image_urls = proofUrls;

      const changedItems = items.filter(item => {
        const original = order.items.find(i => i.id === item.id);
        if (!original) return false;
        return item.notes !== (original.notes || "") || item.customer_nick_used !== (original.customer_nick_used || "");
      });
      if (changedItems.length > 0) {
        payload.items = changedItems.map(item => ({ id: item.id, notes: item.notes || null, customer_nick_used: item.customer_nick_used || null }));
      }

      await updateOrder(payload);
      appToast.success("Cập nhật đơn hàng thành công");
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Lỗi cập nhật đơn hàng", { showProgress: true });
    }
  };

  const handleToggleItem = useCallback((index: number) => {
    setExpandedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const handleUpdateItemField = useCallback((index: number, field: "notes" | "customer_nick_used", value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const isBusy = isPending || isConnecting || isDisconnecting;

  // ── Footer ──
  const modalFooter = (
    <div className="flex items-center justify-between">
      <p className="text-[11px] text-[var(--fg-muted)]">
        Đơn hàng #{order.id.slice(0, 8)}
      </p>
      <div className="flex gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
          Huỷ bỏ
        </Button>
        <Button
          type="submit"
          form="edit-order-form"
          variant="primary"
          isLoading={isPending}
          disabled={isBusy}
        >
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chỉnh sửa đơn hàng"
      size="3xl"
      footer={modalFooter}
    >
      <form id="edit-order-form" onSubmit={handleUpdate}>
        <EditOrderTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="min-h-[320px]">
          {activeTab === "pricing" ? (
            <EditOrderPricingTab
              unitPrice={unitPrice}
              costPrice={costPrice}
              salesNote={salesNote}
              createdAt={createdAt}
              expiresAt={expiresAt}
              totalAmount={totalAmount}
              totalCost={totalCost}
              profit={profit}
              profitPercent={profitPercent}
              qty={qty}
              setUnitPrice={setUnitPrice}
              setCostPrice={setCostPrice}
              setSalesNote={setSalesNote}
              setCreatedAt={setCreatedAt}
              setExpiresAt={setExpiresAt}
            />
          ) : null}

          {activeTab === "allocation" ? (
            <EditOrderAllocationTab
              orderItems={order.items}
              items={items}
              expandedItems={expandedItems}
              sourceAccounts={sourceAccounts}
              connectedCount={connectedCount}
              totalItemCount={totalItemCount}
              isDisconnecting={isDisconnecting}
              isConnecting={isConnecting}
              onToggleItem={handleToggleItem}
              onDisconnect={handleDisconnect}
              onConnect={handleConnect}
              onUpdateItemField={handleUpdateItemField}
            />
          ) : null}

          {activeTab === "proof" ? (
            <EditOrderProofTab proofUrls={proofUrls} setProofUrls={setProofUrls} />
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
