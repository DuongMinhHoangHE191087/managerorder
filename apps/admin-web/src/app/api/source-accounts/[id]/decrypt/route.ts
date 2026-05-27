import { NextResponse } from "next/server";
import { getDecryptedSourceAccountSecretsForAccount } from "@/domains/source-accounts";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/source-accounts/:id/decrypt
 * Returns decrypted password and credentials for the given source account.
 * Admin-only route protected by withAccount and credentials:read.
 */
export const GET = withErrorHandler(
  withAccount<{ id: string }>(requirePermissions<{ id: string }>(["credentials:read"])(async (_request, { accountId, params }) => {
    const { id } = await params;
    const data = await getDecryptedSourceAccountSecretsForAccount(id, accountId);

    if (!data) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  })),
);
