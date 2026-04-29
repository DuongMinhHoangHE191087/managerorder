import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";

export const GET = withFlatAccountHandler(async (request, { accountId }) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  const { data: baseRenewals, error } = await supabaseAdmin
    .from("subscription_renewals")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", status)
    .order("renewal_requested_date", { ascending: false });

  if (error) {
    throw error;
  }

  const originalSubscriptionIds = [
    ...new Set(
      (baseRenewals ?? [])
        .map((item) => item.original_subscription_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const subscriptionMap = await loadRowsByIds<{
    id: string;
    customer_id: string;
    premium_account_id: string;
    package_id: string;
    billing_cycle: string;
    cycle_months: number;
    expiry_date: string;
    final_price: number | null;
    original_price: number | null;
  }>(
    supabaseAdmin,
    "customer_premium_subscriptions",
    accountId,
    originalSubscriptionIds,
    "id, customer_id, premium_account_id, package_id, billing_cycle, cycle_months, expiry_date, final_price, original_price",
  );

  const customerIds = [
    ...new Set(
      [...subscriptionMap.values()]
        .map((item) => item.customer_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const premiumAccountIds = [
    ...new Set(
      [...subscriptionMap.values()]
        .map((item) => item.premium_account_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const packageIds = [
    ...new Set(
      [...subscriptionMap.values()]
        .map((item) => item.package_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [customerMap, accountMap, packageMap] = await Promise.all([
    loadRowsByIds<{
      id: string;
      full_name: string;
    }>(
      supabaseAdmin,
      "customers",
      accountId,
      customerIds,
      "id, full_name",
    ),
    loadRowsByIds<{
      id: string;
      primary_email: string;
      service_type_id: string;
    }>(
      supabaseAdmin,
      "premium_accounts",
      accountId,
      premiumAccountIds,
      "id, primary_email, service_type_id",
    ),
    loadRowsByIds<{
      id: string;
      default_price: number | null;
      renewal_price_factor: number | null;
    }>(
      supabaseAdmin,
      "premium_packages",
      accountId,
      packageIds,
      "id, default_price, renewal_price_factor",
    ),
  ]);

  const serviceTypeIds = [
    ...new Set(
      [...accountMap.values()]
        .map((item) => item.service_type_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const serviceTypeMap = await loadRowsByIds<{
    id: string;
    name: string;
  }>(
    supabaseAdmin,
    "premium_service_types",
    accountId,
    serviceTypeIds,
    "id, name",
  );

  const formattedData = (baseRenewals ?? []).map((item) => {
    const subscription = item.original_subscription_id
      ? subscriptionMap.get(item.original_subscription_id) ?? null
      : null;
    const customer = subscription?.customer_id
      ? customerMap.get(subscription.customer_id) ?? null
      : null;
    const account = subscription?.premium_account_id
      ? accountMap.get(subscription.premium_account_id) ?? null
      : null;
    const packageRow = subscription?.package_id
      ? packageMap.get(subscription.package_id) ?? null
      : null;
    const service = account?.service_type_id
      ? serviceTypeMap.get(account.service_type_id) ?? null
      : null;

    return {
      ...item,
      original_subscription: subscription
        ? {
            ...subscription,
            customer,
            premium_account: account
              ? {
                  ...account,
                  service,
                }
              : null,
          }
        : null,
      customer_name: customer?.full_name ?? "N/A",
      account_email: account?.primary_email ?? "N/A",
      service_name: service?.name ?? "N/A",
      current_billing_cycle: subscription?.billing_cycle ?? null,
      current_cycle_months: subscription?.cycle_months ?? null,
      current_expiry_date: subscription?.expiry_date ?? null,
      current_subscription_price: subscription?.final_price ?? subscription?.original_price ?? null,
      package_default_price: packageRow?.default_price ?? null,
      renewal_price_factor: packageRow?.renewal_price_factor ?? null,
    };
  });

  return createFlatSuccessResponse(formattedData, {
    meta: { total: formattedData.length, status },
  });
});
