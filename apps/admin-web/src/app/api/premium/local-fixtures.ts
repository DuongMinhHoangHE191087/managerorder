import type { ShellNotification, ShellNotificationSeverity } from "@/shared/types/shell";

const DAY_MS = 24 * 60 * 60 * 1000;

type LocalRelation = {
  name: string;
  slug: string;
  logo_url: string | null;
};

type LocalPackage = {
  name: string;
  slug: string;
  total_slots: number;
};

type LocalPremiumAccountRow = {
  id: string;
  account_id: string;
  service_type_id: string;
  package_id: string;
  primary_email: string;
  primary_password_encrypted: string;
  total_slots: number;
  used_slots: number;
  available_slots: number;
  subscription_start_date: string;
  subscription_expiry_date: string;
  subscription_renewal_count: number;
  billing_cycle: "1month" | "3months" | "6months" | "1year";
  days_remaining: number;
  status: "active" | "expired" | "suspended" | "cancelled";
  connection_status: "working" | "error" | "manual_check_needed" | null;
  last_connection_check_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  service: LocalRelation | null;
  package: LocalPackage | null;
};

type LocalPremiumAccountRef = {
  id: string;
  primary_email: string;
  service_type_id: string;
  total_slots: number;
  used_slots: number;
  available_slots: number;
  status: string | null;
};

type LocalMigrationRow = {
  id: string;
  account_id: string;
  subscription_id: string;
  customer_id: string;
  source_account_id: string;
  target_account_id: string;
  source_account_email: string | null;
  target_account_email: string | null;
  reason: string | null;
  initiated_by: string | null;
  status: "pending" | "in_progress" | "completed" | "failed" | "rollback";
  started_at: string;
  completed_at: string | null;
  details: Record<string, unknown> | null;
  error_log: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string;
  source_account: LocalPremiumAccountRef | null;
  target_account: LocalPremiumAccountRef | null;
};

type LocalRenewalRow = {
  id: string;
  renewal_requested_date: string;
  renewal_price: number;
  original_price: number;
  status: "pending";
};

type LocalSourceAccountRow = {
  id: string;
  email: string;
  max_slots: number;
  used_slots: number;
  expires_at: string;
  updated_at: string;
  created_at: string;
};

type LocalPremiumHealthCheckResult = {
  premium_account_id: string;
  email: string;
  status: "working" | "error" | "unknown";
  log_id: string;
  previous_status: string | null;
};

function offsetIso(days: number, hours = 0): string {
  return new Date(Date.now() + days * DAY_MS + hours * 60 * 60 * 1000).toISOString();
}

function daysUntil(dateValue?: string | null) {
  if (!dateValue) {
    return null;
  }

  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  return Math.ceil((target.getTime() - Date.now()) / DAY_MS);
}

function sortByCreatedAtDesc<T extends { created_at?: string; createdAt?: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) =>
      new Date((right.created_at ?? right.createdAt ?? "") as string).getTime() -
      new Date((left.created_at ?? left.createdAt ?? "") as string).getTime(),
  );
}

function daysRemainingFromExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / DAY_MS);
}

function createLocalAccountTemplate(params: {
  id: string;
  service_type_id: string;
  package_id: string;
  service: LocalRelation;
  package: LocalPackage;
  primary_email: string;
  total_slots: number;
  used_slots: number;
  start_offset_days: number;
  expiry_offset_days: number;
  status: LocalPremiumAccountRow["status"];
  connection_status: LocalPremiumAccountRow["connection_status"];
  billing_cycle: LocalPremiumAccountRow["billing_cycle"];
  notes?: string | null;
  last_connection_check_offset_days?: number | null;
}): Omit<LocalPremiumAccountRow, "account_id"> {
  const subscription_start_date = offsetIso(params.start_offset_days);
  const subscription_expiry_date = offsetIso(params.expiry_offset_days);
  const now = Date.now();
  const last_connection_check_at =
    params.last_connection_check_offset_days === undefined || params.last_connection_check_offset_days === null
      ? null
      : new Date(now + params.last_connection_check_offset_days * DAY_MS).toISOString();

  return {
    id: params.id,
    service_type_id: params.service_type_id,
    package_id: params.package_id,
    primary_email: params.primary_email,
    primary_password_encrypted: "local-fallback-encrypted",
    total_slots: params.total_slots,
    used_slots: params.used_slots,
    available_slots: Math.max(params.total_slots - params.used_slots, 0),
    subscription_renewal_count: 1,
    billing_cycle: params.billing_cycle,
    days_remaining: daysRemainingFromExpiry(subscription_expiry_date),
    status: params.status,
    connection_status: params.connection_status,
    last_connection_check_at,
    notes: params.notes ?? null,
    created_at: offsetIso(params.start_offset_days - 1),
    updated_at: offsetIso(params.expiry_offset_days - 1),
    deleted_at: null,
    service: params.service,
    package: params.package,
    subscription_start_date,
    subscription_expiry_date,
  };
}

const LOCAL_ACCOUNT_TEMPLATES = [
  createLocalAccountTemplate({
    id: "premium-local-netflix",
    service_type_id: "svc-netflix-local",
    package_id: "pkg-netflix-local",
    service: { name: "Netflix", slug: "netflix", logo_url: null },
    package: { name: "Standard 5", slug: "standard-5", total_slots: 5 },
    primary_email: "netflix-team@local",
    total_slots: 5,
    used_slots: 4,
    start_offset_days: -28,
    expiry_offset_days: 5,
    status: "active",
    connection_status: "manual_check_needed",
    billing_cycle: "1month",
    notes: "Sandbox fallback account for offline smoke.",
    last_connection_check_offset_days: -1,
  }),
  createLocalAccountTemplate({
    id: "premium-local-spotify",
    service_type_id: "svc-spotify-local",
    package_id: "pkg-spotify-local",
    service: { name: "Spotify", slug: "spotify", logo_url: null },
    package: { name: "Studio 10", slug: "studio-10", total_slots: 10 },
    primary_email: "spotify-main@local",
    total_slots: 10,
    used_slots: 7,
    start_offset_days: -42,
    expiry_offset_days: 18,
    status: "active",
    connection_status: "working",
    billing_cycle: "3months",
    notes: "Healthy sandbox fallback account.",
    last_connection_check_offset_days: -2,
  }),
  createLocalAccountTemplate({
    id: "premium-local-youtube",
    service_type_id: "svc-youtube-local",
    package_id: "pkg-youtube-local",
    service: { name: "YouTube Premium", slug: "youtube-premium", logo_url: null },
    package: { name: "Basic 4", slug: "basic-4", total_slots: 4 },
    primary_email: "youtube-backup@local",
    total_slots: 4,
    used_slots: 4,
    start_offset_days: -63,
    expiry_offset_days: -2,
    status: "expired",
    connection_status: "error",
    billing_cycle: "1year",
    notes: "Expired on purpose to surface warnings in the UI.",
    last_connection_check_offset_days: -3,
  }),
] as const;

const LOCAL_MIGRATION_TEMPLATES = [
  {
    id: "mig-local-pending",
    status: "pending" as const,
    customer_id: "cust-local-1",
    customer_name: "Nguyen Minh Anh",
    subscription_id: "sub-local-1",
    source_account_id: "premium-local-netflix",
    target_account_id: "premium-local-spotify",
    source_account_email: "netflix-team@local",
    target_account_email: "spotify-main@local",
    reason: "Chuyen goi dang sap het slot sang kho on dinh hon",
    initiated_by: "system",
    started_at: offsetIso(-1, -4),
    completed_at: null,
    details: { phase: "preflight", sandbox: true },
    error_log: null,
    notes: "Fallback payload for runtime smoke.",
    created_at: offsetIso(-1, -4),
    updated_at: offsetIso(-1, -4),
  },
  {
    id: "mig-local-in-progress",
    status: "in_progress" as const,
    customer_id: "cust-local-2",
    customer_name: "Tran Hoang Long",
    subscription_id: "sub-local-2",
    source_account_id: "premium-local-youtube",
    target_account_id: "premium-local-spotify",
    source_account_email: "youtube-backup@local",
    target_account_email: "spotify-main@local",
    reason: "Testing in-progress migration flow",
    initiated_by: "admin",
    started_at: offsetIso(-1, -1),
    completed_at: null,
    details: { phase: "copy", sandbox: true },
    error_log: null,
    notes: null,
    created_at: offsetIso(-1, -1),
    updated_at: offsetIso(-1, -1),
  },
  {
    id: "mig-local-completed",
    status: "completed" as const,
    customer_id: "cust-local-3",
    customer_name: "Le Gia Han",
    subscription_id: "sub-local-3",
    source_account_id: "premium-local-spotify",
    target_account_id: "premium-local-netflix",
    source_account_email: "spotify-main@local",
    target_account_email: "netflix-team@local",
    reason: "Gop nhieu slot ve kho chinh",
    initiated_by: "admin",
    started_at: offsetIso(-3),
    completed_at: offsetIso(-3, 2),
    details: { phase: "completed", sandbox: true },
    error_log: null,
    notes: "Completed in sandbox fallback mode.",
    created_at: offsetIso(-3),
    updated_at: offsetIso(-3, 2),
  },
  {
    id: "mig-local-failed",
    status: "failed" as const,
    customer_id: "cust-local-4",
    customer_name: "Pham Quang Huy",
    subscription_id: "sub-local-4",
    source_account_id: "premium-local-youtube",
    target_account_id: "premium-local-netflix",
    source_account_email: "youtube-backup@local",
    target_account_email: "netflix-team@local",
    reason: "Force failure row for audit visibility",
    initiated_by: "system",
    started_at: offsetIso(-2, -2),
    completed_at: null,
    details: { phase: "rollback", sandbox: true },
    error_log: "Target account unavailable in sandbox fixture",
    notes: null,
    created_at: offsetIso(-2, -2),
    updated_at: offsetIso(-2, -1),
  },
] as const;

function buildLocalAccountRef(account: LocalPremiumAccountRow): LocalPremiumAccountRef {
  return {
    id: account.id,
    primary_email: account.primary_email,
    service_type_id: account.service_type_id,
    total_slots: account.total_slots,
    used_slots: account.used_slots,
    available_slots: account.available_slots,
    status: account.status,
  };
}

function resolvePremiumHealthSeverity(
  connectionStatus: string | null,
): ShellNotificationSeverity {
  return connectionStatus === "manual_check_needed" ? "warning" : "critical";
}

function buildPremiumHealthNotification(
  account: LocalPremiumAccountRow,
): ShellNotification {
  const title =
    account.connection_status === "manual_check_needed"
      ? "Tài khoản premium cần kiểm tra thủ công"
      : "Tài khoản premium đang lỗi kết nối";

  return {
    id: `premium-health:${account.id}`,
    kind: "premium_health",
    title,
    description:
      account.notes?.trim() ||
      `${account.primary_email} cần được kiểm tra lại trạng thái kết nối.`,
    href: "/premium/accounts",
    severity: resolvePremiumHealthSeverity(account.connection_status),
    createdAt: account.last_connection_check_at ?? account.updated_at ?? account.created_at,
    isRead: false,
  };
}

function buildRenewalNotification(renewal: LocalRenewalRow): ShellNotification {
  return {
    id: `renewal:${renewal.id}`,
    kind: "renewal",
    title: "Yêu cầu gia hạn đang chờ xử lý",
    description: `Cần xác nhận gia hạn cho yêu cầu ${renewal.id.slice(0, 8)} với mức phí ${
      renewal.renewal_price ?? renewal.original_price
    }.`,
    href: "/premium/renewals",
    severity: "warning",
    createdAt: renewal.renewal_requested_date,
    isRead: false,
  };
}

function buildMigrationNotification(migration: LocalMigrationRow): ShellNotification {
  return {
    id: `migration:${migration.id}`,
    kind: "migration",
    title: "Yêu cầu chuyển đổi đang chờ",
    description: `Cần xử lý chuyển từ ${
      migration.source_account_email ?? "tài khoản nguồn"
    } sang ${migration.target_account_email ?? "tài khoản đích"}.`,
    href: "/premium/migrations",
    severity: "warning",
    createdAt: migration.created_at,
    isRead: false,
  };
}

function buildInventoryNotifications(sourceAccounts: LocalSourceAccountRow[]): ShellNotification[] {
  const notifications: ShellNotification[] = [];

  for (const account of sourceAccounts) {
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

  return notifications;
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

function buildLocalRenewals(): LocalRenewalRow[] {
  return [
    {
      id: "ren-local-1",
      renewal_requested_date: offsetIso(-1, -2),
      renewal_price: 120000,
      original_price: 150000,
      status: "pending",
    },
    {
      id: "ren-local-2",
      renewal_requested_date: offsetIso(-2, -5),
      renewal_price: 180000,
      original_price: 200000,
      status: "pending",
    },
  ];
}

function buildLocalSourceAccounts(): LocalSourceAccountRow[] {
  return [
    {
      id: "source-local-1",
      email: "warehouse-a@local",
      max_slots: 8,
      used_slots: 8,
      expires_at: offsetIso(2),
      updated_at: offsetIso(-1, -6),
      created_at: offsetIso(-25),
    },
    {
      id: "source-local-2",
      email: "warehouse-b@local",
      max_slots: 12,
      used_slots: 11,
      expires_at: offsetIso(6),
      updated_at: offsetIso(-1, -4),
      created_at: offsetIso(-18),
    },
    {
      id: "source-local-3",
      email: "warehouse-c@local",
      max_slots: 6,
      used_slots: 2,
      expires_at: offsetIso(14),
      updated_at: offsetIso(-1, -2),
      created_at: offsetIso(-12),
    },
  ];
}

export function buildLocalPremiumHealthCheckRun(
  accountId: string,
  options?: {
    premiumAccountId?: string | null;
    checkType?: "api" | "manual" | "scheduled";
    notes?: string | null;
  },
): {
  checked: number;
  failed: number;
  results: LocalPremiumHealthCheckResult[];
  errors: Array<{ premium_account_id: string; error: string }>;
} {
  const accounts = buildLocalPremiumAccounts(accountId).filter((account) => account.status === "active");
  const filteredAccounts = options?.premiumAccountId
    ? accounts.filter((account) => account.id === options.premiumAccountId)
    : accounts;

  const results = filteredAccounts.map((account) => ({
    premium_account_id: account.id,
    email: account.primary_email,
    status: (
      account.connection_status === "working"
        ? "working"
        : account.connection_status === "error"
          ? "error"
          : "unknown"
    ) as LocalPremiumHealthCheckResult["status"],
    log_id: `local-health:${account.id}`,
    previous_status: account.connection_status ?? null,
  }));

  return {
    checked: results.length,
    failed: 0,
    results,
    errors: [],
  };
}

export function shouldUseLocalPremiumFallback(error: unknown): boolean {
  if (process.env.CODEX_DISABLE_LOCAL_FALLBACK === "1") {
    return false;
  }

  if (process.env.CODEX_USE_LOCAL_FALLBACK === "1") {
    return true;
  }

  const signals = collectErrorSignals(error).map((signal) => signal.toLowerCase());
  return signals.some((signal) =>
    [
      "fetch failed",
      "eacces",
      "enotfound",
      "econnrefused",
      "econnreset",
      "etimedout",
      "eai_again",
      "ehostunreach",
      "network request failed",
    ].some((pattern) => signal.includes(pattern)),
  );
}

export function shouldPreferLocalPremiumFixtures(): boolean {
  return process.env.NODE_ENV === "development" && process.env.CODEX_DISABLE_LOCAL_FALLBACK !== "1";
}

function collectErrorSignals(error: unknown, seen = new Set<unknown>()): string[] {
  if (error === null || error === undefined) {
    return [];
  }

  if (typeof error === "string") {
    return [error];
  }

  if (typeof error !== "object" && typeof error !== "function") {
    return [String(error)];
  }

  if (seen.has(error)) {
    return [];
  }

  seen.add(error);

  const record = error as Record<string, unknown>;
  const signals: string[] = [];

  if (typeof record.name === "string") {
    signals.push(record.name);
  }
  if (typeof record.message === "string") {
    signals.push(record.message);
  }
  if (typeof record.code === "string") {
    signals.push(record.code);
  }
  if (typeof record.errno === "string" || typeof record.errno === "number") {
    signals.push(String(record.errno));
  }
  if (typeof record.syscall === "string") {
    signals.push(record.syscall);
  }

  if ("cause" in record) {
    signals.push(...collectErrorSignals(record.cause, seen));
  }

  if (Array.isArray(record.errors)) {
    for (const item of record.errors) {
      signals.push(...collectErrorSignals(item, seen));
    }
  }

  return signals;
}

export function buildLocalPremiumAccounts(accountId: string): LocalPremiumAccountRow[] {
  return sortByCreatedAtDesc(
    LOCAL_ACCOUNT_TEMPLATES.map((template) => ({
      account_id: accountId,
      ...template,
    })),
  );
}

export function buildLocalPremiumMigrations(
  accountId: string,
  status: string,
): LocalMigrationRow[] {
  const accountRows = buildLocalPremiumAccounts(accountId);
  const accountMap = new Map(accountRows.map((account) => [account.id, account] as const));

  return sortByCreatedAtDesc(
    LOCAL_MIGRATION_TEMPLATES.filter((migration) => migration.status === status).map(
      (migration) => {
        const sourceAccount = accountMap.get(migration.source_account_id) ?? null;
        const targetAccount = accountMap.get(migration.target_account_id) ?? null;

        return {
          ...migration,
          account_id: accountId,
          source_account: sourceAccount ? buildLocalAccountRef(sourceAccount) : null,
          target_account: targetAccount ? buildLocalAccountRef(targetAccount) : null,
        };
      },
    ),
  );
}

export function buildLocalNotificationsFeed(limit: number): ShellNotification[] {
  const accountRows = buildLocalPremiumAccounts("sandbox-account");
  const renewals = buildLocalRenewals();
  const sourceAccounts = buildLocalSourceAccounts();
  const pendingMigrations = buildLocalPremiumMigrations("sandbox-account", "pending");

  const notifications: ShellNotification[] = [
    ...renewals.map(buildRenewalNotification),
    ...pendingMigrations.map(buildMigrationNotification),
    ...accountRows
      .filter(
        (account) =>
          account.connection_status === "error" ||
          account.connection_status === "manual_check_needed",
      )
      .map(buildPremiumHealthNotification),
    ...buildInventoryNotifications(sourceAccounts),
  ];

  return sortNotifications(notifications, limit);
}
