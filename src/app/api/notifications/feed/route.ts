import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import type {
  ShellNotification,
  ShellNotificationSeverity,
} from "@/shared/types/shell";

function daysUntil(dateValue?: string | null) {
  if (!dateValue) {
    return null;
  }

  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const diff = target.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function sortNotifications(
  items: ShellNotification[],
  limit: number,
): ShellNotification[] {
  return [...items]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, limit);
}

function resolvePremiumHealthSeverity(
  connectionStatus: string | null,
): ShellNotificationSeverity {
  return connectionStatus === "manual_check_needed" ? "warning" : "critical";
}

function resolveHealthLogSeverity(
  currentStatus: string | null | undefined,
  hasErrorMessage: boolean,
): ShellNotificationSeverity {
  if (currentStatus === "manual_check_needed") {
    return "warning";
  }

  if (currentStatus === "error" || hasErrorMessage) {
    return "critical";
  }

  return "warning";
}

function buildPremiumHealthNotification(
  account: {
    id: string;
    primary_email: string;
    connection_status: string | null;
    updated_at: string | null;
    created_at: string;
  },
  latestLog?: {
    error_message: string | null;
    check_timestamp: string;
    created_at: string;
    current_status?: string | null;
  },
): ShellNotification {
  return {
    id: `premium-health:${account.id}`,
    kind: "premium_health",
    title:
      account.connection_status === "manual_check_needed"
        ? "Tài khoản premium cần kiểm tra thủ công"
        : "Tài khoản premium đang lỗi kết nối",
    description:
      latestLog?.error_message?.trim() ||
      `${account.primary_email} cần được kiểm tra lại trạng thái kết nối.`,
    href: "/premium/accounts",
    severity: resolvePremiumHealthSeverity(account.connection_status),
    createdAt: latestLog?.check_timestamp ?? account.updated_at ?? account.created_at,
    isRead: false,
  };
}

function buildPremiumHealthNotificationsFromLogs(
  logs: Array<{
    premium_account_id: string;
    error_message: string | null;
    check_timestamp: string;
    created_at: string;
    current_status?: string | null;
  }>,
): ShellNotification[] {
  const latestLogByAccount = new Map<string, (typeof logs)[number]>();

  for (const log of logs) {
    if (!latestLogByAccount.has(log.premium_account_id)) {
      latestLogByAccount.set(log.premium_account_id, log);
    }
  }

  return [...latestLogByAccount.values()]
    .filter(
      (log) =>
        log.current_status !== "working" || Boolean(log.error_message?.trim()),
    )
    .map((log) => ({
      id: `premium-health:${log.premium_account_id}`,
      kind: "premium_health" as const,
      title:
        log.current_status === "error"
          ? "Tài khoản premium đang lỗi kết nối"
          : "Tài khoản premium cần kiểm tra",
      description:
        log.error_message?.trim() ||
        `Cần kiểm tra lại trạng thái kết nối của tài khoản ${log.premium_account_id.slice(0, 8)}.`,
      href: "/premium/accounts",
      severity: resolveHealthLogSeverity(
        log.current_status,
        Boolean(log.error_message?.trim()),
      ),
      createdAt: log.check_timestamp ?? log.created_at,
      isRead: false,
    }));
}

export const GET = withFlatAccountHandler(async (request, { accountId }) => {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 20)
    : 10;

  const [
    renewalsResult,
    migrationsResult,
    premiumHealthAccountsResult,
    premiumHealthLogsResult,
    sourceAccountsResult,
  ] =
    await Promise.all([
      supabaseAdmin
        .from("subscription_renewals")
        .select("id, renewal_requested_date, renewal_price, original_price, status")
        .eq("account_id", accountId)
        .eq("status", "pending")
        .order("renewal_requested_date", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("account_migrations")
        .select("id, created_at, status, source_account_email, target_account_email")
        .eq("account_id", accountId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("premium_accounts")
        .select("id, primary_email, connection_status, updated_at, created_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .in("connection_status", ["error", "manual_check_needed"])
        .order("updated_at", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("premium_account_health_logs")
        .select(
          "premium_account_id, error_message, check_timestamp, created_at, current_status",
        )
        .eq("account_id", accountId)
        .order("check_timestamp", { ascending: false })
        .limit(24),
      supabaseAdmin
        .from("source_accounts")
        .select("id, email, max_slots, used_slots, expires_at, updated_at, created_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

  if (renewalsResult.error) {
    throw renewalsResult.error;
  }
  if (migrationsResult.error) {
    throw migrationsResult.error;
  }
  if (premiumHealthLogsResult.error) {
    throw premiumHealthLogsResult.error;
  }
  if (sourceAccountsResult.error) {
    throw sourceAccountsResult.error;
  }

  const latestHealthLogByAccount = new Map<
    string,
    { error_message: string | null; check_timestamp: string; created_at: string }
  >();

  for (const log of premiumHealthLogsResult.data ?? []) {
    if (!latestHealthLogByAccount.has(log.premium_account_id)) {
      latestHealthLogByAccount.set(log.premium_account_id, log);
    }
  }

  const premiumHealthNotifications = premiumHealthAccountsResult.error
    ? buildPremiumHealthNotificationsFromLogs(premiumHealthLogsResult.data ?? [])
    : (premiumHealthAccountsResult.data ?? []).map((account) =>
        buildPremiumHealthNotification(
          account,
          latestHealthLogByAccount.get(account.id),
        ),
      );

  const notifications: ShellNotification[] = [
    ...(renewalsResult.data ?? []).map((renewal) => ({
      id: `renewal:${renewal.id}`,
      kind: "renewal" as const,
      title: "Yêu cầu gia hạn đang chờ xử lý",
      description: `Cần xác nhận gia hạn cho yêu cầu ${renewal.id.slice(0, 8)} với mức phí ${
        renewal.renewal_price ?? renewal.original_price
      }.`,
      href: "/premium/renewals",
      severity: "warning" as const,
      createdAt: renewal.renewal_requested_date,
      isRead: false,
    })),
    ...(migrationsResult.data ?? []).map((migration) => ({
      id: `migration:${migration.id}`,
      kind: "migration" as const,
      title: "Yêu cầu chuyển đổi đang chờ",
      description: `Cần xử lý chuyển từ ${
        migration.source_account_email ?? "tài khoản nguồn"
      } sang ${migration.target_account_email ?? "tài khoản đích"}.`,
      href: "/premium/migrations",
      severity: "warning" as const,
      createdAt: migration.created_at,
      isRead: false,
    })),
    ...premiumHealthNotifications,
  ];

  for (const account of sourceAccountsResult.data ?? []) {
    const remainingSlots = Math.max(account.max_slots - account.used_slots, 0);
    const expiryDays = daysUntil(account.expires_at);

    if (account.max_slots > 0 && remainingSlots === 0) {
      notifications.push({
        id: `inventory-capacity:${account.id}`,
        kind: "inventory_capacity",
        title: "Kho đã đầy slot",
        description: `${account.email} đã dùng hết ${account.max_slots} slot và cần được mở rộng hoặc thay thế.`,
        href: "/inventory",
        severity: "critical",
        createdAt: account.updated_at ?? account.created_at,
        isRead: false,
      });
    }

    if (expiryDays !== null && expiryDays >= 0 && expiryDays <= 7) {
      notifications.push({
        id: `inventory-expiry:${account.id}`,
        kind: "inventory_expiry",
        title: "Kho sắp hết hạn",
        description: `${account.email} sẽ hết hạn trong ${expiryDays} ngày.`,
        href: "/inventory",
        severity: expiryDays <= 3 ? "critical" : "warning",
        createdAt: account.expires_at ?? account.updated_at ?? account.created_at,
        isRead: false,
      });
    }
  }

  return createFlatSuccessResponse(sortNotifications(notifications, limit));
});
