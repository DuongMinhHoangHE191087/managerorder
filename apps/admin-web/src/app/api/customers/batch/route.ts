import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  checkCustomerDependenciesForAccount,
  deleteCustomersForAccount,
  updateCustomersTierForAccount,
} from "@/domains/customers";

const batchSchema = z.object({
  action: z.enum(["delete", "update_tier", "check_dependencies"]),
  customerIds: z.array(z.string().uuid()).min(1).max(5000),
  data: z
    .object({
      tier: z.enum(["regular", "vip", "agency"]).optional(),
      customerType: z.enum(["retail", "wholesale", "agency"]).optional(),
    })
    .optional(),
});

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body rỗng hoặc không hợp lệ" },
        { status: 400 }
      );
    }

    const { action, customerIds, data } = batchSchema.parse(body);

    switch (action) {
      case "check_dependencies": {
        const result = await checkCustomerDependenciesForAccount(customerIds, accountId);
        return NextResponse.json({ data: result });
      }

      case "delete": {
        const totalDeleted = await deleteCustomersForAccount(customerIds, accountId);
        return NextResponse.json({
          data: { deletedCount: totalDeleted },
          message: `Đã xóa ${totalDeleted} khách hàng`,
        });
      }

      case "update_tier": {
        if (!data?.tier && !data?.customerType) {
          return NextResponse.json(
            { error: "Thiếu thông tin phân loại trong data" },
            { status: 400 }
          );
        }

        const count = await updateCustomersTierForAccount(customerIds, accountId, {
          tier: data.tier,
          customerType: data.customerType,
        });
        return NextResponse.json({
          data: { updatedCount: count },
          message: `Đã cập nhật ${count} khách hàng`,
        });
      }

      default:
        return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
    }
  })
);
