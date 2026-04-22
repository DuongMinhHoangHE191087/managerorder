import { listSourceAccounts } from "@/lib/supabase/repositories/source-accounts.repo";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getInventoryDashboardMetrics(accountId: string) {
  const [sourceAccounts, keysResult] = await Promise.all([
    listSourceAccounts(accountId),
    supabaseAdmin
      .from("license_keys")
      .select("id, status, product_id")
      .eq("account_id", accountId),
  ]);

  const now = Date.now();
  const sourceAccountRows = sourceAccounts;
  const licenseKeys = (keysResult.data ?? []) as Array<{
    id: string;
    status: "available" | "reserved" | "used";
    product_id: string;
  }>;

  const totalAccounts = sourceAccountRows.length;
  const expiredAccounts = sourceAccountRows.filter(
    (account) => new Date(account.expires_at).getTime() < now,
  ).length;
  const activeAccounts = totalAccounts - expiredAccounts;
  const expiringSoon7d = sourceAccountRows.filter((account) => {
    const exp = new Date(account.expires_at).getTime();
    return exp > now && exp - now <= SEVEN_DAYS_MS;
  }).length;
  const expiringSoon30d = sourceAccountRows.filter((account) => {
    const exp = new Date(account.expires_at).getTime();
    return exp > now && exp - now <= THIRTY_DAYS_MS;
  }).length;

  const totalSlots = sourceAccountRows.reduce((sum, account) => sum + account.max_slots, 0);
  const usedSlots = sourceAccountRows.reduce((sum, account) => sum + account.used_slots, 0);
  const availableSlots = totalSlots - usedSlots;
  const avgUtilization = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

  const lowCapacityAccounts = sourceAccountRows.filter((account) => {
    if (new Date(account.expires_at).getTime() < now) return false;
    if (account.max_slots === 0) return false;
    const freeSlots = account.max_slots - account.used_slots;
    const freePercent = (freeSlots / account.max_slots) * 100;
    return freePercent < 20 && freePercent >= 0;
  });

  const availableKeys = licenseKeys.filter((key) => key.status === "available").length;
  const reservedKeys = licenseKeys.filter((key) => key.status === "reserved").length;
  const usedKeys = licenseKeys.filter((key) => key.status === "used").length;

  const expiringSoonList = sourceAccountRows
    .filter((account) => {
      const exp = new Date(account.expires_at).getTime();
      return exp > now && exp - now <= SEVEN_DAYS_MS;
    })
    .map((account) => ({
      id: account.id,
      email: account.email,
      expiresAt: account.expires_at,
      daysLeft: Math.ceil(
        (new Date(account.expires_at).getTime() - now) / (1000 * 60 * 60 * 24),
      ),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const lowCapacityList = lowCapacityAccounts
    .map((account) => ({
      id: account.id,
      email: account.email,
      freeSlots: account.max_slots - account.used_slots,
      maxSlots: account.max_slots,
      freePercent: Math.round(((account.max_slots - account.used_slots) / account.max_slots) * 100),
    }))
    .sort((a, b) => a.freePercent - b.freePercent);

  const totalPurchaseCostVnd = sourceAccountRows.reduce(
    (sum, account) => sum + (account.purchase_cost_vnd ?? 0),
    0,
  );

  return {
    totalAccounts,
    activeAccounts,
    expiredAccounts,
    expiringSoon7d,
    expiringSoon30d,
    totalSlots,
    usedSlots,
    availableSlots,
    avgUtilization,
    totalPurchaseCostVnd,
    lowCapacityCount: lowCapacityAccounts.length,
    lowCapacityList,
    expiringSoonList,
    keys: {
      total: licenseKeys.length,
      available: availableKeys,
      reserved: reservedKeys,
      used: usedKeys,
    },
  };
}

export async function getInventoryProfitReport(accountId: string) {
  const [sourceAccounts, ordersResult] = await Promise.all([
    listSourceAccounts(accountId),
    supabaseAdmin
      .from("orders")
      .select("id, source_account_id, total_price_vnd, status")
      .eq("account_id", accountId)
      .in("status", ["delivered", "completed", "active"]),
  ]);

  const orders = (ordersResult.data ?? []) as Array<{
    id: string;
    source_account_id: string | null;
    total_price_vnd: number | null;
    status: string;
  }>;

  const revenueByAccount = new Map<string, number>();
  for (const order of orders) {
    if (!order.source_account_id) continue;
    const current = revenueByAccount.get(order.source_account_id) || 0;
    revenueByAccount.set(order.source_account_id, current + (order.total_price_vnd ?? 0));
  }

  let totalCost = 0;
  let totalRevenue = 0;

  const rows = sourceAccounts.map((account) => {
    const cost = account.purchase_cost_vnd ?? 0;
    const revenue = revenueByAccount.get(account.id) || 0;
    const profit = revenue - cost;

    totalCost += cost;
    totalRevenue += revenue;

    return {
      id: account.id,
      email: account.email,
      provider: account.provider,
      purchaseCostVnd: cost,
      purchaseDate: account.purchase_date || null,
      purchaseSource: account.purchase_source || null,
      revenueVnd: revenue,
      profitVnd: profit,
      roi: cost > 0 ? Math.round((profit / cost) * 100) : null,
      orderCount: orders.filter((order) => order.source_account_id === account.id).length,
    };
  });

  return {
    data: rows,
    summary: {
      totalCost,
      totalRevenue,
      totalProfit: totalRevenue - totalCost,
      avgRoi:
        totalCost > 0
          ? Math.round(((totalRevenue - totalCost) / totalCost) * 100)
          : null,
      accountsWithCost: rows.filter((row) => row.purchaseCostVnd > 0).length,
      totalAccounts: rows.length,
    },
  };
}
