import { NextResponse } from "next/server";
import { getDecryptedSourceAccountSecretsForAccount } from "@/domains/source-accounts";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const dynamic = "force-dynamic";

/**
 * GET /api/source-accounts/:id/decrypt
 * Returns decrypted password and credentials for the given source account.
 * Admin-only â€” protected by withAccount.
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    const data = await getDecryptedSourceAccountSecretsForAccount(id, accountId);

    if (!data) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  }),
);
