import type { Customer } from "@/lib/domain/types";

export interface DuplicateCandidate {
  id: string;
  name: string;
  matchType: "name" | "contact" | "both";
  matchValue?: string;
  similarity: number;
}

export interface CustomerOrderItem {
  productName?: string;
  product_name?: string;
  quantity?: number;
  price?: number;
}

export interface CustomerOrder {
  id: string;
  status: string;
  payment_method: string;
  payment_terms?: string | null;
  payment_state?: string | null;
  balance_due_vnd?: number;
  is_fully_paid?: boolean;
  total_amount: number;
  total_paid: number;
  items: CustomerOrderItem[];
  created_at: string;
  sales_note?: string;
}

export interface CustomerGroup {
  id: string;
  name: string;
  color: string;
  description: string | null;
  member_count?: number;
  created_at: string;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export type CreateCustomerResult = Customer & { id: string };
