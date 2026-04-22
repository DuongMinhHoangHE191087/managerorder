import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  listCustomerGroups,
  createCustomerGroup,
  assignCustomersToGroup,
  removeCustomersFromGroup,
} from "@/lib/supabase/repositories/customer-groups.repo";

// POST actions: create group, assign customers, remove from group
const createSchema = z.object({
  action: z.literal("create"),
  name: z.string().min(1).max(100),
  color: z.string().optional(),
  description: z.string().optional(),
});

const assignSchema = z.object({
  action: z.literal("assign"),
  groupId: z.string().uuid(),
  customerIds: z.array(z.string().uuid()).min(1).max(500),
});

const removeSchema = z.object({
  action: z.literal("remove"),
  customerIds: z.array(z.string().uuid()).min(1).max(500),
});

const postSchema = z.discriminatedUnion("action", [createSchema, assignSchema, removeSchema]);

export const GET = withErrorHandler(
  withAccount(async (_request: NextRequest, { accountId }) => {
    const groups = await listCustomerGroups(accountId);
    return NextResponse.json({ data: groups });
  })
);

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const parsed = postSchema.parse(body);

    switch (parsed.action) {
      case "create": {
        const group = await createCustomerGroup(accountId, {
          name: parsed.name,
          color: parsed.color,
          description: parsed.description,
        });
        return NextResponse.json({ data: group, message: `Đã tạo nhóm "${parsed.name}"` });
      }
      case "assign": {
        const count = await assignCustomersToGroup(parsed.customerIds, accountId, parsed.groupId);
        return NextResponse.json({
          data: { updatedCount: count },
          message: `Đã gán ${count} khách vào nhóm`,
        });
      }
      case "remove": {
        const count = await removeCustomersFromGroup(parsed.customerIds, accountId);
        return NextResponse.json({
          data: { updatedCount: count },
          message: `Đã gỡ ${count} khách khỏi nhóm`,
        });
      }
    }
  })
);
