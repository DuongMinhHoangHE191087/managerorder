export type DashboardRecentOrder = {
  id: string;
  customerName: string;
  productName: string;
  status: string;
  createdAt: string;
};

export type DashboardProductSlot = {
  name: string;
  used: number;
  max: number;
};

export type DashboardTopProduct = {
  name: string;
  revenue: number;
};
