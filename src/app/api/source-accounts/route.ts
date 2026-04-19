// /api/source-accounts/route.ts — List + create source accounts for the current account
import { NextResponse } from "next/server";
import { listSourceAccounts, createSourceAccount } from "@/lib/supabase/repositories/source-accounts.repo";
import { mapRowToSourceAccount } from "@/lib/mappers/source-account.mapper";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { encryptNotes } from "@/lib/utils/credential-crypto";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const rows = await listSourceAccounts(accountId);
    const data = rows.map(mapRowToSourceAccount);
    return NextResponse.json({ data });
  })
);

export const POST = withErrorHandler(
  withAccount(requirePermissions(["inventory:adjust"])(async (request, { accountId, user }) => {
    const body = await request.json() as {
      email: string;
      password?: string;
      provider: string;
      productIds?: string[];
      maxSlots?: number;
      expiresAt: string;
      credentials?: Array<{ type: string; value: string; label?: string }>;
      purchaseCostVnd?: number;
      purchaseDate?: string;
      purchaseSource?: string;
    };

    if (!body.email || !body.provider || !body.expiresAt) {
      return NextResponse.json({ error: "email, provider and expiresAt are required" }, { status: 400 });
    }

    // Build notes JSONB with credentials and password
    let notes: Record<string, unknown> = {};
    if (body.credentials && body.credentials.length > 0) {
      notes.credentials = body.credentials;
    }
    if (body.password) {
      notes.password = body.password;
    }

    // Encrypt sensitive fields in notes before storage
    if (Object.keys(notes).length > 0) {
      try {
        notes = encryptNotes(notes);
      } catch (err) {
        console.warn("[Source Accounts] Encryption skipped:", (err as Error).message);
        // Continue with plaintext if encryption key not set
      }
    }

    const row = await createSourceAccount(accountId, {
      account_id: accountId,
      email: body.email,
      provider: body.provider,
      max_slots: body.maxSlots ?? 1,
      used_slots: 0,
      product_ids: body.productIds ?? [],
      expires_at: body.expiresAt,
      ...(Object.keys(notes).length > 0 ? { notes } : {}),
      ...(body.purchaseCostVnd !== undefined ? { purchase_cost_vnd: body.purchaseCostVnd } : {}),
      ...(body.purchaseDate !== undefined ? { purchase_date: body.purchaseDate } : {}),
      ...(body.purchaseSource !== undefined ? { purchase_source: body.purchaseSource } : {}),
    });

    await createActivityLog({
      account_id: accountId,
      action_type: 'INVENTORY_STATUS_CHANGED',
      created_by: user.email,
      source_account_id: row.id,
      details: {
        action: 'Created new source account',
        email: row.email,
        provider: row.provider
      }
    });

    return NextResponse.json({ data: mapRowToSourceAccount(row) }, { status: 201 });
  }))
);
