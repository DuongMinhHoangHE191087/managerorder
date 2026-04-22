import { useSourceAccountConnections, useDisconnectSourceAccount, useReconnectSourceAccount, useSourceAccount, useRemoveReservedNick, useRecalculateSlots } from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { Loader2, Link2, User, Key, AlertTriangle, ShieldCheck, X, Plus, Bookmark, AtSign, Trash2, RefreshCw } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { FadeIn, ScaleButton } from "@/shared/ui/animations";
import { AddConnectionDialog } from "@/widgets/pages/inventory/components/add-connection-dialog";
import { vi } from "@/shared/messages/vi";
import { useState } from "react";

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

export function SourceAccountConnections({ 
  sourceAccountId, 
  maxSlots, 
  usedSlots, 
  productMap 
}: { 
  sourceAccountId: string; 
  maxSlots: number; 
  usedSlots: number; 
  productMap: Map<string, string> 
}) {
  const { data, isLoading, error } = useSourceAccountConnections(sourceAccountId);
  const { data: sourceAccount } = useSourceAccount(sourceAccountId);
  const { mutateAsync: disconnect, isPending: isDisconnecting } = useDisconnectSourceAccount();
  const { mutateAsync: reconnect, isPending: isReconnecting } = useReconnectSourceAccount();
  const { mutateAsync: removeNick, isPending: isRemovingNick } = useRemoveReservedNick();
  const { mutateAsync: recalcSlots, isPending: isSyncing } = useRecalculateSlots();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const text = vi.inventory.page.connections;
  const slotText = vi.inventory.page.slotBreakdown;

  const reservedNicks: string[] = sourceAccount?.reservedNicks ?? [];

  const handleDisconnectClick = (item: ConnectionItem) => {
    if (confirm(text.confirmDisconnect(item.orders.id.split('-')[0]))) {
      handleDisconnect(item.id, item.quantity);
    }
  };

  const handleDisconnect = async (orderItemId: string, quantity: number) => {
    try {
      await disconnect({ sourceAccountId, orderItemId, quantity });
      appToast.success(text.disconnected);
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : text.disconnectError);
    }
  };

  const handleReconnect = async (orderItemId: string, quantity: number) => {
    if (usedSlots + quantity > maxSlots) {
      appToast.error(text.noEnoughSlots);
      return;
    }
    try {
      await reconnect({ sourceAccountId, orderItemId, quantity });
      appToast.success(text.reconnectSuccess);
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : text.reconnectError);
    }
  };

  const handleRemoveReservedNick = async (nick: string) => {
    try {
      await removeNick({ sourceAccountId, nick });
      appToast.success(text.removedNick(nick));
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : text.removeNickError);
    }
  };

  const handleSyncSlots = async () => {
    try {
      const result = await recalcSlots(sourceAccountId);
      if (result.changed) {
        appToast.success(text.syncSuccess(String(result.previous), String(result.recalculated)));
      } else {
        appToast.info(text.syncExact);
      }
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : text.syncError);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-6 text-[var(--fg-muted)]"><Loader2 className="size-5 animate-spin" /></div>;
  }

  if (error || !data) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm text-center">{text.error}</div>;
  }

  const { connected, unconnected } = data as unknown as { connected: ConnectionItem[], unconnected: ConnectionItem[] };

  // Slot breakdown calculations
  const connectedSlots = connected.reduce((sum: number, item: ConnectionItem) => sum + item.quantity, 0);
  const reservedCount = reservedNicks.length;
  const freeSlots = Math.max(0, maxSlots - usedSlots);

  return (
    <div className="space-y-6">
      {/* Slot Breakdown Summary */}
      <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)]/70 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{text.breakdownTitle}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncSlots}
              disabled={isSyncing}
              className="text-[10px] font-bold text-[var(--fg-muted)] hover:text-[var(--accent)] flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-[var(--accent)]/10 disabled:opacity-50"
              title={text.syncTooltip}
            >
              <RefreshCw className={`size-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {text.syncButton}
            </button>
            <span className="text-[12px] font-black text-[var(--fg-base)]">{usedSlots} / {maxSlots}</span>
          </div>
        </div>
        <div className="w-full h-1.5 bg-[var(--border-soft)] rounded-full overflow-hidden mb-2">
          <div className="h-full flex">
            {connectedSlots > 0 && (
              <div className="h-full bg-[var(--accent)]" style={{ width: `${(connectedSlots / maxSlots) * 100}%` }} />
            )}
            {reservedCount > 0 && (
              <div className="h-full bg-purple-400" style={{ width: `${(reservedCount / maxSlots) * 100}%` }} />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-[var(--accent)]" />
            <span className="text-[var(--fg-muted)]">{slotText.connections}: <strong className="text-[var(--fg-base)]">{connectedSlots}</strong></span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-purple-400" />
            <span className="text-[var(--fg-muted)]">{slotText.reserved}: <strong className="text-[var(--fg-base)]">{reservedCount}</strong></span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-gray-300" />
            <span className="text-[var(--fg-muted)]">{slotText.free}: <strong className="text-[var(--fg-base)]">{freeSlots}</strong></span>
          </span>
        </div>
      </div>

      {showAddDialog && (
        <AddConnectionDialog
          sourceAccountId={sourceAccountId}
          maxSlots={maxSlots}
          usedSlots={usedSlots}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-wider flex items-center gap-2">
            <Link2 className="size-4" />
            {text.connectedTitle(connected.length)}
          </h4>
          <ScaleButton 
             className="text-[11px] flex items-center gap-1 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 px-2.5 py-1.5 rounded-lg font-bold"
             onClick={() => setShowAddDialog(true)}
          >
            <Plus className="size-3" />
            {text.addConnection}
          </ScaleButton>
        </div>
        {connected.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-muted)] text-center py-4 bg-gray-50 rounded-xl border border-dashed border-[var(--border-soft)]">{text.emptyConnected}</p>
        ) : (
          <div className="space-y-2">
            {connected.map((item: ConnectionItem) => (
              <FadeIn key={item.id} className="flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.96)] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors hover:border-[var(--accent)]/30">
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="size-3.5 text-[var(--accent)]" />
                    <span className="font-bold text-[13px] text-[var(--fg-base)] truncate">{item.orders.customers.full_name}</span>
                    {item.customer_nick_used && (
                      <span className="text-[10px] font-bold bg-[var(--accent)]/10 text-[var(--accent)] px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Key className="size-3" />
                        {item.customer_nick_used}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)] flex items-center gap-2">
                    <span>{text.orderCodeLabel} {item.orders.id.split('-')[0]}</span>
                    <span>•</span>
                    <span className="truncate max-w-[150px]">{productMap.get(item.product_id) || item.product_name_snapshot}</span>
                    <span>•</span>
                    <span className="font-bold">{text.quantityLabel} {item.quantity}</span>
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  title={text.disconnectButton}
                  disabled={isDisconnecting || isReconnecting}
                  className="size-8 shrink-0 rounded-full border-red-200 p-0 text-red-500 shadow-none transition-colors hover:border-red-500 hover:bg-red-500 hover:text-white"
                  onClick={() => handleDisconnectClick(item)}
                >
                  <X className="size-4" />
                </Button>
              </FadeIn>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-2 mt-6">
          <AlertTriangle className="size-4" />
          {text.waitingTitle(unconnected.length)}
        </h4>
        {unconnected.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-muted)] text-center py-4 bg-gray-50 rounded-xl border border-dashed border-[var(--border-soft)]">{text.waitingEmpty}</p>
        ) : (
          <div className="space-y-2">
            {unconnected.map((item: ConnectionItem) => (
              <FadeIn key={item.id} className="flex items-center justify-between gap-3 rounded-[1rem] border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)] p-3 opacity-80 transition-opacity hover:opacity-100">
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="size-3.5 text-[var(--accent)]" />
                    <span className="font-bold text-[13px] text-[var(--fg-base)] truncate">{item.orders.customers.full_name}</span>
                    {item.customer_nick_used && (
                      <span className="text-[10px] font-bold bg-[var(--surface-light)] text-[var(--fg-muted)] px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Key className="size-3" />
                        {item.customer_nick_used}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)] flex items-center gap-2">
                    <span>{text.orderCodeLabel} {item.orders.id.split('-')[0]}</span>
                    <span>•</span>
                    <span className="truncate max-w-[150px]">{productMap.get(item.product_id) || item.product_name_snapshot}</span>
                    <span>•</span>
                    <span className="font-bold">{text.quantityLabel} {item.quantity}</span>
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  disabled={isDisconnecting || isReconnecting || (usedSlots + item.quantity > maxSlots)}
                  className="text-[11px] h-8 px-2.5 bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/20 shadow-sm"
                  onClick={() => handleReconnect(item.id, item.quantity)}
                >
                  <ShieldCheck className="size-3 mr-1" />
                  {text.reconnectButton}
                </Button>
              </FadeIn>
            ))}
          </div>
        )}
      </div>

      {/* Reserved Nicks Section */}
      {reservedNicks.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[12px] font-bold text-purple-400/80 uppercase tracking-wider flex items-center gap-2 mt-6">
            <Bookmark className="size-4" />
            {text.reservedSectionTitle(reservedNicks.length)}
          </h4>
          <div className="flex flex-wrap gap-2">
            {reservedNicks.map((nick) => (
              <div
                key={nick}
                className="group flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 px-2.5 py-1.5 text-[12px] text-purple-700"
              >
                <AtSign className="size-3 text-purple-400 shrink-0" />
                <span className="font-mono">{nick}</span>
                <button
                  disabled={isRemovingNick}
                  onClick={() => handleRemoveReservedNick(nick)}
                  className="ml-0.5 text-purple-600 transition-colors opacity-0 group-hover:opacity-100 hover:text-red-500"
                  title={text.removeNickButton}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 italic">
            {text.reservedHint}
          </p>
        </div>
      )}
    </div>
  );
}
