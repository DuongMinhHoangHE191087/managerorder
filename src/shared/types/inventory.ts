export interface InventoryCapacityItem {
  id: string;
  email: string;
  freeSlots: number;
  maxSlots: number;
  freePercent: number;
}

export interface InventoryExpiryItem {
  id: string;
  email: string;
  expiresAt: string;
  daysLeft: number;
}

export interface InventoryDashboardData {
  totalAccounts: number;
  activeAccounts: number;
  expiredAccounts: number;
  expiringSoon7d: number;
  expiringSoon30d: number;
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
  avgUtilization: number;
  totalPurchaseCostVnd: number;
  lowCapacityCount: number;
  lowCapacityList: InventoryCapacityItem[];
  expiringSoonList: InventoryExpiryItem[];
  keys: {
    total: number;
    available: number;
    reserved: number;
    used: number;
  };
}

export interface SlotBreakdownConnectedItem {
  orderItemId: string;
  orderId: string;
  productId: string;
  quantity: number;
  customerName: string;
  nickUsed: string | null;
}

export interface SlotBreakdownData {
  connectedCount: number;
  reservedCount: number;
  availableCount: number;
  total: number;
  connectedItems: SlotBreakdownConnectedItem[];
  reservedNicks: string[];
}
