// /api/source-accounts/[id]/decrypt/route.ts — Decrypt credentials for admin view
import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { getSourceAccountById } from "@/lib/supabase/repositories/source-accounts.repo";
import { decryptNotes } from "@/lib/utils/credential-crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/source-accounts/:id/decrypt
 * Returns decrypted password and credentials for the given source account.
 * Admin-only — protected by withAccount.
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    const row = await getSourceAccountById(id, accountId);

    if (!row) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }

    const notes = (row.notes ?? {}) as Record<string, unknown>;

    // Decrypt notes (password + credentials)
    let decryptedNotes: Record<string, unknown>;
    try {
      decryptedNotes = decryptNotes(notes);
    } catch {
      // If decryption fails, return raw notes (backward compat)
      decryptedNotes = notes;
    }

    return NextResponse.json({
      data: {
        id: row.id,
        email: row.email,
        password: (decryptedNotes.password as string) ?? null,
        credentials: (decryptedNotes.credentials as Array<{ type: string; value: string }>) ?? [],
      },
    });
  })
);
