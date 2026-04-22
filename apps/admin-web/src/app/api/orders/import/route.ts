import { NextRequest, NextResponse } from "next/server";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { invalidateAll } from "@/lib/cache/db-cache";
import {
  ImportService,
  bulkImportSchema,
  preValidateRecords,
} from "@/lib/services/import.service";

const importService = new ImportService();

const MAX_BATCH_SIZE = 20_000;

// ---------------------------------------------------------------
// ROUTE HANDLER — Optimized Bulk Import (v5)
// Parallel resolution + idempotency guard + enhanced response
// ---------------------------------------------------------------
export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();

    // ── Parse & validate schema ──────────────────────────────
    let records;
    try {
      records = bulkImportSchema.parse(body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid data format";
      return NextResponse.json(
        { error: "Schema validation failed", details: message },
        { status: 400 }
      );
    }

    // ── Guard: empty ─────────────────────────────────────────
    if (records.length === 0) {
      return NextResponse.json(
        { error: "No records to import" },
        { status: 400 }
      );
    }

    // ── Guard: batch size ────────────────────────────────────
    if (records.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `Batch too large: ${records.length} records (max ${MAX_BATCH_SIZE})`,
          maxBatchSize: MAX_BATCH_SIZE,
        },
        { status: 400 }
      );
    }

    // ── Pre-validate: filter out bad rows instead of rejecting all ──
    const validation = preValidateRecords(records);
    const skippedRows = [...new Set(validation.errors.map(e => e.row))];
    const validRecords = validation.valid
      ? records
      : records.filter((_, idx) => !skippedRows.includes(idx + 1));

    if (validRecords.length === 0) {
      return NextResponse.json(
        {
          error: "All records failed validation",
          validationErrors: validation.errors,
          validationWarnings: validation.warnings,
        },
        { status: 422 }
      );
    }

    // ── Multi-step import (direct DB inserts, no RPC) ─────────
    try {
      const startMs = Date.now();
      const result = await importService.bulkImportAtomic(accountId, validRecords);
      const elapsedMs = Date.now() - startMs;

      // Clear all caches — import touches orders, customers, products
      invalidateAll();

      return NextResponse.json(
        {
          success: true,
          importedCount: result.importedCount,
          customersCreated: result.customersCreated,
          ctvCreated: result.ctvCreated,
          productsCreated: result.productsCreated,
          orderIds: result.orderIds,
          skippedRows: skippedRows.length > 0 ? skippedRows : undefined,
          duplicateCodesSkipped: result.duplicateCodesSkipped > 0 ? result.duplicateCodesSkipped : undefined,
          validationWarnings: validation.warnings.length > 0 ? validation.warnings : undefined,
          itemErrors: result.itemErrors.length > 0 ? result.itemErrors : undefined,
          totalReceived: records.length,
          totalValid: validRecords.length,
          elapsedMs,
        },
        { status: 201 }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown import error";
      return NextResponse.json(
        {
          error: "Import failed",
          details: message,
          partialFailure: true,
        },
        { status: 500 }
      );
    }
  })
);
