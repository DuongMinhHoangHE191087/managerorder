import { NextRequest } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from "@/lib/utils/api-helpers";
import {
  decrementUsedSlots,
  incrementUsedSlots,
} from "@/lib/utils/migrations-helpers";
import {
  buildLocalPremiumAccountMigrations,
  shouldPreferLocalPremiumFixtures,
} from "@/app/api/premium/local-fixtures";

type MigrationAction = "start" | "complete" | "fail" | "cancel";

type MigrationRow = {
  id: string;
  account_id: string;
  subscription_id: string;
  customer_id: string;
  source_account_id: string;
  target_account_id: string;
  source_account_email: string | null;
  target_account_email: string | null;
  source_user_id: string | null;
  target_user_id: string | null;
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
  deleted_at: string | null;
};

type SubscriptionRow = {
  id: string;
  account_id: string;
  customer_id: string;
  premium_account_id: string;
  premium_account_user_id: string | null;
  service_type_id: string;
  package_id: string;
  billing_cycle: string;
  cycle_months: number;
  start_date: string;
  expiry_date: string;
  original_price: number;
  final_price: number;
  status: string;
};

type PremiumAccountRow = {
  id: string;
  primary_email: string;
  service_type_id: string;
  total_slots: number;
  used_slots: number;
  status: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseBody(body: unknown): {
  action?: MigrationAction;
  target_account_id?: string;
  reason?: string | null;
  notes?: string | null;
  failure_reason?: string | null;
  target_user_id?: string | null;
  create_target_user?: { user_email?: string; notes?: string | null } | null;
} {
  return isRecord(body) ? body : {};
}

function mergeDetails(
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
) {
  return {
    ...(current ?? {}),
    ...patch,
  };
}

async function appendMigrationStep(
  migrationId: string,
  accountId: string,
  stepNumber: number,
  stepName: string,
  status: "pending" | "in_progress" | "completed" | "failed",
  details?: Record<string, unknown>,
  errorMessage?: string | null,
) {
  const now = new Date().toISOString();

  await supabase.from("account_migration_history").insert({
    migration_id: migrationId,
    account_id: accountId,
    step_number: stepNumber,
    step_name: stepName,
    step_status: status,
    details: details ?? null,
    error_message: errorMessage ?? null,
    started_at: now,
    completed_at: now,
  });
}

async function getNextMigrationStepNumber(migrationId: string) {
  const { data: steps } = await supabase
    .from("account_migration_history")
    .select("step_number")
    .eq("migration_id", migrationId)
    .order("step_number", { ascending: true });

  return (steps?.at(-1)?.step_number ?? 0) + 1;
}

async function hydrateMigration(accountId: string, baseMigration: MigrationRow) {
  const [sourceAccountMap, targetAccountMap, customerMap] = await Promise.all([
    loadRowsByIds<{
      id: string;
      primary_email: string;
      status: string;
      service_type_id: string;
      total_slots: number;
      used_slots: number;
    }>(
      supabase,
      "premium_accounts",
      accountId,
      [baseMigration.source_account_id],
      "id, primary_email, status, service_type_id, total_slots, used_slots",
    ),
    loadRowsByIds<{
      id: string;
      primary_email: string;
      status: string;
      service_type_id: string;
      total_slots: number;
      used_slots: number;
    }>(
      supabase,
      "premium_accounts",
      accountId,
      [baseMigration.target_account_id],
      "id, primary_email, status, service_type_id, total_slots, used_slots",
    ),
    loadRowsByIds<{
      id: string;
      full_name: string;
    }>(
      supabase,
      "customers",
      accountId,
      [baseMigration.customer_id],
      "id, full_name",
    ),
  ]);

  const { data: steps } = await supabase
    .from("account_migration_history")
    .select("*")
    .eq("migration_id", baseMigration.id)
    .order("step_number", { ascending: true });

  return {
    ...baseMigration,
    customer_name: customerMap.get(baseMigration.customer_id)?.full_name ?? "N/A",
    source_account: sourceAccountMap.get(baseMigration.source_account_id) ?? null,
    target_account: targetAccountMap.get(baseMigration.target_account_id) ?? null,
    steps: steps ?? [],
  };
}

function buildLocalMigrationDetail(accountId: string, migrationId: string) {
  const baseMigration = buildLocalPremiumAccountMigrations(accountId, undefined).find(
    (migration) => migration.id === migrationId,
  );

  if (!baseMigration) {
    return null;
  }

  return {
    ...baseMigration,
    steps: [
      {
        step_number: 1,
        step_name: "request_created",
        step_status: "completed",
        details: baseMigration.details ?? null,
        error_message: null,
        started_at: baseMigration.created_at,
        completed_at: baseMigration.created_at,
      },
    ],
  };
}

async function loadMigrationOr404(accountId: string, migrationId: string) {
  const { data: baseMigration, error: dbError } = await supabase
    .from("account_migrations")
    .select("*")
    .eq("id", migrationId)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .single();

  if (dbError || !baseMigration) {
    return null;
  }

  return baseMigration as MigrationRow;
}

async function updateMigrationState(
  accountId: string,
  migration: MigrationRow,
  payload: ReturnType<typeof parseBody>,
) {
  const action = payload.action;
  if (!action) {
    return errorResponse("Thiếu hành động migration", 400);
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("customer_premium_subscriptions")
    .select(
      "id, account_id, customer_id, premium_account_id, premium_account_user_id, service_type_id, package_id, billing_cycle, cycle_months, start_date, expiry_date, original_price, final_price, status",
    )
    .eq("id", migration.subscription_id)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .single();

  if (subscriptionError || !subscription) {
    return notFoundResponse("Subscription");
  }

  const typedSubscription = subscription as SubscriptionRow;
  const accountMap = await loadRowsByIds<PremiumAccountRow>(
    supabase,
    "premium_accounts",
    accountId,
    [migration.source_account_id, migration.target_account_id],
    "id, primary_email, service_type_id, total_slots, used_slots, status",
  );

  const sourceAccount = accountMap.get(migration.source_account_id);
  const targetAccount = accountMap.get(migration.target_account_id);

  if (!sourceAccount || !targetAccount) {
    return errorResponse("Không tìm thấy kho nguồn hoặc kho đích", 404);
  }

  const nextStepNumber = await getNextMigrationStepNumber(migration.id);

  if (action === "start") {
    if (migration.status !== "pending") {
      return errorResponse("Chỉ migration pending mới có thể bắt đầu", 400);
    }

    await supabase
      .from("account_migrations")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", migration.id);

    await appendMigrationStep(migration.id, accountId, nextStepNumber, "migration_started", "completed", {
      transition: "pending_to_in_progress",
    });
    await createActivityLog({
      account_id: accountId,
      source_account_id: migration.source_account_id,
      customer_id: migration.customer_id,
      action_type: "PREMIUM_MIGRATION_STARTED",
      details: {
        migration_id: migration.id,
        source_account_id: migration.source_account_id,
        target_account_id: migration.target_account_id,
      },
    });
  }

  if (action === "cancel" || action === "fail") {
    if (!["pending", "in_progress"].includes(migration.status)) {
      return errorResponse("Chỉ migration đang mở mới có thể kết thúc", 400);
    }

    const reason =
      action === "cancel"
        ? "cancelled_by_admin"
        : payload.failure_reason?.trim();

    if (!reason) {
      return errorResponse("Thiếu lý do thất bại", 400);
    }

    const mergedDetails = mergeDetails(migration.details, {
      terminal_reason: action === "cancel" ? "cancelled_by_admin" : "failed_by_admin",
      failure_reason: action === "fail" ? reason : null,
    });

    await supabase
      .from("account_migrations")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_log: reason,
        details: mergedDetails,
        updated_at: new Date().toISOString(),
      })
      .eq("id", migration.id);

    await appendMigrationStep(
      migration.id,
      accountId,
      nextStepNumber,
      action === "cancel" ? "migration_cancelled" : "migration_failed",
      "completed",
      mergedDetails,
      reason,
    );

    await createActivityLog({
      account_id: accountId,
      source_account_id: migration.source_account_id,
      customer_id: migration.customer_id,
      action_type: action === "cancel" ? "PREMIUM_MIGRATION_CANCELLED" : "PREMIUM_MIGRATION_FAILED",
      details: {
        migration_id: migration.id,
        source_account_id: migration.source_account_id,
        target_account_id: migration.target_account_id,
        reason,
      },
    });
  }

  if (action === "complete") {
    if (!["pending", "in_progress"].includes(migration.status)) {
      return errorResponse("Chỉ migration đang mở mới có thể hoàn tất", 400);
    }

    if (typedSubscription.premium_account_id !== migration.source_account_id) {
      return errorResponse("Thuê bao không còn nằm ở kho nguồn ban đầu", 409);
    }

    if (sourceAccount.service_type_id !== targetAccount.service_type_id) {
      return errorResponse("Kho nguồn và kho đích phải cùng service type", 400);
    }

    if (targetAccount.status !== "active") {
      return errorResponse("Kho đích không ở trạng thái active", 400);
    }

    const targetAvailableSlots = targetAccount.total_slots - targetAccount.used_slots;
    const requiresTargetUser =
      Boolean(typedSubscription.premium_account_user_id) ||
      targetAccount.used_slots > 0;

    if (
      requiresTargetUser &&
      !payload.target_user_id &&
      !payload.create_target_user?.user_email
    ) {
      return errorResponse("Cần chọn hoặc tạo target user trước khi complete migration", 400);
    }

    let targetUserId = payload.target_user_id ?? null;

    if (targetUserId) {
      const { data: existingTargetUser, error: targetUserError } = await supabase
        .from("premium_account_users")
        .select("id, user_email, status")
        .eq("id", targetUserId)
        .eq("premium_account_id", migration.target_account_id)
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .single();

      if (targetUserError || !existingTargetUser || existingTargetUser.status !== "active") {
        return errorResponse("Target user không hợp lệ", 400);
      }

      const { data: occupiedTargetUser } = await supabase
        .from("customer_premium_subscriptions")
        .select("id")
        .eq("account_id", accountId)
        .eq("premium_account_user_id", targetUserId)
        .is("deleted_at", null)
        .neq("id", typedSubscription.id)
        .maybeSingle();

      if (occupiedTargetUser) {
        return errorResponse("Target user đang được thuê bao khác sử dụng", 409);
      }
    }

    let createdTargetUserId: string | null = null;
    if (!targetUserId && payload.create_target_user?.user_email) {
      if (targetAvailableSlots <= 0) {
        return errorResponse("Kho đích không còn slot trống", 409);
      }

      const { data: insertedTargetUser, error: insertUserError } = await supabase
        .from("premium_account_users")
        .insert({
          account_id: accountId,
          premium_account_id: migration.target_account_id,
          user_email: payload.create_target_user.user_email,
          status: "active",
        })
        .select("id")
        .single();

      if (insertUserError || !insertedTargetUser) {
        return errorResponse("Không thể tạo target user", 500);
      }

      createdTargetUserId = insertedTargetUser.id;
      targetUserId = insertedTargetUser.id;
      await incrementUsedSlots(supabase, migration.target_account_id);
    }

    if (!typedSubscription.premium_account_user_id && !targetUserId) {
      if (targetAvailableSlots <= 0) {
        return errorResponse("Kho đích không còn slot trống", 409);
      }
      await incrementUsedSlots(supabase, migration.target_account_id);
    }

    if (typedSubscription.premium_account_user_id) {
      await supabase
        .from("premium_account_users")
        .update({
          status: "removed",
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", typedSubscription.premium_account_user_id)
        .eq("account_id", accountId);
    }
    await decrementUsedSlots(supabase, migration.source_account_id);

    await supabase
      .from("customer_premium_subscriptions")
      .update({
        premium_account_id: migration.target_account_id,
        premium_account_user_id: targetUserId,
        migrated_from_account_id: migration.source_account_id,
        migration_id: migration.id,
        migrated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", typedSubscription.id)
      .eq("account_id", accountId);

    const completedDetails = mergeDetails(migration.details, {
      terminal_reason: null,
      target_user_id: targetUserId,
      created_target_user_id: createdTargetUserId,
      completed_subscription_id: typedSubscription.id,
    });

    await supabase
      .from("account_migrations")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        source_user_id: typedSubscription.premium_account_user_id,
        target_user_id: targetUserId,
        details: completedDetails,
        updated_at: new Date().toISOString(),
      })
      .eq("id", migration.id);

    await appendMigrationStep(
      migration.id,
      accountId,
      nextStepNumber,
      "migration_completed",
      "completed",
      completedDetails,
    );

    await createActivityLog({
      account_id: accountId,
      source_account_id: migration.source_account_id,
      customer_id: migration.customer_id,
      action_type: "PREMIUM_MIGRATION_COMPLETED",
      details: {
        migration_id: migration.id,
        source_account_id: migration.source_account_id,
        target_account_id: migration.target_account_id,
        target_user_id: targetUserId,
      },
    });
  }

  const reloaded = await loadMigrationOr404(accountId, migration.id);
  if (!reloaded) {
    return errorResponse("Không thể tải lại migration sau cập nhật", 500);
  }

  return successResponse(await hydrateMigration(accountId, reloaded));
}

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    const localDetail = buildLocalMigrationDetail(accountId, id);
    if (shouldPreferLocalPremiumFixtures() && localDetail) {
      return successResponse(localDetail);
    }

    const migration = await loadMigrationOr404(accountId, id);
    if (!migration) return notFoundResponse("Migration");

    return successResponse(await hydrateMigration(accountId, migration));
  }),
);

export const PATCH = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const payload = parseBody(await request.json().catch(() => ({})));

    const localDetail = buildLocalMigrationDetail(accountId, id);
    if (shouldPreferLocalPremiumFixtures() && localDetail) {
      if (payload.action === "start") {
        return successResponse({ ...localDetail, status: "in_progress" });
      }
      if (payload.action === "complete") {
        return successResponse({ ...localDetail, status: "completed", completed_at: new Date().toISOString() });
      }
      if (payload.action === "cancel" || payload.action === "fail") {
        return successResponse({
          ...localDetail,
          status: "failed",
          completed_at: new Date().toISOString(),
          details: mergeDetails(localDetail.details, {
            terminal_reason: payload.action === "cancel" ? "cancelled_by_admin" : "failed_by_admin",
          }),
        });
      }

      return successResponse({
        ...localDetail,
        reason: payload.reason ?? localDetail.reason,
        notes: payload.notes ?? localDetail.notes,
        target_account_id: payload.target_account_id ?? localDetail.target_account_id,
      });
    }

    const migration = await loadMigrationOr404(accountId, id);
    if (!migration) return notFoundResponse("Migration");

    if (payload.action) {
      return updateMigrationState(accountId, migration, payload);
    }

    if (migration.status !== "pending") {
      return errorResponse("Chỉ migration pending mới có thể chỉnh sửa metadata", 400);
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.target_account_id) {
      const accountMap = await loadRowsByIds<PremiumAccountRow>(
        supabase,
        "premium_accounts",
        accountId,
        [migration.source_account_id, payload.target_account_id],
        "id, primary_email, service_type_id, total_slots, used_slots, status",
      );
      const sourceAccount = accountMap.get(migration.source_account_id);
      const targetAccount = accountMap.get(payload.target_account_id);

      if (!sourceAccount || !targetAccount) {
        return errorResponse("Không tìm thấy kho nguồn hoặc kho đích", 404);
      }

      if (sourceAccount.id === targetAccount.id) {
        return errorResponse("Kho nguồn và kho đích phải khác nhau", 400);
      }

      if (sourceAccount.service_type_id !== targetAccount.service_type_id) {
        return errorResponse("Kho nguồn và kho đích phải cùng service type", 400);
      }

      updatePayload.target_account_id = payload.target_account_id;
      updatePayload.target_account_email = targetAccount.primary_email;
    }

    if (payload.reason !== undefined) {
      updatePayload.reason = payload.reason?.trim() || null;
    }
    if (payload.notes !== undefined) {
      updatePayload.notes = payload.notes?.trim() || null;
    }

    const mergedDetails = mergeDetails(migration.details, {
      target_account_id: updatePayload.target_account_id ?? migration.target_account_id,
      target_account_email: updatePayload.target_account_email ?? migration.target_account_email,
      reason: updatePayload.reason ?? migration.reason,
      notes: updatePayload.notes ?? migration.notes,
    });

    updatePayload.details = mergedDetails;

    const { error: updateError } = await supabase
      .from("account_migrations")
      .update(updatePayload)
      .eq("id", migration.id)
      .eq("account_id", accountId);

    if (updateError) {
      return errorResponse(updateError.message, 500);
    }

    await appendMigrationStep(
      migration.id,
      accountId,
      await getNextMigrationStepNumber(migration.id),
      "migration_metadata_updated",
      "completed",
      mergedDetails,
    );
    await createActivityLog({
      account_id: accountId,
      source_account_id: migration.source_account_id,
      customer_id: migration.customer_id,
      action_type: "PREMIUM_MIGRATION_UPDATED",
      details: {
        migration_id: migration.id,
        target_account_id: updatePayload.target_account_id ?? migration.target_account_id,
        reason: updatePayload.reason ?? migration.reason,
      },
    });

    const reloaded = await loadMigrationOr404(accountId, migration.id);
    if (!reloaded) {
      return errorResponse("Không thể tải lại migration sau cập nhật", 500);
    }

    return successResponse(await hydrateMigration(accountId, reloaded));
  }),
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;

    const migration = await loadMigrationOr404(accountId, id);
    if (!migration) return notFoundResponse("Migration");

    const { error: updateError } = await supabase
      .from("account_migrations")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("account_id", accountId);

    if (updateError) throw updateError;

    // Log activity
    await createActivityLog({
      account_id: accountId,
      source_account_id: migration.source_account_id,
      customer_id: migration.customer_id,
      action_type: "PREMIUM_MIGRATION_DELETED",
      details: {
        migration_id: id,
        source_account_id: migration.source_account_id,
        target_account_id: migration.target_account_id,
      },
    });

    return successResponse({ deleted: true }, "Migration soft-deleted successfully");
  })
);
