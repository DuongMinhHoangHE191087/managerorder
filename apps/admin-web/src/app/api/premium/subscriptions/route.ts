import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";

export const GET = withFlatAccountHandler(async (_request, { accountId }) => {
  const { data: baseSubscriptions, error } = await supabaseAdmin
    .from("customer_premium_subscriptions")
    .select("*")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const customerIds = [
    ...new Set(
      (baseSubscriptions ?? [])
        .map((item) => item.customer_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const premiumAccountIds = [
    ...new Set(
      (baseSubscriptions ?? [])
        .map((item) => item.premium_account_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const premiumAccountUserIds = [
    ...new Set(
      (baseSubscriptions ?? [])
        .map((item) => item.premium_account_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [customersMap, accountsMap, packagesMap, usersMap] = await Promise.all([
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
      [
        ...new Set(
          (baseSubscriptions ?? [])
            .map((item) => item.package_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
      "id, default_price, renewal_price_factor",
    ),
    loadRowsByIds<{
      id: string;
      user_email: string;
      status: string;
    }>(
      supabaseAdmin,
      "premium_account_users",
      accountId,
      premiumAccountUserIds,
      "id, user_email, status",
    ),
  ]);

  const serviceTypeIds = [
    ...new Set(
      [...accountsMap.values()]
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

  const formattedData = (baseSubscriptions ?? []).map((item) => {
    const account = accountsMap.get(item.premium_account_id) ?? null;
    const customer = customersMap.get(item.customer_id) ?? null;
    const premiumAccountUser = item.premium_account_user_id
      ? usersMap.get(item.premium_account_user_id) ?? null
      : null;
    const packageRow = item.package_id ? packagesMap.get(item.package_id) ?? null : null;
    const service = account?.service_type_id
      ? serviceTypeMap.get(account.service_type_id) ?? null
      : null;

    return {
      ...item,
      customer,
      account: account
        ? {
            ...account,
            service,
          }
        : null,
      premium_account_users: premiumAccountUser,
      customer_name: customer?.full_name ?? "N/A",
      account_email: account?.primary_email ?? "N/A",
      service_name: service?.name ?? "N/A",
      package_default_price: packageRow?.default_price ?? null,
      renewal_price_factor: packageRow?.renewal_price_factor ?? null,
    };
  });

  return createFlatSuccessResponse(formattedData, {
    meta: { total: formattedData.length },
  });
});
