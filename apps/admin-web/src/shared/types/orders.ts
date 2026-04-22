export interface PaymentRecord {
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

export interface RefundRequest {
  id: string;
  order_id: string;
  customer_id: string | null;
  paid_amount_vnd: number;
  consumed_days: number;
  total_days: number;
  refund_mode: "full" | "pro_rata";
  refundable_amount_vnd: number;
  status: "requested" | "approved" | "processing" | "completed" | "rejected" | "cancelled";
  reason: string | null;
  admin_note: string | null;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
}
