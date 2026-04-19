import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { mapToCustomer } from "@/lib/supabase/mappers/customer-mapper";
import { listCustomers } from "@/lib/supabase/repositories/customers.repo";
import { generateCustomerXlsx } from "@/lib/services/excel-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/customers/export
 * Export all customers as XLSX file
 */
export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const customers = (await listCustomers(accountId)).map(mapToCustomer);
    const xlsxBuffer = await generateCustomerXlsx(customers);

    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="customers_${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  }),
);
