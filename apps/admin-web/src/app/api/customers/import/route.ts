import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { importCustomersWorkbookForAccount } from "@/domains/customers";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withAccount(async (request, { accountId }) => {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing file in request" },
        { status: 400 },
      );
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File quá lớn. Tối đa 5MB" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await importCustomersWorkbookForAccount(accountId, buffer);

    if (result.validRowsCount === 0) {
      return NextResponse.json(
        { error: "No valid rows found", errors: result.parseErrors, totalRows: result.totalRows },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      totalRows: result.totalRows,
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
      insertErrors: result.insertErrors,
      parseErrors: result.parseErrors,
    });
  })
);
