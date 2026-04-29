import { z } from "zod";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createActivityLog, getActivityLogsPaginated } from "@/lib/supabase/repositories/activity-logs.repo";
import type { AdminHistoryMeta } from "@/lib/types/admin-history";
import type {
  PremiumAccountDetailViewModel,
  PremiumAccountHealthCheckSummary,
  PremiumAccountUpdatePayload,
} from "@/lib/types/premium-admin";
import { encryptPremiumPassword } from "@/lib/utils/premium-account-credentials";
import { ApplicationError, ConflictError } from "@/lib/utils/errors";
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";
import {
  buildLocalPremiumAccountMigrations,
  buildLocalPremiumAccountUsers,
  buildLocalPremiumActivityLogs,
  buildLocalPremiumHealthLogs,
  buildLocalPremiumRenewals,
  buildLocalPremiumSubscriptions,
  findLocalPremiumAccount,
  shouldUseLocalPremiumFallback,
} from "@/app/api/premium/local-fixtures";

type PremiumAccountWithRelations = {
  service?: {
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
  package?: {
    name: string;
    slug: string;
    total_slots: number;
  } | null;
};

type PremiumAccountBaseRow = {
  id: string;
  account_id: string;
  service_type_id: string;
  package_id: string;
  primary_email: string;
  primary_password_encrypted: string;
  phone_number: string | null;
  total_slots: number;
  used_slots: number;
  subscription_start_date: string | null;
  subscription_expiry_date: string | null;
  status: "active" | "expired" | "suspended" | "cancelled";
  connection_status: "working" | "error" | "manual_check_needed" | null;
  last_connection_check_at: string | null;
  purchase_invoice_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SubscriptionRow = {
  id: string;
  customer_id: string;
  premium_account_user_id: string | null;
  service_type_id: string;
  package_id: string;
  billing_cycle: string;
  cycle_months: number;
  start_date: string;
  expiry_date: string;
  original_price: number;
  final_price: number;
  renewal_status: string;
  status: string;
  migrated_at: string | null;
  migration_id: string | null;
  created_at: string;
};

type PremiumAccountUserRow = {
  id: string;
  user_email: string;
  status: "active" | "removed" | "suspended";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type RenewalRow = {
  id: string;
  customer_id: string;
  original_subscription_id: string;
  renewal_requested_date: string;
  renewal_confirmed_date: string | null;
  renewal_price: number | null;
  original_price: number | null;
  status: string;
};

type MigrationRow = {
  id: string;
  customer_id: string;
  subscription_id: string;
  source_account_id: string;
  target_account_id: string;
  created_at: string;
  completed_at: string | null;
  status: string;
  reason: string | null;
  notes: string | null;
  details: Record<string, unknown> | null;
};

type CustomerRow = {
  id: string;
  full_name: string;
};

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

type PackageRow = {
  id: string;
  name: string;
  slug: string;
  total_slots: number;
};

type HealthLogRow = PremiumAccountHealthCheckSummary & {
  premium_account_id: string;
};

const updateAccountSchema = z
  .object({
    primary_email: z.string().email("Email không hợp lệ").optional(),
    primary_password: z.string().min(1, "Mật khẩu không được để trống").optional(),
    package_id: z.string().min(1, "Gói cước không hợp lệ").optional(),
    phone_number: z.string().trim().max(50, "Số điện thoại quá dài").nullable().optional(),
    total_slots: z.number().int().min(1, "Số slot phải lớn hơn 0").optional(),
    subscription_start_date: z
      .string()
      .nullable()
      .optional()
      .refine((value) => value === null || value === undefined || !Number.isNaN(Date.parse(value)), "Ngày bắt đầu không hợp lệ"),
    subscription_expiry_date: z
      .string()
      .nullable()
      .optional()
      .refine((value) => value === null || value === undefined || !Number.isNaN(Date.parse(value)), "Ngày hết hạn không hợp lệ"),
    status: z.enum(["active", "expired", "suspended", "cancelled"]).optional(),
    connection_status: z.enum(["working", "error", "manual_check_needed"]).nullable().optional(),
    purchase_invoice_url: z.string().trim().max(500, "Đường dẫn hoá đơn quá dài").nullable().optional(),
    notes: z.string().trim().max(2000, "Ghi chú không được vượt quá 2000 ký tự").nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Không có trường nào để cập nhật",
  });

function formatPremiumAccountRow<T extends PremiumAccountWithRelations>(account: T): T {
  return {
    ...account,
    service: account.service
      ? {
          name: account.service.name,
          slug: account.service.slug,
          logo_url: account.service.logo_url,
        }
      : null,
    package: account.package
      ? {
          name: account.package.name,
          slug: account.package.slug,
          total_slots: account.package.total_slots,
        }
      : null,
  };
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function computeDaysRemaining(dateValue: string | null) {
  if (!dateValue) {
    return 0;
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  return Math.ceil((parsed.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

async function buildLocalPremiumAccountDetail(
  accountId: string,
  premiumAccountId: string,
  auditPage: number,
  auditLimit: number,
): Promise<PremiumAccountDetailViewModel | null> {
  const account = findLocalPremiumAccount(accountId, premiumAccountId);
  if (!account) {
    return null;
  }

  const subscriptions = buildLocalPremiumSubscriptions(accountId, premiumAccountId);
  const users = buildLocalPremiumAccountUsers(accountId, premiumAccountId);
  const renewals = buildLocalPremiumRenewals(accountId, premiumAccountId);
  const migrations = buildLocalPremiumAccountMigrations(accountId, premiumAccountId);
  const healthChecks = buildLocalPremiumHealthLogs(accountId, premiumAccountId);
  const auditRows = buildLocalPremiumActivityLogs(accountId, premiumAccountId);
  const auditOffset = (auditPage - 1) * auditLimit;
  const auditItems = auditRows.slice(auditOffset, auditOffset + auditLimit);
  const activeSubscriptions = subscriptions.filter((item) => item.status === "active");
  const expiringSubscriptions = activeSubscriptions.filter(
    (item) => computeDaysRemaining(item.expiry_date) > 0 && computeDaysRemaining(item.expiry_date) <= 7,
  );

  return {
    ...account,
    phone_number: null,
    purchase_invoice_url: null,
    metrics: {
      available_slots: account.available_slots,
      slot_fill_rate: account.total_slots > 0 ? Number(((account.used_slots / account.total_slots) * 100).toFixed(1)) : 0,
      active_subscription_count: activeSubscriptions.length,
      expiring_subscription_count: expiringSubscriptions.length,
      user_count: users.length,
      active_user_count: users.filter((user) => user.status === "active").length,
      pending_renewal_count: renewals.filter((renewal) => renewal.status === "pending").length,
      pending_migration_count: migrations.filter((migration) => migration.status === "pending").length,
    },
    subscriptions: subscriptions.map((subscription) => ({
      ...subscription,
      days_remaining: computeDaysRemaining(subscription.expiry_date),
    })),
    users,
    renewals,
    migrations: migrations.map((migration) => ({
      ...migration,
      terminal_reason:
        typeof migration.details?.terminal_reason === "string"
          ? migration.details.terminal_reason
          : null,
    })),
    healthChecks,
    audit: {
      items: auditItems,
      meta: {
        count: auditRows.length,
        page: auditPage,
        limit: auditLimit,
        totalPages: Math.ceil(auditRows.length / auditLimit) || 1,
      },
    },
    isLocalFixture: true,
  };
}

async function loadPremiumAccountDetail(
  accountId: string,
  premiumAccountId: string,
  auditPage: number,
  auditLimit: number,
): Promise<PremiumAccountDetailViewModel | null> {
  const preferLocalPremiumFixtures =
    process.env.NODE_ENV === "development" &&
    process.env.CODEX_DISABLE_LOCAL_FALLBACK !== "1";

  if (preferLocalPremiumFixtures) {
    const localDetail = await buildLocalPremiumAccountDetail(accountId, premiumAccountId, auditPage, auditLimit);
    if (localDetail) {
      return localDetail;
    }
  }

  try {
    const { data: baseAccount, error: accountError } = await supabaseAdmin
      .from("premium_accounts")
      .select("*")
      .eq("id", premiumAccountId)
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .single();

    if (accountError || !baseAccount) {
      return null;
    }

    const typedAccount = baseAccount as PremiumAccountBaseRow;
    const serviceTypeIds = [typedAccount.service_type_id];
    const packageIds = [typedAccount.package_id];

    const [
      serviceMap,
      packageMap,
      subscriptionsResult,
      usersResult,
      renewalsResult,
      migrationsResult,
      healthChecksResult,
      auditResult,
    ] = await Promise.all([
      loadRowsByIds<ServiceRow>(
        supabaseAdmin,
        "premium_service_types",
        accountId,
        serviceTypeIds,
        "id, name, slug, logo_url",
      ),
      loadRowsByIds<PackageRow>(
        supabaseAdmin,
        "premium_packages",
        accountId,
        packageIds,
        "id, name, slug, total_slots",
      ),
      supabaseAdmin
        .from("customer_premium_subscriptions")
        .select(
          "id, customer_id, premium_account_user_id, service_type_id, package_id, billing_cycle, cycle_months, start_date, expiry_date, original_price, final_price, renewal_status, status, migrated_at, migration_id, created_at",
        )
        .eq("account_id", accountId)
        .eq("premium_account_id", premiumAccountId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("premium_account_users")
        .select("id, user_email, status, created_at, updated_at, deleted_at")
        .eq("account_id", accountId)
        .eq("premium_account_id", premiumAccountId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("subscription_renewals")
        .select(
          "id, customer_id, original_subscription_id, renewal_requested_date, renewal_confirmed_date, renewal_price, total_price, new_billing_cycle, new_cycle_months, cost_price, collected_amount, profit_amount, original_price, status, notes",
        )
        .eq("account_id", accountId)
        .eq("premium_account_id", premiumAccountId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("account_migrations")
        .select(
          "id, customer_id, subscription_id, source_account_id, target_account_id, created_at, completed_at, status, reason, notes, details",
        )
        .eq("account_id", accountId)
        .or(`source_account_id.eq.${premiumAccountId},target_account_id.eq.${premiumAccountId}`)
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("premium_account_health_logs")
        .select("id, premium_account_id, check_timestamp, check_type, current_status, previous_status, error_message")
        .eq("account_id", accountId)
        .eq("premium_account_id", premiumAccountId)
        .order("check_timestamp", { ascending: false })
        .limit(12),
      getActivityLogsPaginated(accountId, {
        page: auditPage,
        limit: auditLimit,
        sourceAccountId: premiumAccountId,
      }),
    ]);

    if (subscriptionsResult.error) {
      throw subscriptionsResult.error;
    }
    if (usersResult.error) {
      throw usersResult.error;
    }
    if (renewalsResult.error) {
      throw renewalsResult.error;
    }
    if (migrationsResult.error) {
      throw migrationsResult.error;
    }
    if (healthChecksResult.error) {
      throw healthChecksResult.error;
    }

    const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
    const users = (usersResult.data ?? []) as PremiumAccountUserRow[];
    const renewals = (renewalsResult.data ?? []) as RenewalRow[];
    const migrations = (migrationsResult.data ?? []) as MigrationRow[];
    const healthChecks = (healthChecksResult.data ?? []) as HealthLogRow[];
    const customerIds = [
      ...new Set(
        [...subscriptions, ...renewals, ...migrations]
          .map((item) => item.customer_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const customerMap = await loadRowsByIds<CustomerRow>(
      supabaseAdmin,
      "customers",
      accountId,
      customerIds,
      "id, full_name",
    );
    const userEmailById = new Map(users.map((user) => [user.id, user.user_email] as const));
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "active");
    const expiringSubscriptions = activeSubscriptions.filter((subscription) => {
      const daysRemaining = computeDaysRemaining(subscription.expiry_date);
      return daysRemaining > 0 && daysRemaining <= 7;
    });

    return {
      ...formatPremiumAccountRow({
        ...typedAccount,
        available_slots: Math.max(typedAccount.total_slots - typedAccount.used_slots, 0),
        service: serviceMap.get(typedAccount.service_type_id) ?? null,
        package: packageMap.get(typedAccount.package_id) ?? null,
      }),
      metrics: {
        available_slots: Math.max(typedAccount.total_slots - typedAccount.used_slots, 0),
        slot_fill_rate:
          typedAccount.total_slots > 0
            ? Number(((typedAccount.used_slots / typedAccount.total_slots) * 100).toFixed(1))
            : 0,
        active_subscription_count: activeSubscriptions.length,
        expiring_subscription_count: expiringSubscriptions.length,
        user_count: users.length,
        active_user_count: users.filter((user) => user.status === "active").length,
        pending_renewal_count: renewals.filter((renewal) => renewal.status === "pending").length,
        pending_migration_count: migrations.filter((migration) => migration.status === "pending").length,
      },
      subscriptions: subscriptions.map((subscription) => ({
        ...subscription,
        customer_name: customerMap.get(subscription.customer_id)?.full_name ?? "N/A",
        premium_account_user_email: subscription.premium_account_user_id
          ? userEmailById.get(subscription.premium_account_user_id) ?? null
          : null,
        days_remaining: computeDaysRemaining(subscription.expiry_date),
      })),
      users,
      renewals: renewals.map((renewal) => ({
        ...renewal,
        customer_name: customerMap.get(renewal.customer_id)?.full_name ?? "N/A",
      })),
      migrations: migrations.map((migration) => ({
        ...migration,
        customer_name: customerMap.get(migration.customer_id)?.full_name ?? "N/A",
        terminal_reason:
          typeof migration.details?.terminal_reason === "string"
            ? migration.details.terminal_reason
            : null,
      })),
      healthChecks,
      audit: {
        items: auditResult.data.map((item) => ({
          id: item.id,
          action_type: item.action_type,
          created_at: item.created_at,
          created_by: item.created_by ?? null,
          details:
            item.details && typeof item.details === "object"
              ? (item.details as Record<string, unknown>)
              : null,
        })),
        meta: auditResult.meta as AdminHistoryMeta,
      },
    };
  } catch (error) {
    if (shouldUseLocalPremiumFallback(error)) {
      return buildLocalPremiumAccountDetail(accountId, premiumAccountId, auditPage, auditLimit);
    }

    throw error;
  }
}

export const GET = withFlatAccountHandler<{ id: string }>(async (request, { params, accountId }) => {
  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const auditPage = parsePositiveInt(searchParams.get("audit_page"), 1, 200);
  const auditLimit = parsePositiveInt(searchParams.get("audit_limit"), 10, 50);

  if (!id) {
    throw new ApplicationError("Thiếu ID tài khoản", 400, "MISSING_ID");
  }

  const detail = await loadPremiumAccountDetail(accountId, id, auditPage, auditLimit);

  if (!detail) {
    throw new ApplicationError("Không tìm thấy tài khoản premium", 404, "PREMIUM_ACCOUNT_NOT_FOUND");
  }

  return createFlatSuccessResponse(detail, {
    meta: {
      audit_page: auditPage,
      audit_limit: auditLimit,
    },
  });
});

export const PATCH = withFlatAccountHandler<{ id: string }>(async (request, { params, accountId }) => {
  const { id } = await params;

  if (!id) {
    throw new ApplicationError("Thiếu ID tài khoản", 400, "MISSING_ID");
  }

  const body = await request.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApplicationError(
      parsed.error.issues[0]?.message ?? "Dữ liệu cập nhật không hợp lệ",
      400,
      "VALIDATION_ERROR",
    );
  }

  const localFixture = findLocalPremiumAccount(accountId, id);
  const preferLocalPremiumFixtures =
    process.env.NODE_ENV === "development" &&
    process.env.CODEX_DISABLE_LOCAL_FALLBACK !== "1";

  if (preferLocalPremiumFixtures && localFixture) {
    const detail = await buildLocalPremiumAccountDetail(accountId, id, 1, 10);
    if (!detail) {
      throw new ApplicationError("Không tìm thấy tài khoản premium", 404, "PREMIUM_ACCOUNT_NOT_FOUND");
    }

    const patch = parsed.data as PremiumAccountUpdatePayload;
    const updatedFixture = {
      ...detail,
      ...patch,
      phone_number: patch.phone_number ?? detail.phone_number,
      purchase_invoice_url: patch.purchase_invoice_url ?? detail.purchase_invoice_url,
      notes: patch.notes ?? detail.notes,
      total_slots: patch.total_slots ?? detail.total_slots,
      package_id: patch.package_id ?? detail.package_id,
      primary_email: patch.primary_email ?? detail.primary_email,
      subscription_start_date: patch.subscription_start_date ?? detail.subscription_start_date,
      subscription_expiry_date: patch.subscription_expiry_date ?? detail.subscription_expiry_date,
      status: patch.status ?? detail.status,
      connection_status: patch.connection_status ?? detail.connection_status,
      updated_at: new Date().toISOString(),
      isLocalFixture: true,
    };

    return createFlatSuccessResponse(updatedFixture);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("premium_accounts")
    .select("*")
    .eq("id", id)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .single();

  if (existingError || !existing) {
    throw new ApplicationError("Không tìm thấy tài khoản premium", 404, "PREMIUM_ACCOUNT_NOT_FOUND");
  }

  const currentAccount = existing as PremiumAccountBaseRow;
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const patch = parsed.data as PremiumAccountUpdatePayload;

  if (patch.primary_email !== undefined) {
    updatePayload.primary_email = patch.primary_email;
  }
  if (patch.primary_password) {
    updatePayload.primary_password_encrypted = encryptPremiumPassword(patch.primary_password);
  }
  if (patch.package_id !== undefined) {
    updatePayload.package_id = patch.package_id;
  }
  if (patch.phone_number !== undefined) {
    updatePayload.phone_number = patch.phone_number;
  }
  if (patch.subscription_start_date !== undefined) {
    updatePayload.subscription_start_date = patch.subscription_start_date;
  }
  if (patch.subscription_expiry_date !== undefined) {
    updatePayload.subscription_expiry_date = patch.subscription_expiry_date;
  }
  if (patch.status !== undefined) {
    updatePayload.status = patch.status;
  }
  if (patch.connection_status !== undefined) {
    updatePayload.connection_status = patch.connection_status;
  }
  if (patch.purchase_invoice_url !== undefined) {
    updatePayload.purchase_invoice_url = patch.purchase_invoice_url;
  }
  if (patch.notes !== undefined) {
    updatePayload.notes = patch.notes;
  }
  if (patch.total_slots !== undefined) {
    if (patch.total_slots < currentAccount.used_slots) {
      throw new ConflictError("Số slot mới không thể nhỏ hơn số slot đang sử dụng.");
    }
    updatePayload.total_slots = patch.total_slots;
  }

  const { error: updateError } = await supabaseAdmin
    .from("premium_accounts")
    .update(updatePayload)
    .eq("id", id)
    .eq("account_id", accountId);

  if ((updateError as { code?: string } | null)?.code === "23505") {
    throw new ConflictError("Email tài khoản này đã tồn tại trong hệ thống.");
  }

  if (updateError) {
    throw updateError;
  }

  await createActivityLog({
    account_id: accountId,
    source_account_id: id,
    action_type: "PREMIUM_ACCOUNT_UPDATED",
    details: {
      premium_account_id: id,
      changed_fields: Object.keys(updatePayload).filter((field) => field !== "updated_at"),
      before: {
        primary_email: currentAccount.primary_email,
        package_id: currentAccount.package_id,
        total_slots: currentAccount.total_slots,
        subscription_expiry_date: currentAccount.subscription_expiry_date,
        status: currentAccount.status,
        connection_status: currentAccount.connection_status,
      },
      after: {
        primary_email: patch.primary_email ?? currentAccount.primary_email,
        package_id: patch.package_id ?? currentAccount.package_id,
        total_slots: patch.total_slots ?? currentAccount.total_slots,
        subscription_expiry_date:
          patch.subscription_expiry_date ?? currentAccount.subscription_expiry_date,
        status: patch.status ?? currentAccount.status,
        connection_status: patch.connection_status ?? currentAccount.connection_status,
      },
    },
  });

  const detail = await loadPremiumAccountDetail(accountId, id, 1, 10);
  if (!detail) {
    throw new ApplicationError("Không thể tải lại tài khoản premium sau cập nhật", 500, "PREMIUM_ACCOUNT_RELOAD_FAILED");
  }

  return createFlatSuccessResponse(detail);
});

export const DELETE = withFlatAccountHandler<{ id: string }>(
  async (_request, { params, accountId }) => {
    const { id } = await params;

    if (!id) {
      throw new ApplicationError("Thiếu ID tài khoản", 400, "MISSING_ID");
    }

    const localFixture = findLocalPremiumAccount(accountId, id);
    const preferLocalPremiumFixtures =
      process.env.NODE_ENV === "development" &&
      process.env.CODEX_DISABLE_LOCAL_FALLBACK !== "1";

    if (preferLocalPremiumFixtures && localFixture) {
      return createFlatSuccessResponse({ id, deleted: true, isLocalFixture: true }, { status: 200 });
    }

    const { error } = await supabaseAdmin
      .from("premium_accounts")
      .delete()
      .eq("id", id)
      .eq("account_id", accountId);

    if ((error as { code?: string } | null)?.code === "23503") {
      throw new ApplicationError(
        "Tài khoản đang được liên kết dữ liệu khác, không thể xóa.",
        409,
        "PREMIUM_ACCOUNT_IN_USE",
      );
    }

    if (error) {
      throw error;
    }

    await createActivityLog({
      account_id: accountId,
      source_account_id: id,
      action_type: "PREMIUM_ACCOUNT_DELETED",
      details: {
        premium_account_id: id,
      },
    });

    return createFlatSuccessResponse({ id }, { status: 200 });
  },
);
