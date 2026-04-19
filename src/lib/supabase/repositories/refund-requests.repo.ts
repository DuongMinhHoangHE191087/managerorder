// ============================================================
// REFUND REQUESTS REPOSITORY
// Tracks refund requests through the approval chain
// Flow: requested → approved → processing → completed / rejected
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';

export type RefundStatus = 'requested' | 'approved' | 'processing' | 'completed' | 'rejected' | 'cancelled';

export interface RefundRequestRow {
  id: string;
  order_id: string;
  customer_id: string | null;
  paid_amount_vnd: number;
  consumed_days: number;
  total_days: number;
  refund_mode: 'full' | 'pro_rata';
  refundable_amount_vnd: number;
  status: RefundStatus;
  reason: string | null;
  admin_note: string | null;
  requested_by: string | null;
  approved_by: string | null;
  processed_by: string | null;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRefundInput {
  order_id: string;
  customer_id?: string | null;
  paid_amount_vnd: number;
  consumed_days: number;
  total_days: number;
  refund_mode: 'full' | 'pro_rata';
  refundable_amount_vnd: number;
  reason?: string | null;
  requested_by?: string | null;
}

/**
 * Create a new refund request (status: requested).
 */
export async function createRefundRequest(
  input: CreateRefundInput
): Promise<RefundRequestRow> {
  const { data, error } = await supabase
    .from('refund_requests')
    .insert([{
      order_id: input.order_id,
      customer_id: input.customer_id ?? null,
      paid_amount_vnd: input.paid_amount_vnd,
      consumed_days: input.consumed_days,
      total_days: input.total_days,
      refund_mode: input.refund_mode,
      refundable_amount_vnd: input.refundable_amount_vnd,
      reason: input.reason ?? null,
      requested_by: input.requested_by ?? null,
      status: 'requested',
    }])
    .select()
    .single();

  if (error) throw new Error(`[Refunds] Create error: ${error.message}`);
  return data as unknown as RefundRequestRow;
}

/**
 * Update refund status with appropriate timestamps.
 */
export async function updateRefundStatus(
  refundId: string,
  newStatus: RefundStatus,
  opts?: { admin_note?: string; approved_by?: string; processed_by?: string }
): Promise<RefundRequestRow | null> {
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (opts?.admin_note) updateData.admin_note = opts.admin_note;

  if (newStatus === 'approved') {
    updateData.approved_at = new Date().toISOString();
    if (opts?.approved_by) updateData.approved_by = opts.approved_by;
  }

  if (newStatus === 'completed' || newStatus === 'rejected' || newStatus === 'cancelled') {
    updateData.completed_at = new Date().toISOString();
    if (opts?.processed_by) updateData.processed_by = opts.processed_by;
  }

  const { data, error } = await supabase
    .from('refund_requests')
    .update(updateData)
    .eq('id', refundId)
    .select()
    .single();

  if (error) {
    console.error('[Refunds] Update error:', error);
    return null;
  }
  return data as unknown as RefundRequestRow;
}

/**
 * Get all refund requests for an order.
 */
export async function getRefundsByOrder(
  orderId: string
): Promise<RefundRequestRow[]> {
  const { data, error } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Refunds] Fetch error:', error);
    return [];
  }
  return (data ?? []) as unknown as RefundRequestRow[];
}

/**
 * Get a single refund request by ID.
 */
export async function getRefundById(
  refundId: string
): Promise<RefundRequestRow | null> {
  const { data, error } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('id', refundId)
    .single();

  if (error) return null;
  return data as unknown as RefundRequestRow;
}

/**
 * List all pending refund requests (for admin dashboard).
 */
export async function getPendingRefunds(): Promise<RefundRequestRow[]> {
  const { data, error } = await supabase
    .from('refund_requests')
    .select('*')
    .in('status', ['requested', 'approved', 'processing'])
    .order('requested_at', { ascending: true });

  if (error) {
    console.error('[Refunds] Pending fetch error:', error);
    return [];
  }
  return (data ?? []) as unknown as RefundRequestRow[];
}
