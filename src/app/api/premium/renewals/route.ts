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
  }>(
    supabaseAdmin,
    "customer_premium_subscriptions",
    accountId,
    originalSubscriptionIds,
    "id, customer_id, premium_account_id",
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

  const [customerMap, accountMap] = await Promise.all([
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
    };
  });

  return createFlatSuccessResponse(formattedData, {
    meta: { total: formattedData.length, status },
  });
});
