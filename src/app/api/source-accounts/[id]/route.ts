// /api/source-accounts/[id]/route.ts — Update or delete a specific source account
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import {
  updateSourceAccount,
  deleteSourceAccount,
  getSourceAccountById,
  recalculateUsedSlots,
} from "@/lib/supabase/repositories/source-accounts.repo";
import { mapRowToSourceAccount } from "@/lib/mappers/source-account.mapper";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { encryptNotes } from "@/lib/utils/credential-crypto";
import { requirePermissions } from "@/lib/api/rbac";
import { formatMoney } from "@/lib/utils";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    const row = await getSourceAccountById(id, accountId);
    if (!row) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }
    return createSuccessResponse(mapRowToSourceAccount(row));
  })
);

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["inventory:adjust"])(async (request: NextRequest, { accountId, params, user }) => {
    const { id } = await params;
    const body = await request.json() as {
      email?: string;
      password?: string;
      provider?: string;
      productIds?: string[];
      maxSlots?: number;
      usedSlots?: number;
      notes?: Record<string, string>;
      expiresAt?: string;
      credentials?: Array<{ type: string; value: string; label?: string }>;
      purchaseCostVnd?: number;
      purchaseDate?: string;
      purchaseSource?: string;
    };
    // Build notes JSONB — merge credentials into existing notes
    let notesUpdate: Record<string, unknown> | undefined;
    if (body.credentials !== undefined || body.password !== undefined) {
      // Fetch current notes to merge
      const existing = await getSourceAccountById(id, accountId);
      const currentNotes = (existing?.notes ?? {}) as Record<string, unknown>;
      notesUpdate = { ...currentNotes };
      if (body.credentials !== undefined) {
        notesUpdate.credentials = body.credentials;
      }
      if (body.password) {
        notesUpdate.password = body.password;
      }
      // Encrypt sensitive fields before storage
      try {
        notesUpdate = encryptNotes(notesUpdate);
      } catch (err) {
        console.warn("[Source Accounts] Encryption skipped:", (err as Error).message);
      }
    }

    const updated = await updateSourceAccount(id, accountId, {
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.provider !== undefined ? { provider: body.provider } : {}),
      ...(body.productIds !== undefined ? { product_ids: body.productIds } : {}),
      ...(body.maxSlots !== undefined ? { max_slots: body.maxSlots } : {}),
      ...(body.usedSlots !== undefined ? { used_slots: body.usedSlots } : {}),
      ...(notesUpdate !== undefined ? { notes: notesUpdate } : {}),
      ...(body.expiresAt !== undefined ? { expires_at: body.expiresAt } : {}),
      ...(body.purchaseCostVnd !== undefined ? { purchase_cost_vnd: body.purchaseCostVnd } : {}),
      ...(body.purchaseDate !== undefined ? { purchase_date: body.purchaseDate } : {}),
      ...(body.purchaseSource !== undefined ? { purchase_source: body.purchaseSource } : {}),
    });

    // Build human-readable changes summary (exclude sensitive data)
    const changesSummary: Record<string, string> = {};
    if (body.email !== undefined) changesSummary['email'] = body.email;
    if (body.provider !== undefined) changesSummary['provider'] = body.provider;
    if (body.maxSlots !== undefined) changesSummary['max_slots'] = String(body.maxSlots);
    if (body.usedSlots !== undefined) changesSummary['used_slots'] = String(body.usedSlots);
    if (body.expiresAt !== undefined) changesSummary['expires_at'] = body.expiresAt;
    if (body.purchaseCostVnd !== undefined) changesSummary['purchase_cost_vnd'] = formatMoney(Number(body.purchaseCostVnd));
    if (body.purchaseDate !== undefined) changesSummary['purchase_date'] = body.purchaseDate;
    if (body.purchaseSource !== undefined) changesSummary['purchase_source'] = body.purchaseSource;
    if (body.productIds !== undefined) changesSummary['products'] = Array.isArray(body.productIds) ? `${body.productIds.length} sản phẩm` : String(body.productIds);
    if (body.credentials !== undefined) changesSummary['credentials'] = 'Đã cập nhật';
    if (body.password !== undefined) changesSummary['password'] = 'Đã cập nhật';

    createActivityLog({
      account_id: accountId,
      action_type: 'INVENTORY_STATUS_CHANGED',
      created_by: user.email,
      source_account_id: id,
      details: { action: 'Cập nhật tài khoản kho', ...changesSummary }
    }).catch(() => {});

    return createSuccessResponse(mapRowToSourceAccount(updated));
  }))
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request, { accountId, params, user }) => {
    const { id } = await params;

    // Fetch info before deleting for activity log
    const existing = await getSourceAccountById(id, accountId);
    await deleteSourceAccount(id, accountId);

    // Log deletion (non-blocking)
    createActivityLog({
      account_id: accountId,
      action_type: 'INVENTORY_STATUS_CHANGED',
      created_by: user.email,
      source_account_id: id,
      details: {
        action: 'Deleted source account',
        email: existing?.email ?? 'unknown',
        provider: existing?.provider ?? 'unknown',
      },
    }).catch(() => {});

    return createSuccessResponse({ success: true });
  }))
);

export const PATCH = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request, { accountId, params, user }) => {
    const { id } = await params;
    const result = await recalculateUsedSlots(id, accountId);

    if (result.changed) {
      createActivityLog({
        account_id: accountId,
        action_type: 'SLOTS_RECALCULATED',
        created_by: user.email,
        source_account_id: id,
        details: {
          previous_slots: result.previous,
          recalculated_slots: result.recalculated,
          action: 'Auto-synced used_slots from actual connections + reserved nicks',
        },
      }).catch(() => {});
    }

    return createSuccessResponse(result);
  }))
);
