import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createTenantQuery } from "@/lib/supabase/tenant-client";
import { getOrdersForExport } from "@/lib/supabase/repositories/orders.repo";
import { getDashboardStats } from "@/domains/dashboard";
import { listCustomersForAccount } from "@/domains/customers";
import { listProductsForAccount } from "@/domains/products";
import { listSourceAccountsForAccount } from "@/domains/source-accounts";
import { normalizeSystemSettings } from "@/lib/settings/system-settings";

export const dynamic = "force-dynamic";

async function safeRows(query: PromiseLike<unknown>): Promise<unknown[]> {
  try {
    const result = (await query) as { data?: unknown[] | null } | null;
    return Array.isArray(result?.data) ? result.data : [];
  } catch {
    return [];
  }
}

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const tenantQuery = createTenantQuery(accountId);

    const [
      customers,
      products,
      sourceAccounts,
      orders,
      dashboard,
      paymentSources,
      salesChannels,
      systemSettingsRows,
      reminderConfigRows,
    ] = await Promise.all([
      listCustomersForAccount(accountId).catch(() => []),
      listProductsForAccount(accountId).catch(() => []),
      listSourceAccountsForAccount(accountId).catch(() => []),
      getOrdersForExport(accountId).catch(() => []),
      getDashboardStats(accountId).catch(() => null),
      safeRows(tenantQuery.from("payment_sources").select("*").eq("account_id", accountId).is("deleted_at", null)),
      safeRows(tenantQuery.from("sales_channels").select("*").eq("account_id", accountId).is("deleted_at", null)),
      safeRows(tenantQuery.from("system_settings").select("*").eq("account_id", accountId).limit(1)),
      safeRows(tenantQuery.from("reminder_config").select("*").eq("account_id", accountId).limit(1)),
    ]);

    const systemSettingsRow = systemSettingsRows[0] ?? null;
    const reminderConfigRow = reminderConfigRows[0] ?? null;

    const backup = {
      generatedAt: new Date().toISOString(),
      accountId,
      summary: {
        customers: customers.length,
        products: products.length,
        sourceAccounts: sourceAccounts.length,
        orders: orders.length,
        totalRevenue: dashboard?.totalRevenue ?? 0,
        totalProfit: dashboard?.totalProfit ?? 0,
        pendingOrders: dashboard?.pendingCount ?? 0,
      },
      customers,
      products,
      sourceAccounts,
      orders,
      dashboard,
      settings: {
        system: normalizeSystemSettings(systemSettingsRow ?? null),
        reminderConfig: reminderConfigRow,
        paymentSources,
        salesChannels,
      },
    };

    const timestamp = new Date().toISOString().split("T")[0];
    return NextResponse.json(backup, {
      headers: {
        "Content-Disposition": `attachment; filename="platform_backup_${timestamp}.json"`,
      },
    });
  }),
);
