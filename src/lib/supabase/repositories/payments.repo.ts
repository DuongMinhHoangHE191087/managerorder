// ============================================================
// PAYMENTS REPOSITORY
// Tracks individual payment records for multi-payment support
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';

export interface PaymentRow {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string | null;
  payment_source_id: string | null;
  proof_image_url: string | null;
  note: string | null;
  paid_by: string | null;
  paid_at: string;
  created_at: string;
}

export interface CreatePaymentInput {
  order_id: string;
  amount: number;
  payment_method?: string | null;
  payment_source_id?: string | null;
  proof_image_url?: string | null;
  note?: string | null;
  paid_by?: string | null;
}

/**
 * Record a new individual payment against an order.
 * Validates that the order belongs to the given account before inserting.
 */
export async function createPayment(
  accountId: string,
  input: CreatePaymentInput
): Promise<PaymentRow> {
  // Verify order belongs to this account before inserting payment
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id')
    .eq('id', input.order_id)
    .eq('account_id', accountId)
    .single();

  if (orderErr || !order) {
    throw new Error('[Payments] Order not found or access denied');
  }

  const { data, error } = await supabase
    .from('payments')
    .insert([{
      order_id: input.order_id,
      amount: input.amount,
      payment_method: input.payment_method ?? null,
      payment_source_id: input.payment_source_id ?? null,
      proof_image_url: input.proof_image_url ?? null,
      note: input.note ?? null,
      paid_by: input.paid_by ?? null,
    }])
    .select()
    .single();

  if (error) throw new Error(`[Payments] Insert error: ${error.message}`);
  return data as unknown as PaymentRow;
}

/**
 * Fetch all payments for an order, ordered by paid_at ASC (chronological).
 * Validates that the order belongs to the given account.
 */
export async function getPaymentsByOrder(
  orderId: string,
  accountId: string
): Promise<PaymentRow[]> {
  // Join with orders to enforce tenant isolation
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('account_id', accountId)
    .single();

  if (!order) {
    throw new Error('[Payments] Order not found or access denied');
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('paid_at', { ascending: true });

  if (error) throw new Error(`[Payments] Fetch error: ${error.message}`);
  return (data ?? []) as unknown as PaymentRow[];
}

/**
 * Get total sum of all payments for an order.
 * Used for reconciliation checks.
 */
export async function getPaymentsTotalByOrder(
  orderId: string,
  accountId: string
): Promise<number> {
  const payments = await getPaymentsByOrder(orderId, accountId);
  return payments.reduce((sum, p) => sum + Number(p.amount), 0);
}
