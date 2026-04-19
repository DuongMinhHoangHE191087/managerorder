import { NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseCustomerXlsx } from "@/lib/services/excel-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/customers/import
 * Import customers from XLSX file (multipart/form-data)
 * Supports create-new and update-existing modes
 */
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

    // Validate file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File quá lớn. Tối đa 5MB" },
        { status: 400 },
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse and validate
    const { validRows, errors, totalRows } = await parseCustomerXlsx(buffer);

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found", errors, totalRows },
        { status: 400 },
      );
    }

    // Insert all valid rows
    let createdCount = 0;
    const insertErrors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const { error: insertError } = await supabaseAdmin
        .from("customers")
        .insert({
          account_id: accountId,
          full_name: row.fullName,
          type: row.customerType,
          notes: row.notes ?? null,
          debt_amount_vnd: row.debtAmountVnd ?? 0,
          debt_overdue_days: row.debtOverdueDays ?? 0,
          reliability_score: row.reliabilityScore ?? 100,
        });

      if (insertError) {
        insertErrors.push({
          row: i + 2,
          message: insertError.message,
        });
      } else {
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalRows,
      createdCount,
      skippedCount: totalRows - validRows.length,
      insertErrors,
      parseErrors: errors,
    });
  }),
);
