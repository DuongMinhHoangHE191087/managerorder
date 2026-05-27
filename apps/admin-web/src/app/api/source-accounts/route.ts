// /api/source-accounts/route.ts — List + create source accounts for the current account
import { NextResponse } from "next/server";
import { createSourceAccountForAccount, listSourceAccountsForAccount } from "@/domains/source-accounts";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const data = await listSourceAccountsForAccount(accountId);
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
      credentials?: Array<{ type: string; value: string; label?: string; format?: "plain" | "totp_secret" | "backup_codes" | "url" | "identifier"; shareable?: boolean; masked?: boolean }>;
      purchaseCostVnd?: number;
      purchaseDate?: string;
      purchaseSource?: string;
    };

    if (!body.email || !body.provider || !body.expiresAt) {
      return NextResponse.json({ error: "email, provider and expiresAt are required" }, { status: 400 });
    }

    const data = await createSourceAccountForAccount(accountId, {
      email: body.email,
      password: body.password,
      provider: body.provider,
      maxSlots: body.maxSlots ?? 1,
      productIds: body.productIds ?? [],
      expiresAt: body.expiresAt,
      credentials: body.credentials,
      purchaseCostVnd: body.purchaseCostVnd,
      purchaseDate: body.purchaseDate,
      purchaseSource: body.purchaseSource,
    }, user.email);

    return NextResponse.json({ data }, { status: 201 });
  }))
);
