import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { exportCustomersWorkbookForAccount } from "@/domains/customers";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  withAccount(async (_request, { accountId }) => {
    const { buffer, filename } = await exportCustomersWorkbookForAccount(accountId);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  })
);
