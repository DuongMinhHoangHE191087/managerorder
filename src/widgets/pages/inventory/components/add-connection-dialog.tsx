"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Loader2, Link2, Plus, X, User, ShoppingBag,
  List, AtSign, CheckCircle, AlertCircle, Bookmark, Trash2,
  Users, AlertTriangle,
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { useConnectSourceAccount, useSourceAccount, useAddReservedNick, useRemoveReservedNick } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { fetcher } from "@/lib/api/fetcher";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

interface OrderItemOption {
  id: string;
  quantity: number;
  product_id: string;
  product_name_snapshot: string;
  notes?: string | null;
  customer_nick_used?: string | null;
  orders: {
    id: string;
    customers: { full_name: string; nicks_registry?: Record<string, unknown>[] };
  };
}

interface AddConnectionDialogProps {
  sourceAccountId: string;
  maxSlots: number;
  usedSlots: number;
  onClose: () => void;
}

type TabType = "pending" | "nick_search" | "customer_search" | "reserve_nick";

export function AddConnectionDialog({
  sourceAccountId, maxSlots, usedSlots, onClose,
}: AddConnectionDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderItemOption[]>([]);
  const [nickResults, setNickResults] = useState<OrderItemOption[]>([]);
  const [customerResults, setCustomerResults] = useState<OrderItemOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNickLoading, setIsNickLoading] = useState(false);
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [confirmItem, setConfirmItem] = useState<OrderItemOption | null>(null);

  // Reserved nick tab state
  const [reserveInput, setReserveInput] = useState("");
  const { data: sourceAccount, isLoading: isLoadingSA } = useSourceAccount(sourceAccountId);
  const { mutateAsync: addNick, isPending: isAdding } = useAddReservedNick();
  const { mutateAsync: removeNick, isPending: isRemoving } = useRemoveReservedNick();

  const reservedNicks: string[] = sourceAccount?.reservedNicks ?? [];

  const { mutateAsync: connect, isPending: isConnecting } = useConnectSourceAccount();
  const availableSlots = maxSlots - usedSlots;

  // ── Tab 1: Pending orders ──────────────────────────────────────
  const loadPending = useCallback(async (search: string) => {
    setIsLoading(true);
    try {
      const res = await fetcher<{ connected: OrderItemOption[]; unconnected: OrderItemOption[] }>(
        `/api/source-accounts/${sourceAccountId}/connections`
      );
      const items = res.unconnected ?? [];
      if (search.trim()) {
        const q = search.toLowerCase();
        setResults(
          items.filter((i) =>
            i.orders?.customers?.full_name?.toLowerCase().includes(q) ||
            i.orders?.id?.toLowerCase().includes(q) ||
            i.product_name_snapshot?.toLowerCase().includes(q)
          )
        );
      } else {
        setResults(items);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [sourceAccountId]);

  // ── Tab 2: Nick / Note smart search ───────────────────────────
  const searchByNick = useCallback(async (q: string) => {
    if (!q.trim()) { setNickResults([]); return; }
    setIsNickLoading(true);
    try {
      const params = new URLSearchParams({ q });
      const res = await fetcher<OrderItemOption[]>(
        `/api/source-accounts/${sourceAccountId}/connections/search?${params}`
      );
      setNickResults(res ?? []);
    } catch {
      setNickResults([]);
    } finally {
      setIsNickLoading(false);
    }
  }, [sourceAccountId]);

  // ── Tab 3: Customer search ────────────────────────────────────
  const searchByCustomer = useCallback(async (q: string) => {
    if (!q.trim()) { setCustomerResults([]); return; }
    setIsCustomerLoading(true);
    try {
      const params = new URLSearchParams({ q, type: "customer" });
      const res = await fetcher<OrderItemOption[]>(
        `/api/source-accounts/${sourceAccountId}/connections/search?${params}`
      );
      setCustomerResults(res ?? []);
    } catch {
      setCustomerResults([]);
    } finally {
      setIsCustomerLoading(false);
    }
  }, [sourceAccountId]);

  // Debounce pending load
  useEffect(() => {
    if (activeTab !== "pending") return;
    const t = setTimeout(() => loadPending(query), 300);
    return () => clearTimeout(t);
  }, [query, activeTab, loadPending]);

  // Debounce nick search
  useEffect(() => {
    if (activeTab !== "nick_search") return;
    const t = setTimeout(() => searchByNick(query), 350);
    return () => clearTimeout(t);
  }, [query, activeTab, searchByNick]);

  // Debounce customer search
  useEffect(() => {
    if (activeTab !== "customer_search") return;
    const t = setTimeout(() => searchByCustomer(query), 350);
    return () => clearTimeout(t);
  }, [query, activeTab, searchByCustomer]);

  // Reset when tab switches
  useEffect(() => {
    setQuery("");
    setResults([]);
    setNickResults([]);
    setCustomerResults([]);
    setConfirmItem(null);
    setReserveInput("");
    if (activeTab === "pending") loadPending("");
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load pending on mount
  useEffect(() => { loadPending(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connect handler ────────────────────────────────────────────
  const handleConnect = async (item: OrderItemOption) => {
    if (item.quantity > availableSlots) {
      appToast.error(`Không đủ slot. Cần ${item.quantity}, còn ${availableSlots} trống.`);
      return;
    }
    try {
      await connect({ sourceAccountId, orderItemId: item.id, quantity: item.quantity });
      appToast.success(`Đã kết nối thành công với đơn của "${item.orders.customers.full_name}"!`);
      setConfirmItem(null);
      // Refresh active tab
      if (activeTab === "pending") await loadPending(query);
      if (activeTab === "nick_search") await searchByNick(query);
      if (activeTab === "customer_search") await searchByCustomer(query);
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Kết nối thất bại");
    }
  };

  // ── Reserved nick handlers ─────────────────────────────────────
  const handleAddNick = async () => {
    const nick = reserveInput.trim();
    if (!nick) return;
    try {
      await addNick({ sourceAccountId, nick });
      appToast.success(`Đã đặt trước nick "${nick}"`);
      setReserveInput("");
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Lỗi khi đặt trước nick");
    }
  };

  const handleRemoveNick = async (nick: string) => {
    try {
      await removeNick({ sourceAccountId, nick });
      appToast.success(`Đã xóa nick "${nick}" khỏi danh sách đặt trước`);
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : "Lỗi khi xóa nick");
    }
  };

  const displayItems = activeTab === "pending" ? results : activeTab === "nick_search" ? nickResults : customerResults;
  const isSearching = activeTab === "pending" ? isLoading : activeTab === "nick_search" ? isNickLoading : isCustomerLoading;

  // Conflict detection: warn if item quantity would exceed available slots
  const hasSlotConflict = (item: OrderItemOption) => item.quantity > availableSlots;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-xl bg-[#0d1a30] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <Link2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-100">Thêm kết nối thủ công</h3>
              <p className="text-[11px] text-slate-500">
                Còn <span className={cn("font-bold", availableSlots > 0 ? "text-indigo-400" : "text-red-400")}>{availableSlots}</span>/{maxSlots} slot trống
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slot warning */}
        {availableSlots <= 0 && (
          <div className="mx-5 mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-[11px] text-red-300">Tài khoản đã hết slot trống. Bạn cần tăng sức chứa hoặc ngắt kết nối trước khi thêm mới.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {([
            { key: "pending", label: "Đơn chờ", icon: List },
            { key: "nick_search", label: "Tìm Nick", icon: AtSign },
            { key: "customer_search", label: "Tìm KH", icon: Users },
            { key: "reserve_nick", label: "Đặt trước", icon: Bookmark },
          ] as { key: TabType; label: string; icon: React.ElementType }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold py-2.5 transition-colors border-b-2 -mb-px",
                activeTab === tab.key
                  ? tab.key === "reserve_nick"
                    ? "border-purple-500 text-purple-400"
                    : tab.key === "customer_search"
                    ? "border-emerald-500 text-emerald-400"
                    : "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab 4: Reserve Nick ─────────────────────────────── */}
        {activeTab === "reserve_nick" ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
            {/* Input */}
            <div>
              <p className="text-[11px] text-slate-400 mb-2">
                Nhập nick/username của khách để <span className="text-purple-400 font-semibold">đặt trước</span>.
                Smart Match sẽ tự khớp khi đơn hàng được tạo sau này.
              </p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={reserveInput}
                  onChange={(e) => setReserveInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNick()}
                  placeholder="Ví dụ: duolingo_username_123"
                  className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors"
                />
                <Button
                  size="sm"
                  disabled={isAdding || !reserveInput.trim()}
                  onClick={handleAddNick}
                  className="h-9 px-3 bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30 shadow-none"
                >
                  {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                  Lưu
                </Button>
              </div>
            </div>

            {/* List */}
            <div>
              <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wide mb-2">
                Đã đặt trước ({isLoadingSA ? "…" : reservedNicks.length})
              </p>
              {isLoadingSA ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
                </div>
              ) : reservedNicks.length === 0 ? (
                <div className="text-center py-8">
                  <Bookmark className="w-9 h-9 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Chưa có nick nào được đặt trước</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {reservedNicks.map((nick) => (
                    <div
                      key={nick}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg group"
                    >
                      <div className="flex items-center gap-2">
                        <AtSign className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="text-sm font-mono text-purple-200">{nick}</span>
                      </div>
                      <button
                        disabled={isRemoving}
                        onClick={() => handleRemoveNick(nick)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Xóa nick đặt trước"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Search input (Tab 1, 2, 3) */}
            <div className="px-5 py-3 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    activeTab === "pending"
                      ? "Tìm theo tên khách, mã đơn, sản phẩm..."
                      : activeTab === "nick_search"
                      ? "Nhập username, nickname, hoặc ghi chú bạn nhớ..."
                      : "Tìm theo tên khách hàng..."
                  }
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                )}
              </div>
              {activeTab === "nick_search" && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Hệ thống sẽ so khớp với <span className="text-indigo-400">nick đã dùng</span>, <span className="text-indigo-400">ghi chú đơn hàng</span> và <span className="text-indigo-400">danh bạ nick khách</span> — chỉ hiện đơn chưa kết nối cùng loại sản phẩm.
                </p>
              )}
              {activeTab === "customer_search" && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Tìm đơn hàng chưa kết nối theo <span className="text-emerald-400">tên khách hàng</span> — kết quả chỉ hiện đơn cùng loại sản phẩm.
                </p>
              )}
            </div>

            {/* Confirm suggestion overlay */}
            {confirmItem && (
              <div className="mx-5 my-3 bg-indigo-900/30 border border-indigo-500/40 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-slate-200">
                    <span className="font-bold text-indigo-300">Xác nhận kết nối?</span>
                    <p className="mt-1 text-[12px] text-slate-400">
                      Kết nối đơn hàng của <span className="text-slate-200 font-semibold">{confirmItem.orders.customers.full_name}</span>
                      {confirmItem.customer_nick_used && (
                        <> (<span className="text-indigo-300">@{confirmItem.customer_nick_used}</span>)</>
                      )} — {confirmItem.product_name_snapshot} (SL: {confirmItem.quantity}) vào kho này?
                    </p>
                    {hasSlotConflict(confirmItem) && (
                      <p className="mt-1.5 text-[11px] text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Cảnh báo: Cần {confirmItem.quantity} slot nhưng chỉ còn {availableSlots} trống!
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setConfirmItem(null)}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
                    Bỏ qua
                  </button>
                  <Button
                    size="sm"
                    disabled={isConnecting || hasSlotConflict(confirmItem)}
                    onClick={() => handleConnect(confirmItem)}
                    className="text-[12px] h-8 px-3 bg-indigo-500 text-white hover:bg-indigo-600 border-indigo-600 shadow-none"
                  >
                    {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                    Xác nhận kết nối
                  </Button>
                </div>
              </div>
            )}

            {/* Results list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
              {!isSearching && displayItems.length === 0 && (
                <div className="text-center py-10">
                  <ShoppingBag className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">
                    {(activeTab === "nick_search" || activeTab === "customer_search") && !query.trim()
                      ? activeTab === "customer_search" ? "Nhập tên khách hàng để tìm kiếm" : "Nhập nick hoặc ghi chú để tìm kiếm"
                      : query
                      ? "Không tìm thấy kết quả phù hợp"
                      : "Không có đơn hàng nào đang chờ kết nối"}
                  </p>
                </div>
              )}

              {displayItems.map((item) => {
                const canConnect = item.quantity <= availableSlots;
                const isConfirming = confirmItem?.id === item.id;
                const showConflict = !canConnect && item.quantity > 0;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all",
                      canConnect
                        ? isConfirming
                          ? "bg-indigo-900/20 border-indigo-500/40"
                          : "bg-slate-800/30 border-slate-700/50 hover:border-indigo-500/30"
                        : "bg-slate-800/20 border-slate-800/50 opacity-60"
                    )}
                  >
                    <div className="flex-none w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-200 truncate">
                        {item.orders?.customers?.full_name || "Không rõ khách"}
                        {item.customer_nick_used && (
                          <span className="ml-2 text-[11px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            @{item.customer_nick_used}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                        <span>#{item.orders?.id?.split("-")[0]}</span>
                        <span>•</span>
                        <span className="truncate max-w-[160px]">{item.product_name_snapshot}</span>
                        <span>•</span>
                        <span className="font-bold text-slate-400">SL: {item.quantity}</span>
                        {item.notes && (
                          <>
                            <span>•</span>
                            <span className="text-amber-500/80 italic truncate max-w-[140px]">&quot;{item.notes}&quot;</span>
                          </>
                        )}
                      </div>
                      {showConflict && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          Cần {item.quantity} slot, còn {availableSlots} trống
                        </div>
                      )}
                    </div>

                    {activeTab === "nick_search" || activeTab === "customer_search" ? (
                      // Nick/Customer search: show confirm step
                      <Button
                        size="sm"
                        disabled={!canConnect || isConnecting}
                        onClick={() => setConfirmItem(isConfirming ? null : item)}
                        title={!canConnect ? `Cần ${item.quantity} slot, còn ${availableSlots}` : "Gợi ý kết nối"}
                        className={cn(
                          "shrink-0 text-[11px] h-8 px-3 shadow-none",
                          isConfirming
                            ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                            : "bg-slate-700/50 text-slate-300 border-slate-600/40 hover:bg-indigo-500/20 hover:text-indigo-400"
                        )}
                      >
                        {isConfirming ? "Đang xác nhận..." : "Gợi ý ✓"}
                      </Button>
                    ) : (
                      // Pending tab: connect directly
                      <Button
                        size="sm"
                        disabled={isConnecting || !canConnect}
                        onClick={() => handleConnect(item)}
                        title={!canConnect ? `Cần ${item.quantity} slot, còn ${availableSlots}` : "Kết nối"}
                        className="shrink-0 text-[11px] h-8 px-3 bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30 disabled:opacity-40 shadow-none"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Kết nối
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-between items-center">
          <span className="text-[11px] text-slate-600">
            {activeTab !== "reserve_nick" && displayItems.length > 0 && `${displayItems.length} kết quả`}
            {activeTab === "reserve_nick" && reservedNicks.length > 0 && `${reservedNicks.length} nick đặt trước`}
          </span>
          <button onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
