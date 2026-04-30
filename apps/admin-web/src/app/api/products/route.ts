import { NextRequest, NextResponse } from "next/server";
import { createProductInputSchema } from "@/lib/domain/schemas";
import { createProductForAccount, listProductsForAccount } from "@/domains/products";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { requirePermissions } from "@/lib/api/rbac";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const data = await listProductsForAccount(accountId);
    return NextResponse.json({ data });
  })
);

// BUG #2 FIX: Added requirePermissions guard
export const POST = withErrorHandler(
  withAccount(
    requirePermissions(["order:create"])(async (request: NextRequest, { accountId }) => {
      const body = await request.json();
      const validatedData = createProductInputSchema.parse(body);
      const data = await createProductForAccount(accountId, validatedData);
      return NextResponse.json({ data }, { status: 201 });
    })
  )
);
