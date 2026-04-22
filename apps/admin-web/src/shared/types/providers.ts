export interface ProviderPurchaseOrderItem {
  productName?: string;
  product_name?: string;
  quantity?: number;
  price?: number;
  priceVnd?: number;
}

export interface ProviderPurchaseOrder {
  id: string;
  status: string;
  payment_method: string;
  total_amount: number;
  total_paid: number;
  items: ProviderPurchaseOrderItem[];
  created_at: string;
  received_at?: string;
  notes?: string;
}
