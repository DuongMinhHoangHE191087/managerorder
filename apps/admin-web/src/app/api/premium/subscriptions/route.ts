import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";
import { matchesSearchQuery } from "@/shared/lib/filtering/search";

type DueStateFilter = "all" | "expired" | "expiring" | "safe";
type RenewalStateFilter =
  | "all"
  | "actionable"
  | "eligible"
  | "blocked"
  | "none"
  | "pending"
  | "confirmed"
  | "denied"
  | "not_renewing";
type SubscriptionStatusFilter =
  | "all"
  | "active"
  | "non_active"
  | "waiting_renewal"
  | "renewed"
  | "expired"
  | "migrated"
  | "refunded"
  | "suspended";
type SortMode = "expiry_asc" | "expiry_desc" | "customer_asc" | "purchase_desc";
type AccountBindingFilter = "all" | "linked" | "placeholder";
type OrderStatusFilter = "all" | "none" | "pending_payment" | "paid" | "provisioning" | "active" | "expired" | "refunded" | "cancelled";

type LatestRenewalRow = {
  id: string;
  original_subscription_id: string;
  status: string;
  renewal_requested_date: string | null;
  renewal_confirmed_date: string | null;
  renewal_price: number | null;
  total_price: number | null;
  new_billing_cycle: string | null;
  new_cycle_months: number | null;
  cost_price: number | null;
  collected_amount: number | null;
  profit_amount: number | null;
  new_product_id: string | null;
  new_product_name_snapshot: string | null;
  new_product_duration_months: number | null;
  new_product_sell_price_vnd: number | null;
  new_product_buy_price_vnd: number | null;
  customer_response: string | null;
  customer_response_date: string | null;
  decline_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SubscriptionApiRow = {
  id: string;
  account_id: string;
  customer_id: string;
  order_id: string | null;
  premium_account_id: string;
  premium_account_user_id: string | null;
  service_type_id: string;
  package_id: string;
  purchase_date: string;
  billing_cycle: string;
  cycle_months: number;
  start_date: string;
  expiry_date: string;
  days_remaining: number;
  original_price: number;
  final_price: number;
  discount: number;
  renewal_status: string;
  status: string;
  notes: string | null;
  refund_amount: number | null;
  renewal_asked_at: string | null;
  renewal_confirmed_at: string | null;
  renewal_denied_at: string | null;
  renewal_denied_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer_name: string;
  account_email: string;
  service_name: string;
  package_name: string;
  order_code: string | null;
  order_contact_snapshot: string | null;
  order_product_name: string | null;
  order_sales_note: string | null;
  order_status: string | null;
  sales_channel_id: string | null;
  sales_channel_name: string | null;
  package_default_price: number | null;
  renewal_price_factor: number | null;
  premium_account_users: {
    id: string;
    user_email: string;
    status: string;
  } | null;
  latest_renewal: LatestRenewalRow | null;
  latest_renewal_status: string | null;
  reminder_message: string;
  can_renew: boolean;
  can_mark_no_renew: boolean;
  renewal_block_reason: string | null;
  no_renew_block_reason: string | null;
  placeholder_account: boolean;
};

const LATEST_RENEWAL_SELECT =
  "id, original_subscription_id, status, renewal_requested_date, renewal_confirmed_date, renewal_price, total_price, new_billing_cycle, new_cycle_months, cost_price, collected_amount, profit_amount, new_product_id, new_product_name_snapshot, new_product_duration_months, new_product_sell_price_vnd, new_product_buy_price_vnd, customer_response, customer_response_date, decline_reason, notes, created_at, updated_at";

const LEGACY_LATEST_RENEWAL_SELECT =
  "id, original_subscription_id, status, renewal_requested_date, renewal_confirmed_date, renewal_price, total_price, new_billing_cycle, new_cycle_months, cost_price, collected_amount, profit_amount, customer_response, customer_response_date, decline_reason, notes, created_at, updated_at";

function isMissingRenewalProductSnapshotColumn(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error ?? "");

  return message.includes("new_product_") && (
    message.includes("column")
    || message.includes("schema cache")
    || message.includes("Could not find")
  );
}

function normalizeLatestRenewalRow(row: Partial<LatestRenewalRow>): LatestRenewalRow {
  return {
    id: String(row.id ?? ""),
    original_subscription_id: String(row.original_subscription_id ?? ""),
    status: String(row.status ?? "pending"),
    renewal_requested_date: row.renewal_requested_date ?? null,
    renewal_confirmed_date: row.renewal_confirmed_date ?? null,
    renewal_price: row.renewal_price ?? null,
    total_price: row.total_price ?? null,
    new_billing_cycle: row.new_billing_cycle ?? null,
    new_cycle_months: row.new_cycle_months ?? null,
    cost_price: row.cost_price ?? null,
    collected_amount: row.collected_amount ?? null,
    profit_amount: row.profit_amount ?? null,
    new_product_id: row.new_product_id ?? null,
    new_product_name_snapshot: row.new_product_name_snapshot ?? null,
    new_product_duration_months: row.new_product_duration_months ?? null,
    new_product_sell_price_vnd: row.new_product_sell_price_vnd ?? null,
    new_product_buy_price_vnd: row.new_product_buy_price_vnd ?? null,
    customer_response: row.customer_response ?? null,
    customer_response_date: row.customer_response_date ?? null,
    decline_reason: row.decline_reason ?? null,
    notes: row.notes ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function getDueState(daysRemaining: number) {
  if (daysRemaining <= 0) {
    return "expired";
  }

  if (daysRemaining <= 7) {
    return "expiring";
  }

  return "safe";
}

function monthKeyFromDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function computeDaysRemaining(expiryDate?: string | null) {
  if (!expiryDate) {
    return 0;
  }

  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const now = new Date();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((parsed.getTime() - now.getTime()) / millisecondsPerDay);
}

function canRenewSubscription(row: SubscriptionApiRow) {
  return (
    (row.status === "active" || row.status === "expired") &&
    row.renewal_status !== "pending" &&
    row.renewal_status !== "not_renewing"
  );
}

function buildReminderMessage(row: {
  customer_name: string;
  service_name: string;
  package_name?: string | null;
  account_email?: string | null;
  expiry_date?: string | null;
  days_remaining?: number | null;
  order_code?: string | null;
}) {
  const expiryDate = row.expiry_date ? new Date(row.expiry_date) : null;
  const expiryLabel = expiryDate && !Number.isNaN(expiryDate.getTime())
    ? expiryDate.toLocaleDateString("vi-VN")
    : "ngày hết hạn hiện tại";
  const remaining = Number(row.days_remaining ?? 0);
  const dueText = remaining <= 0
    ? `đã quá hạn ${Math.abs(remaining)} ngày`
    : `còn ${remaining} ngày`;
  const orderText = row.order_code ? `, mã đơn ${row.order_code}` : "";

  return `Chào ${row.customer_name}, gói ${row.service_name}${row.package_name ? ` - ${row.package_name}` : ""}${orderText} sẽ hết hạn ${expiryLabel} (${dueText}). Anh/chị xác nhận giúp em gói và số tháng muốn gia hạn để em xử lý tiếp.`;
}

function getSortWeight(row: SubscriptionApiRow) {
  if (row.renewal_status === "not_renewing" || row.status === "refunded" || row.status === "migrated") {
    return 2;
  }
  return 1;
}

function compareSubscriptions(left: SubscriptionApiRow, right: SubscriptionApiRow, sortBy: SortMode) {
  if (sortBy === "customer_asc") {
    return left.customer_name.localeCompare(right.customer_name, "vi");
  }

  if (sortBy === "purchase_desc") {
    return new Date(right.purchase_date).getTime() - new Date(left.purchase_date).getTime();
  }

  const weightLeft = getSortWeight(left);
  const weightRight = getSortWeight(right);
  if (weightLeft !== weightRight) {
    return weightLeft - weightRight;
  }

  if (sortBy === "expiry_desc") {
    return new Date(right.expiry_date).getTime() - new Date(left.expiry_date).getTime();
  }

  return new Date(left.expiry_date).getTime() - new Date(right.expiry_date).getTime();
}

function buildSummary(rows: SubscriptionApiRow[]) {
  return {
    total: rows.length,
    eligibleCount: rows.filter((row) => canRenewSubscription(row)).length,
    blockedCount: rows.filter((row) => !canRenewSubscription(row)).length,
    activeCount: rows.filter((row) => row.status === "active").length,
    expiredCount: rows.filter((row) => row.days_remaining <= 0).length,
    expiringCount: rows.filter((row) => row.days_remaining > 0 && row.days_remaining <= 7).length,
    pendingCount: rows.filter((row) => row.renewal_status === "pending").length,
    notRenewingCount: rows.filter((row) => row.renewal_status === "not_renewing").length,
  };
}

function buildFilterOptions(rows: SubscriptionApiRow[]) {
  const serviceMap = new Map<string, { value: string; label: string; count: number }>();
  const packageMap = new Map<string, { value: string; label: string; count: number }>();
  const channelMap = new Map<string, { value: string; label: string; count: number }>();
  const monthMap = new Map<string, { value: string; label: string; count: number }>();
  const orderStatusMap = new Map<string, { value: string; label: string; count: number }>();
  const subscriptionStatusMap = new Map<string, { value: string; label: string; count: number }>();

  for (const row of rows) {
    const serviceKey = row.service_name || "N/A";
    const existingService = serviceMap.get(serviceKey);
    serviceMap.set(serviceKey, {
      value: serviceKey,
      label: serviceKey,
      count: (existingService?.count ?? 0) + 1,
    });

    const packageKey = row.package_id;
    const existingPackage = packageMap.get(packageKey);
    packageMap.set(packageKey, {
      value: packageKey,
      label: row.package_name || packageKey,
      count: (existingPackage?.count ?? 0) + 1,
    });

    const channelKey = row.sales_channel_id ?? "none";
    const existingChannel = channelMap.get(channelKey);
    channelMap.set(channelKey, {
      value: channelKey,
      label: row.sales_channel_name ?? "Không có CTV/kênh bán",
      count: (existingChannel?.count ?? 0) + 1,
    });

    const orderStatusKey = row.order_status ?? "none";
    const existingOrderStatus = orderStatusMap.get(orderStatusKey);
    orderStatusMap.set(orderStatusKey, {
      value: orderStatusKey,
      label:
        orderStatusKey === "none"
          ? "Không có đơn"
          : orderStatusKey === "pending_payment"
            ? "Chờ thanh toán"
            : orderStatusKey === "paid"
              ? "Đã thanh toán"
              : orderStatusKey === "provisioning"
                ? "Đang cấp phát"
                : orderStatusKey === "active"
                  ? "Đang hoạt động"
                  : orderStatusKey === "expired"
                    ? "Hết hạn"
                    : orderStatusKey === "refunded"
                      ? "Hoàn tiền"
                      : orderStatusKey === "cancelled"
                        ? "Đã huỷ"
                        : orderStatusKey,
      count: (existingOrderStatus?.count ?? 0) + 1,
    });

    const subscriptionStatusKey = row.status || "non_active";
    const existingSubscriptionStatus = subscriptionStatusMap.get(subscriptionStatusKey);
    subscriptionStatusMap.set(subscriptionStatusKey, {
      value: subscriptionStatusKey,
      label:
        subscriptionStatusKey === "active"
          ? "Đang active"
          : subscriptionStatusKey === "expired"
            ? "Hết hạn"
            : subscriptionStatusKey === "waiting_renewal"
              ? "Chờ gia hạn"
              : subscriptionStatusKey === "renewed"
                ? "Đã gia hạn"
                : subscriptionStatusKey === "migrated"
                  ? "Đã migration"
                  : subscriptionStatusKey === "refunded"
                    ? "Đã hoàn tiền"
                    : subscriptionStatusKey === "suspended"
                      ? "Tạm ngưng"
                      : subscriptionStatusKey === "non_active"
                        ? "Không active"
                        : subscriptionStatusKey,
      count: (existingSubscriptionStatus?.count ?? 0) + 1,
    });

    const monthKey = monthKeyFromDate(row.expiry_date);
    if (monthKey) {
      const existingMonth = monthMap.get(monthKey);
      monthMap.set(monthKey, {
        value: monthKey,
        label: monthKey,
        count: (existingMonth?.count ?? 0) + 1,
      });
    }
  }

  return {
    services: [...serviceMap.values()].sort((left, right) => left.label.localeCompare(right.label, "vi")),
    packages: [...packageMap.values()].sort((left, right) => left.label.localeCompare(right.label, "vi")),
    salesChannels: [...channelMap.values()].sort((left, right) => left.label.localeCompare(right.label, "vi")),
    orderStatuses: [...orderStatusMap.values()],
    subscriptionStatuses: [...subscriptionStatusMap.values()],
    expiryMonths: [...monthMap.values()].sort((left, right) => left.value.localeCompare(right.value)),
  };
}

function buildBindingSummary(rows: SubscriptionApiRow[]) {
  const placeholderAccounts = rows.filter((row) => row.placeholder_account).length;
  const linkedAccounts = rows.length - placeholderAccounts;

  return {
    placeholderAccounts,
    linkedAccounts,
  };
}

function getRenewalBlockReason(row: Pick<SubscriptionApiRow, "status" | "renewal_status">) {
  if (row.renewal_status === "not_renewing") {
    return "Đã đánh dấu không gia hạn";
  }

  if (row.renewal_status === "pending") {
    return "Đã có yêu cầu gia hạn chờ duyệt";
  }

  if (row.status === "active" || row.status === "expired") {
    return null;
  }

  if (row.status === "waiting_renewal") {
    return "Thuê bao đang chờ gia hạn";
  }

  if (row.status === "suspended") {
    return "Thuê bao đang tạm ngưng";
  }

  if (row.status === "refunded") {
    return "Thuê bao đã hoàn tiền";
  }

  if (row.status === "migrated") {
    return "Thuê bao đã migration";
  }

  return `Thuê bao đang ở trạng thái ${row.status}`;
}

function applySubscriptionFilters(
  rows: SubscriptionApiRow[],
  filters: {
    search: string;
    serviceName: string;
    packageId: string;
    salesChannelId: string;
    expiryMonth: string;
    dueState: DueStateFilter;
    renewalState: RenewalStateFilter;
    subscriptionStatus: SubscriptionStatusFilter;
    accountBinding: AccountBindingFilter;
    orderStatus: OrderStatusFilter;
    sortBy: SortMode;
  },
) {
  return rows
    .filter((row) => {
      const dueState = getDueState(Number(row.days_remaining ?? 0));
      const eligible = canRenewSubscription(row);

      if (filters.serviceName !== "all" && row.service_name !== filters.serviceName) {
        return false;
      }
      if (filters.packageId !== "all" && row.package_id !== filters.packageId) {
        return false;
      }
      if (filters.salesChannelId !== "all") {
        if (filters.salesChannelId === "none") {
          if (row.sales_channel_id) {
            return false;
          }
        } else if (row.sales_channel_id !== filters.salesChannelId) {
          return false;
        }
      }
      if (filters.expiryMonth !== "all" && monthKeyFromDate(row.expiry_date) !== filters.expiryMonth) {
        return false;
      }
      if (filters.dueState !== "all" && dueState !== filters.dueState) {
        return false;
      }
      if (filters.subscriptionStatus === "active" && row.status !== "active") {
        return false;
      }
      if (filters.subscriptionStatus === "non_active" && row.status === "active") {
        return false;
      }
      if (
        filters.subscriptionStatus !== "all" &&
        filters.subscriptionStatus !== "active" &&
        filters.subscriptionStatus !== "non_active" &&
        row.status !== filters.subscriptionStatus
      ) {
        return false;
      }
      if (filters.accountBinding === "linked" && row.placeholder_account) {
        return false;
      }
      if (filters.accountBinding === "placeholder" && !row.placeholder_account) {
        return false;
      }
      if (filters.orderStatus === "none" && row.order_status) {
        return false;
      }
      if (
        filters.orderStatus !== "all" &&
        filters.orderStatus !== "none" &&
        row.order_status !== filters.orderStatus
      ) {
        return false;
      }
      if (filters.renewalState === "actionable" && row.renewal_status === "not_renewing") {
        return false;
      }
      if (filters.renewalState === "eligible" && !eligible) {
        return false;
      }
      if (filters.renewalState === "blocked" && eligible) {
        return false;
      }
      if (
        filters.renewalState !== "all" &&
        filters.renewalState !== "actionable" &&
        filters.renewalState !== "eligible" &&
        filters.renewalState !== "blocked" &&
        row.renewal_status !== filters.renewalState
      ) {
        return false;
      }

      if (!filters.search.trim()) {
        return true;
      }

      return matchesSearchQuery(
        filters.search,
        row.id,
        row.order_id,
        row.order_code,
        row.customer_name,
        row.service_name,
        row.package_name,
        row.account_email,
        row.sales_channel_name,
        row.premium_account_users?.user_email,
        row.order_contact_snapshot,
        row.order_product_name,
        row.order_sales_note,
        row.notes,
        row.latest_renewal?.id,
        row.latest_renewal?.new_product_name_snapshot,
        row.latest_renewal?.decline_reason,
        row.latest_renewal?.notes,
      );
    })
    .sort((left, right) => compareSubscriptions(left, right, filters.sortBy));
}

export const GET = withFlatAccountHandler(async (request, { accountId }) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const serviceName = searchParams.get("service_name") ?? "all";
  const packageId = searchParams.get("package_id") ?? "all";
  const salesChannelId = searchParams.get("sales_channel_id") ?? "all";
  const expiryMonth = searchParams.get("expiry_month") ?? "all";
  const dueState = (searchParams.get("due_state") ?? "all") as DueStateFilter;
  const renewalState = (searchParams.get("renewal_state") ?? "actionable") as RenewalStateFilter;
  const subscriptionStatus = (searchParams.get("subscription_status") ?? "all") as SubscriptionStatusFilter;
  const accountBinding = (searchParams.get("account_binding") ?? "all") as AccountBindingFilter;
  const orderStatus = (searchParams.get("order_status") ?? "all") as OrderStatusFilter;
  const sortBy = (searchParams.get("sort_by") ?? "expiry_asc") as SortMode;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(48, Math.max(1, Number(searchParams.get("page_size") ?? 12) || 12));

  const { data: baseSubscriptions, error } = await supabaseAdmin
    .from("customer_premium_subscriptions")
    .select("*")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const [{ count: premiumAccountsCount, error: premiumAccountsCountError }, { count: ordersCount, error: ordersCountError }] =
    await Promise.all([
      supabaseAdmin
        .from("premium_accounts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId),
    ]);

  if (premiumAccountsCountError) {
    throw premiumAccountsCountError;
  }

  if (ordersCountError) {
    throw ordersCountError;
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
  const orderIds = [
    ...new Set(
      (baseSubscriptions ?? [])
        .map((item) => item.order_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const packageIds = [
    ...new Set(
      (baseSubscriptions ?? [])
        .map((item) => item.package_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const subscriptionIds = [
    ...new Set(
      (baseSubscriptions ?? [])
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [customersMap, accountsMap, packagesMap, usersMap, ordersMap] = await Promise.all([
    loadRowsByIds<{
      id: string;
      full_name: string;
    }>(supabaseAdmin, "customers", accountId, customerIds, "id, full_name"),
    loadRowsByIds<{
      id: string;
      primary_email: string;
      service_type_id: string;
    }>(supabaseAdmin, "premium_accounts", accountId, premiumAccountIds, "id, primary_email, service_type_id"),
    loadRowsByIds<{
      id: string;
      name: string;
      default_price: number | null;
      renewal_price_factor: number | null;
    }>(supabaseAdmin, "premium_packages", accountId, packageIds, "id, name, default_price, renewal_price_factor"),
    loadRowsByIds<{
      id: string;
      user_email: string;
      status: string;
    }>(supabaseAdmin, "premium_account_users", accountId, premiumAccountUserIds, "id, user_email, status"),
    loadRowsByIds<{
      id: string;
      order_code: string | null;
      contact_snapshot: string | null;
      product_name_snapshot: string | null;
      sales_note: string | null;
      status: string;
      sales_channel_id: string | null;
    }>(
      supabaseAdmin,
      "orders",
      accountId,
      orderIds,
      "id, order_code, contact_snapshot, product_name_snapshot, sales_note, status, sales_channel_id",
    ),
  ]);

  const salesChannelIds = [
    ...new Set(
      [...ordersMap.values()]
        .map((item) => item.sales_channel_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [salesChannelMap, serviceTypeMap] = await Promise.all([
    loadRowsByIds<{
      id: string;
      name: string;
    }>(supabaseAdmin, "sales_channels", accountId, salesChannelIds, "id, name"),
    loadRowsByIds<{
      id: string;
      name: string;
    }>(
      supabaseAdmin,
      "premium_service_types",
      accountId,
      [
        ...new Set(
          [...accountsMap.values()]
            .map((item) => item.service_type_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
      "id, name",
    ),
  ]);

  const latestRenewalMap = new Map<string, LatestRenewalRow>();
  if (subscriptionIds.length > 0) {
    let { data: renewalRows, error: renewalRowsError } = await supabaseAdmin
      .from("subscription_renewals")
      .select(LATEST_RENEWAL_SELECT)
      .eq("account_id", accountId)
      .in("original_subscription_id", subscriptionIds)
      .order("created_at", { ascending: false });

    if (renewalRowsError && isMissingRenewalProductSnapshotColumn(renewalRowsError)) {
      const legacyResult = await supabaseAdmin
        .from("subscription_renewals")
        .select(LEGACY_LATEST_RENEWAL_SELECT)
        .eq("account_id", accountId)
        .in("original_subscription_id", subscriptionIds)
        .order("created_at", { ascending: false });
      renewalRows = legacyResult.data
        ? legacyResult.data.map((row) => ({
            ...row,
            new_product_id: null,
            new_product_name_snapshot: null,
            new_product_duration_months: null,
            new_product_sell_price_vnd: null,
            new_product_buy_price_vnd: null,
          }))
        : null;
      renewalRowsError = legacyResult.error;
    }

    if (renewalRowsError) {
      throw renewalRowsError;
    }

    for (const row of (renewalRows ?? []) as Partial<LatestRenewalRow>[]) {
      const renewal = normalizeLatestRenewalRow(row);
      if (!latestRenewalMap.has(renewal.original_subscription_id)) {
        latestRenewalMap.set(renewal.original_subscription_id, renewal);
      }
    }
  }

  const formattedData: SubscriptionApiRow[] = (baseSubscriptions ?? []).map((item) => {
    const account = accountsMap.get(item.premium_account_id) ?? null;
    const customer = customersMap.get(item.customer_id) ?? null;
    const premiumAccountUser = item.premium_account_user_id
      ? usersMap.get(item.premium_account_user_id) ?? null
      : null;
    const order = item.order_id ? ordersMap.get(item.order_id) ?? null : null;
    const packageRow = item.package_id ? packagesMap.get(item.package_id) ?? null : null;
    const service = account?.service_type_id
      ? serviceTypeMap.get(account.service_type_id) ?? null
      : null;
    const salesChannel = order?.sales_channel_id
      ? salesChannelMap.get(order.sales_channel_id) ?? null
      : null;
    const latestRenewal = latestRenewalMap.get(item.id) ?? null;
    const rowBase = {
      ...item,
      days_remaining: computeDaysRemaining(item.expiry_date),
      customer_name: customer?.full_name ?? "N/A",
      account_email: account?.primary_email ?? "N/A",
      service_name: service?.name ?? "N/A",
      package_name: packageRow?.name ?? "N/A",
      order_code: order?.order_code ?? null,
      order_contact_snapshot: order?.contact_snapshot ?? null,
      order_product_name: order?.product_name_snapshot ?? null,
      order_sales_note: order?.sales_note ?? null,
      order_status: order?.status ?? null,
      sales_channel_id: salesChannel?.id ?? null,
      sales_channel_name: salesChannel?.name ?? null,
      package_default_price: packageRow?.default_price ?? null,
      renewal_price_factor: packageRow?.renewal_price_factor ?? null,
      premium_account_users: premiumAccountUser,
      latest_renewal: latestRenewal,
      latest_renewal_status: latestRenewal?.status ?? null,
      placeholder_account: account?.primary_email?.endsWith("@orders.managerorder.local") ?? false,
    };
    const canRenew =
      (rowBase.status === "active" || rowBase.status === "expired") &&
      rowBase.renewal_status !== "pending" &&
      rowBase.renewal_status !== "not_renewing";
    const renewalBlockReason = canRenew ? null : getRenewalBlockReason(rowBase);
    const canMarkNoRenew =
      (rowBase.status === "active" || rowBase.status === "expired") &&
      rowBase.renewal_status !== "not_renewing";

    return {
      ...rowBase,
      can_renew: canRenew,
      can_mark_no_renew: canMarkNoRenew,
      renewal_block_reason: renewalBlockReason,
      no_renew_block_reason: canMarkNoRenew ? null : "Đã đánh dấu không gia hạn",
      reminder_message: buildReminderMessage(rowBase),
    };
  });

  const bindingSummary = buildBindingSummary(formattedData);

  const filteredData = applySubscriptionFilters(formattedData, {
    search,
    serviceName,
    packageId,
    salesChannelId,
    expiryMonth,
    dueState,
    renewalState,
    subscriptionStatus,
    accountBinding,
    orderStatus,
    sortBy,
  });

  const totalFiltered = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const startIndex = (normalizedPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  return createFlatSuccessResponse(paginatedData, {
    meta: {
      total: totalFiltered,
      summary: buildSummary(filteredData),
      overallSummary: buildSummary(formattedData),
      filters: buildFilterOptions(formattedData),
      sourceState: {
        premiumSubscriptions: formattedData.length,
        premiumAccounts: premiumAccountsCount ?? 0,
        orders: ordersCount ?? 0,
        paidOrdersReady:
          formattedData.filter((row) =>
            row.order_status === "paid" || row.order_status === "active" || row.order_status === "provisioning",
          ).length,
        placeholderAccounts: bindingSummary.placeholderAccounts,
        linkedAccounts: bindingSummary.linkedAccounts,
      },
      pagination: {
        page: normalizedPage,
        pageSize,
        totalPages,
        totalItems: totalFiltered,
        start: totalFiltered === 0 ? 0 : startIndex + 1,
        end: Math.min(startIndex + pageSize, totalFiltered),
      },
      applied: {
        search,
        serviceName,
        packageId,
        salesChannelId,
        expiryMonth,
        dueState,
        renewalState,
        subscriptionStatus,
        accountBinding,
        orderStatus,
        sortBy,
      },
    },
  });
});
