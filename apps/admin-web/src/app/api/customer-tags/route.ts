import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  listCustomerTags,
  createCustomerTag,
  assignTagsToCustomer,
  removeTagsFromCustomer,
  batchAssignTag,
} from "@/lib/supabase/repositories/customer-tags.repo";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().min(1).max(50),
    color: z.string().max(7).optional(),
  }),
  z.object({
    action: z.literal("assign"),
    customerId: z.string().uuid(),
    tagIds: z.array(z.string().uuid()).min(1),
  }),
  z.object({
    action: z.literal("remove"),
    customerId: z.string().uuid(),
    tagIds: z.array(z.string().uuid()).min(1),
  }),
  z.object({
    action: z.literal("batch_assign"),
    customerIds: z.array(z.string().uuid()).min(1).max(500),
    tagId: z.string().uuid(),
  }),
]);

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const tags = await listCustomerTags(accountId);
    return NextResponse.json({ data: tags });
  })
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const parsed = actionSchema.parse(body);

    switch (parsed.action) {
      case "create": {
        const tag = await createCustomerTag(accountId, {
          name: parsed.name,
          color: parsed.color,
        });
        return NextResponse.json({
          data: tag,
          message: `Đã tạo tag "${tag.name}"`,
        }, { status: 201 });
      }

      case "assign": {
        const count = await assignTagsToCustomer(parsed.customerId, parsed.tagIds);
        return NextResponse.json({
          data: { assignedCount: count },
          message: `Đã gán ${count} tag`,
        });
      }

      case "remove": {
        await removeTagsFromCustomer(parsed.customerId, parsed.tagIds);
        return NextResponse.json({
          data: { success: true },
          message: "Đã gỡ tag",
        });
      }

      case "batch_assign": {
        const count = await batchAssignTag(parsed.customerIds, parsed.tagId);
        return NextResponse.json({
          data: { assignedCount: count },
          message: `Đã gán tag cho ${count} khách hàng`,
        });
      }
    }
  })
);
