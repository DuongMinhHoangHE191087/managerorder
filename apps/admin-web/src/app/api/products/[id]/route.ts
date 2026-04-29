import { NextRequest, NextResponse } from "next/server";
import { createProductInputSchema } from "@/lib/domain/schemas";
import { deleteProductForAccount, getProductForAccount, updateProductForAccount } from "@/domains/products";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";

export const GET = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const includeDeleted = new URL(request.url).searchParams.get("include_deleted") === "1";
    const data = await getProductForAccount(id, accountId, { includeDeleted });
    if (!data) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  })
);

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = await request.json() as unknown;
    const d = createProductInputSchema.partial().parse(body);
    const data = await updateProductForAccount(id, accountId, d);
    return NextResponse.json({ data });
  })
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    await deleteProductForAccount(id, accountId);
    return NextResponse.json({ success: true });
  })
);
