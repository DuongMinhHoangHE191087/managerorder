"use client";

import {
  AlertTriangle,
  AtSign,
  Bookmark,
  Key,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { FadeIn, ScaleButton } from "@/shared/ui/animations";
import { AddConnectionDialog } from "@/widgets/pages/inventory/components/add-connection-dialog";
import {
  useDisconnectSourceAccount,
  useRecalculateSlots,
  useReconnectSourceAccount,
  useRemoveReservedNick,
  useSourceAccount,
  useSourceAccountConnections,
} from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { INVENTORY_COPY as copy } from "../copy";

export interface ConnectionItem {
  id: string;
  quantity: number;
  product_id: string;
  product_name_snapshot: string;
  customer_nick_used?: string | null;
  orders: {
    id: string;
    customers: {
      full_name: string;
    };
  };
}

type ConnectionCollections = {
  connected: ConnectionItem[];
  unconnected: ConnectionItem[];
};

type ConnectionRowProps = {
  item: ConnectionItem;
  productName: string;
  variant: "connected" | "unconnected";
  isActionDisabled: boolean;
  usedSlots: number;
  maxSlots: number;
  onDisconnectClick: (item: ConnectionItem) => void;
  onReconnectClick: (item: ConnectionItem) => void;
};

type ReservedNickChipProps = {
  nick: string;
  disabled: boolean;
  onRemove: (nick: string) => void;
};

const EMPTY_CONNECTIONS: ConnectionCollections = {
  connected: [],
  unconnected: [],
};

const ITEM_SEPARATOR = "•";

const ConnectionRow = memo(function ConnectionRow({
  item,
  productName,
  variant,
  isActionDisabled,
  usedSlots,
  maxSlots,
  onDisconnectClick,
  onReconnectClick,
}: ConnectionRowProps) {
  const text = copy.page.connections;
  const isConnected = variant === "connected";
  const rowClassName = isConnected
    ? "flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.96)] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors hover:border-[var(--accent)]/30"
    : "flex items-center justify-between gap-3 rounded-[1rem] border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)] p-3 opacity-80 transition-opacity hover:opacity-100";
  const nickBadgeClassName = isConnected
    ? "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10"
    : "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--fg-muted)] bg-[var(--surface-light)]";

  return (
    <FadeIn className={rowClassName}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <User className="size-3.5 text-[var(--accent)]" />
          <span className="truncate text-[13px] font-bold text-[var(--fg-base)]">
            {item.orders.customers.full_name}
          </span>
          {item.customer_nick_used ? (
            <span className={nickBadgeClassName}>
              <Key className="size-3" />
              {item.customer_nick_used}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
          <span>
            {text.orderCodeLabel} {item.orders.id.split("-")[0]}
          </span>
          <span>{ITEM_SEPARATOR}</span>
          <span className="max-w-[150px] truncate">{productName}</span>
          <span>{ITEM_SEPARATOR}</span>
          <span className="font-bold">
            {text.quantityLabel} {item.quantity}
          </span>
        </div>
      </div>

      {isConnected ? (
        <Button
          variant="secondary"
          size="sm"
          title={text.disconnectButton}
          disabled={isActionDisabled}
          className="size-8 shrink-0 rounded-full border-red-200 p-0 text-red-500 shadow-none transition-colors hover:border-red-500 hover:bg-red-500 hover:text-white"
          onClick={() => onDisconnectClick(item)}
        >
          <X className="size-4" />
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          disabled={isActionDisabled || usedSlots + item.quantity > maxSlots}
          className="h-8 border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 text-[11px] text-[var(--accent)] shadow-sm hover:bg-[var(--accent)]/20"
          onClick={() => onReconnectClick(item)}
        >
          <ShieldCheck className="mr-1 size-3" />
          {text.reconnectButton}
        </Button>
      )}
    </FadeIn>
  );
});

const ReservedNickChip = memo(function ReservedNickChip({
  nick,
  disabled,
  onRemove,
}: ReservedNickChipProps) {
  const text = copy.page.connections;

  return (
    <div className="group flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 px-2.5 py-1.5 text-[12px] text-purple-700">
      <AtSign className="size-3 shrink-0 text-purple-400" />
      <span className="font-mono">{nick}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRemove(nick)}
        className="ml-0.5 text-purple-600 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-500"
        title={text.removeNickButton}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
});

type SourceAccountConnectionsProps = {
  sourceAccountId: string;
  maxSlots: number;
  usedSlots: number;
  productMap: Map<string, string>;
};

export const SourceAccountConnections = memo(function SourceAccountConnections({
  sourceAccountId,
  maxSlots,
  usedSlots,
  productMap,
}: SourceAccountConnectionsProps) {
  const { data, isLoading, error } = useSourceAccountConnections(sourceAccountId);
  const { data: sourceAccount } = useSourceAccount(sourceAccountId);
  const { mutateAsync: disconnect, isPending: isDisconnecting } = useDisconnectSourceAccount();
  const { mutateAsync: reconnect, isPending: isReconnecting } = useReconnectSourceAccount();
  const { mutateAsync: removeNick, isPending: isRemovingNick } = useRemoveReservedNick();
  const { mutateAsync: recalcSlots, isPending: isSyncing } = useRecalculateSlots();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState<ConnectionItem | null>(null);
  const text = copy.page.connections;
  const slotText = copy.page.slotBreakdown;

  const reservedNicks: string[] = sourceAccount?.reservedNicks ?? [];

  const handleDisconnect = useCallback(
    async (orderItemId: string, quantity: number) => {
      try {
        await disconnect({ sourceAccountId, orderItemId, quantity });
        appToast.success(text.disconnected);
      } catch (err: unknown) {
        appToast.error(err instanceof Error ? err.message : text.disconnectError);
      }
    },
    [disconnect, sourceAccountId, text],
  );

  const handleDisconnectClick = useCallback(
    (item: ConnectionItem) => {
      setDisconnectConfirm(item);
    },
    [],
  );

  const handleConfirmDisconnect = useCallback(
    async () => {
      if (!disconnectConfirm) return;
      await handleDisconnect(disconnectConfirm.id, disconnectConfirm.quantity);
      setDisconnectConfirm(null);
    },
    [disconnectConfirm, handleDisconnect],
  );

  const handleReconnect = useCallback(
    async (item: ConnectionItem) => {
      if (usedSlots + item.quantity > maxSlots) {
        appToast.error(text.noEnoughSlots);
        return;
      }

      try {
        await reconnect({ sourceAccountId, orderItemId: item.id, quantity: item.quantity });
        appToast.success(text.reconnectSuccess);
      } catch (err: unknown) {
        appToast.error(err instanceof Error ? err.message : text.reconnectError);
      }
    },
    [maxSlots, reconnect, sourceAccountId, text, usedSlots],
  );

  const handleRemoveReservedNick = useCallback(
    async (nick: string) => {
      try {
        await removeNick({ sourceAccountId, nick });
        appToast.success(text.removedNick(nick));
      } catch (err: unknown) {
        appToast.error(err instanceof Error ? err.message : text.removeNickError);
      }
    },
    [removeNick, sourceAccountId, text],
  );

  const handleSyncSlots = useCallback(async () => {
    try {
      const result = await recalcSlots(sourceAccountId);

      if (result.changed) {
        appToast.success(text.syncSuccess(String(result.previous), String(result.recalculated)));
        return;
      }

      appToast.info(text.syncExact);
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : text.syncError);
    }
  }, [recalcSlots, sourceAccountId, text]);

  const connectionCollections = (data as ConnectionCollections | undefined) ?? EMPTY_CONNECTIONS;
  const connectedSlots = useMemo(
    () => connectionCollections.connected.reduce((sum, item) => sum + item.quantity, 0),
    [connectionCollections.connected],
  );
  const reservedCount = reservedNicks.length;
  const freeSlots = Math.max(0, maxSlots - usedSlots);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 text-[var(--fg-muted)]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
        {text.error}
      </div>
    );
  }

  const { connected, unconnected } = connectionCollections;

  return (
    <div className="space-y-6">
      {disconnectConfirm ? (
        <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: "var(--z-modal)" }}>
          <button
            type="button"
            aria-label="Đóng xác nhận ngắt kết nối"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!isDisconnecting) setDisconnectConfirm(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="source-account-disconnect-title"
            className="relative w-full max-w-md rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <AlertTriangle aria-hidden="true" className="size-5" />
              </div>
              <div>
                <h2 id="source-account-disconnect-title" className="text-base font-black text-[var(--fg-base)]">
                  Xác nhận ngắt kết nối
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--fg-muted)]">
                  {text.confirmDisconnect(disconnectConfirm.orders.id.split("-")[0])}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisconnectConfirm(null)}
                disabled={isDisconnecting}
                className="rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm font-bold text-[var(--fg-base)] transition-[background-color,opacity] hover:bg-[var(--surface-light)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDisconnect()}
                disabled={isDisconnecting}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition-[background-color,opacity] hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDisconnecting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                Ngắt kết nối
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/70 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {text.breakdownTitle}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncSlots}
              disabled={isSyncing}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-[var(--fg-muted)] transition-colors hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] disabled:opacity-50"
              title={text.syncTooltip}
            >
              <RefreshCw className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
              {text.syncButton}
            </button>
            <span className="text-[12px] font-black text-[var(--fg-base)]">
              {usedSlots} / {maxSlots}
            </span>
          </div>
        </div>

        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
          <div className="flex h-full">
            {connectedSlots > 0 ? (
              <div
                className="h-full bg-[var(--accent)]"
                style={{ width: `${(connectedSlots / maxSlots) * 100}%` }}
              />
            ) : null}
            {reservedCount > 0 ? (
              <div
                className="h-full bg-purple-400"
                style={{ width: `${(reservedCount / maxSlots) * 100}%` }}
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-[var(--accent)]" />
            <span className="text-[var(--fg-muted)]">
              {slotText.connections}: <strong className="text-[var(--fg-base)]">{connectedSlots}</strong>
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-purple-400" />
            <span className="text-[var(--fg-muted)]">
              {slotText.reserved}: <strong className="text-[var(--fg-base)]">{reservedCount}</strong>
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-gray-300" />
            <span className="text-[var(--fg-muted)]">
              {slotText.free}: <strong className="text-[var(--fg-base)]">{freeSlots}</strong>
            </span>
          </span>
        </div>
      </div>

      {showAddDialog ? (
        <AddConnectionDialog
          sourceAccountId={sourceAccountId}
          maxSlots={maxSlots}
          usedSlots={usedSlots}
          onClose={() => setShowAddDialog(false)}
        />
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--accent)]">
            <Link2 className="size-4" />
            {text.connectedTitle(connected.length)}
          </h4>
          <ScaleButton
            className="flex items-center gap-1 rounded-lg bg-[var(--accent)]/10 px-2.5 py-1.5 text-[11px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="size-3" />
            {text.addConnection}
          </ScaleButton>
        </div>
        {connected.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-soft)] bg-gray-50 py-4 text-center text-[12px] text-[var(--fg-muted)]">
            {text.emptyConnected}
          </p>
        ) : (
          <div className="space-y-2">
            {connected.map((item) => (
              <ConnectionRow
                key={item.id}
                item={item}
                productName={productMap.get(item.product_id) || item.product_name_snapshot}
                variant="connected"
                isActionDisabled={isDisconnecting || isReconnecting}
                usedSlots={usedSlots}
                maxSlots={maxSlots}
                onDisconnectClick={handleDisconnectClick}
                onReconnectClick={handleReconnect}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="mt-6 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
          <AlertTriangle className="size-4" />
          {text.waitingTitle(unconnected.length)}
        </h4>
        {unconnected.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-soft)] bg-gray-50 py-4 text-center text-[12px] text-[var(--fg-muted)]">
            {text.waitingEmpty}
          </p>
        ) : (
          <div className="space-y-2">
            {unconnected.map((item) => (
              <ConnectionRow
                key={item.id}
                item={item}
                productName={productMap.get(item.product_id) || item.product_name_snapshot}
                variant="unconnected"
                isActionDisabled={isDisconnecting || isReconnecting}
                usedSlots={usedSlots}
                maxSlots={maxSlots}
                onDisconnectClick={handleDisconnectClick}
                onReconnectClick={handleReconnect}
              />
            ))}
          </div>
        )}
      </div>

      {reservedNicks.length > 0 ? (
        <div className="space-y-3">
          <h4 className="mt-6 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-purple-400/80">
            <Bookmark className="size-4" />
            {text.reservedSectionTitle(reservedNicks.length)}
          </h4>
          <div className="flex flex-wrap gap-2">
            {reservedNicks.map((nick) => (
              <ReservedNickChip
                key={nick}
                nick={nick}
                disabled={isRemovingNick}
                onRemove={handleRemoveReservedNick}
              />
            ))}
          </div>
          <p className="text-[10px] italic text-slate-600">{text.reservedHint}</p>
        </div>
      ) : null}
    </div>
  );
});
