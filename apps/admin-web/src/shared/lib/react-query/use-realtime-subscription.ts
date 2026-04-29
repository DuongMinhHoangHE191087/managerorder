/**
 * ============================================================
 * useRealtimeSubscription — Generic Supabase Realtime Hook
 *
 * Subscribes to postgres_changes on a table and auto-invalidates
 * TanStack Query cache when INSERT/UPDATE/DELETE events occur.
 *
 * Usage:
 *   useRealtimeSubscription('orders', {
 *     filter: `account_id=eq.${accountId}`,
 *     queryKeys: [['orders']],
 *   });
 * ============================================================
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface RealtimeSubscriptionOptions {
  /** Supabase filter string, e.g. "account_id=eq.xxx" */
  filter?: string;
  /** Which events to listen for (default: all) */
  events?: RealtimeEvent[];
  /** TanStack Query keys to invalidate on change */
  queryKeys?: readonly (readonly unknown[])[];
  /** Custom callback for each change event */
  onEvent?: (
    event: RealtimeEvent,
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => void;
  /** Whether subscription is active (default: true) */
  enabled?: boolean;
  /** Schema to listen on (default: "public") */
  schema?: string;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useRealtimeSubscription(
  table: string,
  options: RealtimeSubscriptionOptions = {}
) {
  const {
    filter,
    events = ["INSERT", "UPDATE", "DELETE"],
    queryKeys = [],
    onEvent,
    enabled = true,
    schema = "public",
  } = options;

  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [reconnectCount, setReconnectCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 1;

  // Stable callback ref to avoid re-subscribing on every render
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;

  const eventsKey = events.join(",");

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!enabled || !table) {
      cleanup();
      return;
    }

    setStatus("connecting");
    void (async () => {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");

      if (isCancelled) {
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const channelName = `realtime:${schema}:${table}:${filter || "all"}`;
      const channel = supabase.channel(channelName);

      for (const event of events) {
        const filterConfig: Record<string, unknown> = {
          event,
          schema,
          table,
        };
        if (filter) {
          filterConfig.filter = filter;
        }

        channel.on(
          "postgres_changes" as never,
          filterConfig as never,
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            for (const key of queryKeysRef.current) {
              queryClient.invalidateQueries({ queryKey: key });
            }

            onEventRef.current?.(event, payload);
          }
        );
      }

      channel.subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          reconnectAttempts.current = 0;
          setStatus("connected");
        } else if (subscriptionStatus === "CLOSED") {
          setStatus("disconnected");
        } else if (subscriptionStatus === "CHANNEL_ERROR") {
          setStatus("error");
          if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
            return;
          }
          reconnectAttempts.current += 1;
          reconnectTimer.current = setTimeout(() => {
            cleanup();
            setReconnectCount((count) => count + 1);
          }, 5_000);
        }
      });

      channelRef.current = channel;
    })();

    return () => {
      isCancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, enabled, schema, eventsKey, cleanup, queryClient, reconnectCount]);

  return { status };
}
