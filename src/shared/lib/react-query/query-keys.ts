export const queryKeys = {
  // Products
  products: ["products"] as const,
  product: (id: string) => ["products", id] as const,

  // Orders
  orders: ["orders"] as const,
  ordersStats: ["orders", "stats"] as const,
  order: (id: string) => ["orders", id] as const,
  orderStatusHistory: (id: string) => ["orders", id, "status-history"] as const,
  payments: (id: string) => ["orders", id, "payments"] as const,
  refunds: (id: string) => ["orders", id, "refunds"] as const,

  // Customers
  customers: ["customers"] as const,
  customer: (id: string) => ["customers", id] as const,
  customerTags: ["customer-tags"] as const,
  customerStats: ["customers", "stats"] as const,
  customerReminders: ["customers", "reminders"] as const,
  customer360Stats: (id: string) => ["customers", id, "360-stats"] as const,
  debtSummary: ["customers", "debt-summary"] as const,

  // Inventory / Key
  inventory: ["inventory"] as const,
  inventoryItem: (id: string) => ["inventory", id] as const,

  // Calendar
  calendarEvents: ["calendar-events"] as const,

  // Settings
  systemSettings: ["settings", "system"] as const,
  paymentSources: ["settings", "payment-sources"] as const,
  salesChannels: ["settings", "sales-channels"] as const,
  reminderConfig: ["settings", "reminders"] as const,
  botStatus: ["settings", "bot", "status"] as const,
  webhooks: ["settings", "webhooks"] as const,
  webhook: (id: string) => ["settings", "webhooks", id] as const,
  webhookLogs: (id: string) => ["settings", "webhooks", id, "logs"] as const,

  // Providers
  providers: ["providers"] as const,
  provider: (id: string) => ["providers", id] as const,
  purchaseOrders: ["purchase-orders"] as const,
  providerPurchaseOrders: (id: string) => ["providers", id, "purchase-orders"] as const,

  // Premium Management
  premiumAccounts: ["premium", "accounts"] as const,
  premiumServices: ["premium", "services"] as const,
  premiumSubscriptions: ["premium", "subscriptions"] as const,
  sourceAccounts: ["source-accounts"] as const,
  sourceAccount: (id: string) => ["source-accounts", id] as const,
  sourceAccountConnections: (id: string) => ["source-accounts", id, "connections"] as const,
  slotBreakdown: (id: string) => ["source-accounts", id, "slot-breakdown"] as const,
  connectionsEnriched: (id: string) => ["source-accounts", id, "connections-enriched"] as const,

  // Dashboard
  dashboard: ["dashboard"] as const,
  dashboardStats: (days: number) => ["dashboard", "stats", days] as const,
  notificationsFeed: (limit: number) => ["notifications", "feed", limit] as const,

  // Inventory Dashboard
  inventoryDashboard: ["inventory-dashboard"] as const,
};

