// /api/source-accounts/[id]/route.ts — Update or delete a specific source account
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler, createSuccessResponse } from "@/lib/api/with-error-handler";
import {
  deleteSourceAccountForAccount,
  getSourceAccountForAccount,
  recalculateSourceAccountSlotsForAccount,
  updateSourceAccountForAccount,
} from "@/domains/source-accounts";
import { requirePermissions } from "@/lib/api/rbac";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    const includeDeleted = new URL(_request.url).searchParams.get("include_deleted") === "1";
    const data = await getSourceAccountForAccount(id, accountId, { includeDeleted });
    if (!data) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }
    return createSuccessResponse(data);
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
      credentials?: Array<{ type: string; value: string; label?: string; format?: "plain" | "totp_secret" | "backup_codes" | "url" | "identifier"; shareable?: boolean; masked?: boolean }>;
      purchaseCostVnd?: number;
      purchaseDate?: string;
      purchaseSource?: string;
    };

    const data = await updateSourceAccountForAccount(id, accountId, {
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.provider !== undefined ? { provider: body.provider } : {}),
      ...(body.productIds !== undefined ? { productIds: body.productIds } : {}),
      ...(body.maxSlots !== undefined ? { maxSlots: body.maxSlots } : {}),
      ...(body.usedSlots !== undefined ? { usedSlots: body.usedSlots } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
      ...(body.purchaseCostVnd !== undefined ? { purchaseCostVnd: body.purchaseCostVnd } : {}),
      ...(body.purchaseDate !== undefined ? { purchaseDate: body.purchaseDate } : {}),
      ...(body.purchaseSource !== undefined ? { purchaseSource: body.purchaseSource } : {}),
      ...(body.credentials !== undefined ? { credentials: body.credentials } : {}),
      ...(body.password !== undefined ? { password: body.password } : {}),
    }, user.email);

    return createSuccessResponse(data);
  }))
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request, { accountId, params, user }) => {
    const { id } = await params;
    await deleteSourceAccountForAccount(id, accountId, user.email);
    return createSuccessResponse({ success: true });
  }))
);

export const PATCH = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["inventory:adjust"])(async (_request, { accountId, params, user }) => {
    const { id } = await params;
    const result = await recalculateSourceAccountSlotsForAccount(id, accountId, user.email);
    return createSuccessResponse(result);
  }))
);
