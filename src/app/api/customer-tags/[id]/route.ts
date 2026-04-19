import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { deleteCustomerTag, updateCustomerTag } from "@/lib/supabase/repositories/customer-tags.repo";

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(7).optional(),
});

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = await request.json();
    const input = updateSchema.parse(body);
    const tag = await updateCustomerTag(id, accountId, input);
    return NextResponse.json({ data: tag, message: "Đã cập nhật tag" });
  })
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request, { accountId, params }) => {
    const { id } = await params;
    await deleteCustomerTag(id, accountId);
    return NextResponse.json({ success: true, message: "Đã xóa tag" });
  })
);
