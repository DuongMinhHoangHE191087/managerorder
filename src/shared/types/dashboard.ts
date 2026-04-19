export interface DashboardStats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalCollected: number;
  totalDebt: number;
  totalRefunded: number;
  refundedCount: number;
  pendingCount: number;
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
  fillRate: number;
  expiringAccounts: Array<{
    id: string;
    email?: string;
    expiresAt: string;
    daysLeft: number;
    productIds: string[];
    usedSlots: number;
    maxSlots: number;
  }>;
  overdueCustomers: Array<{
    id: string;
    name: string;
    debtAmountVnd: number;
    debtOverdueDays: number;
  }>;
  pendingOrders: Array<{
    id: string;
    customerId: string;
    productId: string;
    totalAmountVnd: number;
    createdAt: string;
    paymentState: string;
    balanceDueVnd: number;
  }>;
  topProducts: Array<{
    name: string;
    revenue: number;
    count: number;
  }>;
  productSlots: Array<{
    id: string;
    name: string;
    used: number;
    max: number;
  }>;
  chartData: Array<{
    name: string;
    revenue: number;
    orders: number;
  }>;
  recentOrders: Array<{
    id: string;
    customerId: string;
    customerName: string;
    productId: string;
    productName: string;
    status: string;
    paymentState: string;
    balanceDueVnd: number;
    totalAmountVnd: number;
    createdAt: string;
  }>;
  calculatedAt: string;
}
