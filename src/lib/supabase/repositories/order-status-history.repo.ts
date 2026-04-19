// ============================================================
// ORDER STATUS HISTORY REPOSITORY
// Tracks who/when/what for every order status transition
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  change_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateStatusHistoryInput {
  order_id: string;
  old_status: string | null;
  new_status: string;
  changed_by?: string | null;
  change_reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log a status transition into the audit trail.
 * Designed to fail gracefully — never blocks the main business flow.
 */
export async function createOrderStatusHistory(
  input: CreateStatusHistoryInput
): Promise<OrderStatusHistoryRow | null> {
  try {
    const { data, error } = await supabase
      .from('order_status_history')
      .insert([{
        order_id: input.order_id,
        old_status: input.old_status,
        new_status: input.new_status,
        changed_by: input.changed_by ?? null,
        change_reason: input.change_reason ?? null,
        metadata: input.metadata ?? {},
      }])
      .select()
      .single();

    if (error) {
      console.error('[OrderStatusHistory] Insert error:', error);
      return null;
    }
    return data as unknown as OrderStatusHistoryRow;
  } catch (err) {
    console.error('[OrderStatusHistory] Exception:', err);
    return null;
  }
}

/**
 * Fetch the full status history for an order,
 * ordered chronologically (oldest first) for timeline display.
 */
export async function getOrderStatusHistory(
  orderId: string
): Promise<OrderStatusHistoryRow[]> {
  try {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[OrderStatusHistory] Fetch error:', error);
      return [];
    }
    return (data ?? []) as unknown as OrderStatusHistoryRow[];
  } catch (err) {
    console.error('[OrderStatusHistory] Exception:', err);
    return [];
  }
}
