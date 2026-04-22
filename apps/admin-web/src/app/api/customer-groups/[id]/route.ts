import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  updateCustomerGroup,
  deleteCustomerGroup,
} from "@/lib/supabase/repositories/customer-groups.repo";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
});

export const PUT = withErrorHandler(
  withAccount<{ id: string }>(async (request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    const body = await request.json();
    const input = updateSchema.parse(body);
    const group = await updateCustomerGroup(id, accountId, input);
    return NextResponse.json({ data: group });
  })
);

export const DELETE = withErrorHandler(
  withAccount<{ id: string }>(async (_request: NextRequest, { accountId, params }) => {
    const { id } = await params;
    await deleteCustomerGroup(id, accountId);
    return NextResponse.json({ message: "Đã xóa nhóm" });
  })
);

