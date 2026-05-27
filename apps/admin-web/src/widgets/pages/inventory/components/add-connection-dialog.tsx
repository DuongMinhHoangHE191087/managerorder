"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  AtSign,
  Bookmark,
  CheckCircle,
  Link2,
  List,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { fetcher } from "@/lib/api/fetcher";
import { cn } from "@/lib/utils";
import { useAddReservedNick, useConnectSourceAccount, useRemoveReservedNick, useSourceAccount } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { INVENTORY_COPY as copy } from "../copy";

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
  sourceAccountId,
  maxSlots,
  usedSlots,
  onClose,
}: AddConnectionDialogProps) {
  const connectionText = copy.addConnectionDialog;
  const connectionUi = copy.addConnectionDialogUi;
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderItemOption[]>([]);
  const [nickResults, setNickResults] = useState<OrderItemOption[]>([]);
  const [customerResults, setCustomerResults] = useState<OrderItemOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNickLoading, setIsNickLoading] = useState(false);
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [confirmItem, setConfirmItem] = useState<OrderItemOption | null>(null);
  const [reserveInput, setReserveInput] = useState("");

  const { data: sourceAccount, isLoading: isLoadingSourceAccount } = useSourceAccount(sourceAccountId);
  const { mutateAsync: addNick, isPending: isAdding } = useAddReservedNick();
  const { mutateAsync: removeNick, isPending: isRemoving } = useRemoveReservedNick();
  const { mutateAsync: connect, isPending: isConnecting } = useConnectSourceAccount();

  const reservedNicks: string[] = sourceAccount?.reservedNicks ?? [];
  const availableSlots = maxSlots - usedSlots;

  const loadPending = useCallback(async (search: string) => {
    setIsLoading(true);
    try {
      const response = await fetcher<{ connected: OrderItemOption[]; unconnected: OrderItemOption[] }>(
        `/api/source-accounts/${sourceAccountId}/connections`,
      );
      const items = response.unconnected ?? [];
      if (!search.trim()) {
        setResults(items);
        return;
      }

      const normalized = search.toLowerCase();
      setResults(
        items.filter((item) =>
          item.orders?.customers?.full_name?.toLowerCase().includes(normalized) ||
          item.orders?.id?.toLowerCase().includes(normalized) ||
          item.product_name_snapshot?.toLowerCase().includes(normalized),
        ),
      );
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [sourceAccountId]);

  const searchConnections = useCallback(async (search: string, type: "nick" | "customer") => {
    if (!search.trim()) {
      if (type === "nick") {
        setNickResults([]);
      } else {
        setCustomerResults([]);
      }
      return;
    }

    if (type === "nick") {
      setIsNickLoading(true);
    } else {
      setIsCustomerLoading(true);
    }

    try {
      const params = new URLSearchParams(type === "nick" ? { q: search } : { q: search, type: "customer" });
      const response = await fetcher<OrderItemOption[]>(
        `/api/source-accounts/${sourceAccountId}/connections/search?${params.toString()}`,
      );
      if (type === "nick") {
        setNickResults(response ?? []);
      } else {
        setCustomerResults(response ?? []);
      }
    } catch {
      if (type === "nick") {
        setNickResults([]);
      } else {
        setCustomerResults([]);
      }
    } finally {
      if (type === "nick") {
        setIsNickLoading(false);
      } else {
        setIsCustomerLoading(false);
      }
    }
  }, [sourceAccountId]);

  useEffect(() => {
    if (activeTab !== "pending") {
      return;
    }
    const timer = setTimeout(() => loadPending(query), 300);
    return () => clearTimeout(timer);
  }, [activeTab, loadPending, query]);

  useEffect(() => {
    if (activeTab !== "nick_search") {
      return;
    }
    const timer = setTimeout(() => searchConnections(query, "nick"), 350);
    return () => clearTimeout(timer);
  }, [activeTab, query, searchConnections]);

  useEffect(() => {
    if (activeTab !== "customer_search") {
      return;
    }
    const timer = setTimeout(() => searchConnections(query, "customer"), 350);
    return () => clearTimeout(timer);
  }, [activeTab, query, searchConnections]);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setNickResults([]);
    setCustomerResults([]);
    setConfirmItem(null);
    setReserveInput("");
    if (activeTab === "pending") {
      void loadPending("");
    }
  }, [activeTab, loadPending]);

  useEffect(() => {
    void loadPending("");
  }, [loadPending]);

  const handleConnect = useCallback(async (item: OrderItemOption) => {
    if (item.quantity > availableSlots) {
      appToast.error(connectionText.unavailableSlots(item.quantity, availableSlots));
      return;
    }

    try {
      await connect({ sourceAccountId, orderItemId: item.id, quantity: item.quantity });
      appToast.success(connectionText.connectSuccess(item.orders.customers.full_name));
      setConfirmItem(null);

      if (activeTab === "pending") {
        await loadPending(query);
      } else if (activeTab === "nick_search") {
        await searchConnections(query, "nick");
      } else if (activeTab === "customer_search") {
        await searchConnections(query, "customer");
      }
    } catch (error: unknown) {
      appToast.error(error instanceof Error ? error.message : connectionText.connectError);
    }
  }, [activeTab, availableSlots, connect, connectionText, loadPending, query, searchConnections, sourceAccountId]);

  const handleAddNick = useCallback(async () => {
    const nick = reserveInput.trim();
    if (!nick) {
      return;
    }

    try {
      await addNick({ sourceAccountId, nick });
      appToast.success(connectionText.reserveSuccess(nick));
      setReserveInput("");
    } catch (error: unknown) {
      appToast.error(error instanceof Error ? error.message : connectionText.reserveError);
    }
  }, [addNick, connectionText, reserveInput, sourceAccountId]);

  const handleRemoveNick = useCallback(async (nick: string) => {
    try {
      await removeNick({ sourceAccountId, nick });
      appToast.success(connectionText.removeReserveSuccess(nick));
    } catch (error: unknown) {
      appToast.error(error instanceof Error ? error.message : connectionText.removeReserveError);
    }
  }, [connectionText, removeNick, sourceAccountId]);

  const displayItems =
    activeTab === "pending" ? results :
    activeTab === "nick_search" ? nickResults :
    customerResults;

  const isSearching =
    activeTab === "pending" ? isLoading :
    activeTab === "nick_search" ? isNickLoading :
    isCustomerLoading;

  const hasSlotConflict = (item: OrderItemOption) => item.quantity > availableSlots;

  const tabs: Array<{ key: TabType; label: string; icon: React.ElementType }> = [
    { key: "pending", label: connectionText.tabs.pending, icon: List },
    { key: "nick_search", label: connectionText.tabs.nickSearch, icon: AtSign },
    { key: "customer_search", label: connectionText.tabs.customerSearch, icon: Users },
    { key: "reserve_nick", label: connectionText.tabs.reserveNick, icon: Bookmark },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-slate-700/60 bg-[#0d1a30] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20">
              <Link2 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-100">{connectionText.title}</h3>
              <p className="text-[11px] text-slate-500">{connectionText.slotsLeft(availableSlots, maxSlots)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {availableSlots <= 0 ? (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="text-[11px] text-red-300">{connectionText.slotWarning}</p>
          </div>
        ) : null}

        <div className="flex border-b border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[11px] font-semibold transition-colors",
                activeTab === tab.key
                  ? tab.key === "reserve_nick"
                    ? "border-purple-500 text-purple-400"
                    : tab.key === "customer_search"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-300",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "reserve_nick" ? (
          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <p className="mb-2 text-[11px] text-slate-400">{connectionText.reserveHint}</p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={reserveInput}
                  onChange={(event) => setReserveInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleAddNick()}
                  placeholder={connectionText.reservePlaceholder}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 transition-colors placeholder:text-slate-500 focus:border-purple-500/60 focus:outline-none"
                />
                <Button
                  size="sm"
                  disabled={isAdding || !reserveInput.trim()}
                  onClick={() => void handleAddNick()}
                  className="h-9 border-purple-500/40 bg-purple-500/20 px-3 text-purple-300 shadow-none hover:bg-purple-500/30"
                >
                  {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                  {connectionText.save}
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {connectionText.reservedCount(isLoadingSourceAccount ? 0 : reservedNicks.length)}
              </p>
              {isLoadingSourceAccount ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                </div>
              ) : reservedNicks.length === 0 ? (
                <div className="py-8 text-center">
                  <Bookmark className="mx-auto mb-2 h-9 w-9 text-slate-700" />
                  <p className="text-sm text-slate-500">{connectionText.noReservedNicks}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {reservedNicks.map((nick) => (
                    <div
                      key={nick}
                      className="group flex items-center justify-between gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <AtSign className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                        <span className="font-mono text-sm text-purple-200">{nick}</span>
                      </div>
                      <button
                        type="button"
                        disabled={isRemoving}
                        onClick={() => void handleRemoveNick(nick)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                        title={connectionText.deleteReservedNick}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-800 px-5 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeTab === "pending"
                      ? connectionText.searchPlaceholder.pending
                      : activeTab === "nick_search"
                        ? connectionText.searchPlaceholder.nickSearch
                        : connectionText.searchPlaceholder.customerSearch
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-9 pr-3 text-sm text-slate-200 transition-colors placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none"
                />
                {isSearching ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-400" />
                ) : null}
              </div>
              {activeTab === "nick_search" ? (
                <p className="mt-1.5 text-[11px] text-slate-500">{connectionText.nickHint}</p>
              ) : null}
              {activeTab === "customer_search" ? (
                <p className="mt-1.5 text-[11px] text-slate-500">{connectionText.customerHint}</p>
              ) : null}
            </div>

            {confirmItem ? (
              <div className="mx-5 my-3 flex flex-col gap-3 rounded-xl border border-indigo-500/40 bg-indigo-900/30 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                  <div className="text-sm text-slate-200">
                    <span className="font-bold text-indigo-300">{connectionText.confirmTitle}</span>
                    <p className="mt-1 text-[12px] text-slate-400">
                      {connectionText.confirmDescription(
                        confirmItem.orders.customers.full_name,
                        confirmItem.product_name_snapshot,
                        confirmItem.quantity,
                        confirmItem.customer_nick_used ?? undefined,
                      )}
                    </p>
                    {hasSlotConflict(confirmItem) ? (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        {connectionText.slotConflict(confirmItem.quantity, availableSlots)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmItem(null)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-[12px] text-slate-400 transition-colors hover:text-slate-200"
                  >
                    {connectionText.cancel}
                  </button>
                  <Button
                    size="sm"
                    disabled={isConnecting || hasSlotConflict(confirmItem)}
                    onClick={() => void handleConnect(confirmItem)}
                    className="h-8 border-indigo-600 bg-indigo-500 px-3 text-[12px] text-white shadow-none hover:bg-indigo-600"
                  >
                    {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1 h-3.5 w-3.5" />}
                    {connectionText.confirm}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {!isSearching && displayItems.length === 0 ? (
                <div className="py-10 text-center">
                  <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-slate-700" />
                  <p className="text-sm text-slate-500">
                    {(activeTab === "nick_search" || activeTab === "customer_search") && !query.trim()
                      ? activeTab === "customer_search"
                        ? connectionText.searchPlaceholder.customerSearch
                        : connectionText.searchPlaceholder.nickSearch
                      : query
                        ? connectionText.emptyState.search
                        : connectionText.emptyState.pending}
                  </p>
                </div>
              ) : null}

              {displayItems.map((item) => {
                const canConnect = item.quantity <= availableSlots;
                const isConfirming = confirmItem?.id === item.id;
                const showConflict = !canConnect && item.quantity > 0;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition-[background-color,border-color,box-shadow,color,opacity,transform,width]",
                      canConnect
                        ? isConfirming
                          ? "border-indigo-500/40 bg-indigo-900/20"
                          : "border-slate-700/50 bg-slate-800/30 hover:border-indigo-500/30"
                        : "border-slate-800/50 bg-slate-800/20 opacity-60",
                    )}
                  >
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-700/50">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-200">
                        {item.orders?.customers?.full_name || connectionText.unknownCustomer}
                        {item.customer_nick_used ? (
                          <span className="ml-2 rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[11px] text-indigo-400">
                            @{item.customer_nick_used}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>#{item.orders?.id?.split("-")[0]}</span>
                        <span>{connectionUi.separator}</span>
                        <span className="max-w-[160px] truncate">{item.product_name_snapshot}</span>
                        <span>{connectionUi.separator}</span>
                        <span className="font-bold text-slate-400">{connectionUi.quantityShort(item.quantity)}</span>
                        {item.notes ? (
                          <>
                            <span>{connectionUi.separator}</span>
                            <span className="max-w-[140px] truncate italic text-amber-500/80">&quot;{item.notes}&quot;</span>
                          </>
                        ) : null}
                      </div>
                      {showConflict ? (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          {connectionText.slotConflict(item.quantity, availableSlots)}
                        </div>
                      ) : null}
                    </div>

                    {activeTab === "nick_search" || activeTab === "customer_search" ? (
                      <Button
                        size="sm"
                        disabled={!canConnect || isConnecting}
                        onClick={() => setConfirmItem(isConfirming ? null : item)}
                        title={!canConnect ? connectionText.slotConflictShort(item.quantity, availableSlots) : connectionText.suggestConnection}
                        className={cn(
                          "h-8 shrink-0 px-3 text-[11px] shadow-none",
                          isConfirming
                            ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-400"
                            : "border-slate-600/40 bg-slate-700/50 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-400",
                        )}
                      >
                        {isConfirming ? connectionText.confirming : connectionText.suggested}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isConnecting || !canConnect}
                        onClick={() => void handleConnect(item)}
                        title={!canConnect ? connectionText.slotConflictShort(item.quantity, availableSlots) : connectionText.connect}
                        className="h-8 shrink-0 border-indigo-500/30 bg-indigo-500/20 px-3 text-[11px] text-indigo-400 shadow-none hover:bg-indigo-500/30 disabled:opacity-40"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        {connectionText.connect}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <span className="text-[11px] text-slate-600">
            {activeTab !== "reserve_nick" && displayItems.length > 0 ? `${displayItems.length} ${connectionText.results}` : null}
            {activeTab === "reserve_nick" && reservedNicks.length > 0 ? `${reservedNicks.length} ${connectionText.reservedNickCount}` : null}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 transition-colors hover:text-slate-200"
          >
            {connectionText.close}
          </button>
        </div>
      </div>
    </div>
  );
}
