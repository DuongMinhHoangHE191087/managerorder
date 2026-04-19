export interface ViewActivityLog {
  id: string;
  action_type: string;
  customer_id?: string | null;
  order_id?: string | null;
  source_account_id?: string | null;
  details?: Record<string, unknown>;
  created_at: string;
  created_by?: string | null;
  customers?: { full_name: string } | null;
  orders?: { id: string; status: string } | null;
  source_accounts?: { email: string; provider: string } | null;
}

export interface PaginatedLogsResponse {
  data: ViewActivityLog[];
  meta: {
    count: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UseActivityLogsOptions {
  page?: number;
  limit?: number;
  search?: string;
  actionType?: string;
  customerId?: string;
  orderId?: string;
  sourceAccountId?: string;
  startDate?: string;
  endDate?: string;
}
