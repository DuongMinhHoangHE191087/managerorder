import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import {
  softDeleteCustomers,
  updateCustomersTier,
  getCustomerDependencies,
} from "@/lib/supabase/repositories/customers.repo";
import { mapTierToDbType } from "@/lib/supabase/mappers/customer-mapper";

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
        // Chunk into batches of 50 to avoid timeout on large lists
        let customersWithOrders = 0;
        let totalOrders = 0;
        for (let i = 0; i < customerIds.length; i += 50) {
          const chunk = customerIds.slice(i, i + 50);
          const deps = await getCustomerDependencies(chunk, accountId);
          customersWithOrders += deps.customersWithOrders;
          totalOrders += deps.totalOrders;
        }
        return NextResponse.json({ data: { customersWithOrders, totalOrders } });
      }

      case "delete": {
        // Chunk into batches of 50 to avoid timeout
        let totalDeleted = 0;
        for (let i = 0; i < customerIds.length; i += 50) {
          const chunk = customerIds.slice(i, i + 50);
          totalDeleted += await softDeleteCustomers(chunk, accountId);
        }
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
        
        let dbType: string | undefined = data.customerType;
        if (!dbType && data.tier) {
          dbType = mapTierToDbType(data.tier);
        }

        const count = await updateCustomersTier(
          customerIds,
          accountId,
          dbType as "retail" | "wholesale" | "agency"
        );
        return NextResponse.json({
          data: { updatedCount: count },
          message: `Đã cập nhật ${count} khách hàng`,
        });
      }

      default:
        return NextResponse.json(
          { error: "Action không hợp lệ" },
          { status: 400 }
        );
    }
  })
);
