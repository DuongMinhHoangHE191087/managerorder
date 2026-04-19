import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/utils/credential-crypto";
import { loadWorkbook, worksheetToRecords } from "@/lib/utils/excel";

/**
 * POST /api/source-accounts/import
 * Import source accounts from Excel (.xlsx) file.
 * 
 * Expected columns:
 *   email (required), password (required), provider, products (comma-separated names),
 *   maxSlots, expiresAt, duolingo_id, link_join, purchaseCostVnd, purchaseDate, purchaseSource
 */

interface ImportRow {
  email: string;
  password: string;
  provider?: string;
  products?: string;
  maxSlots?: number;
  expiresAt?: string;
  duolingo_id?: string;
  link_join?: string;
  purchaseCostVnd?: number;
  purchaseDate?: string;
  purchaseSource?: string;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  parseErrors: Array<{ row: number; message: string }>;
  insertErrors: Array<{ row: number; message: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Thiếu file upload" }, { status: 400 });
    }

    // Size check (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File quá lớn. Tối đa 5MB" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = await loadWorkbook(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ error: "File Excel trống" }, { status: 400 });
    }

    const rawRows = worksheetToRecords(sheet);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy dữ liệu trong file" }, { status: 400 });
    }

    // Lookup providers and products for name resolution
    const { data: allProviders } = await supabase.from("providers").select("id, name");
    const { data: allProducts } = await supabase.from("product_services").select("id, name");

    const providerMap = new Map((allProviders ?? []).map((p: { name: string; id: string }) => [p.name.toLowerCase().trim(), p.id]));
    const productMap = new Map((allProducts ?? []).map((p: { name: string; id: string }) => [p.name.toLowerCase().trim(), p.id]));

    // Default provider fallback
    const defaultProviderId = allProviders?.[0]?.id ?? null;

    const result: ImportResult = {
      success: true,
      totalRows: rawRows.length,
      createdCount: 0,
      skippedCount: 0,
      parseErrors: [],
      insertErrors: [],
    };

    const BATCH_SIZE = 20;

    for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
      const batch = rawRows.slice(i, i + BATCH_SIZE);
      const rowsToInsert: Array<Record<string, unknown>> = [];

      for (let j = 0; j < batch.length; j++) {
        const rowIndex = i + j + 2; // Excel is 1-indexed + header row
        const raw = batch[j];

        try {
          const row = normalizeRow(raw);

          // Validate required fields
          if (!row.email) {
            result.parseErrors.push({ row: rowIndex, message: "Thiếu email" });
            result.skippedCount++;
            continue;
          }

          if (!row.password) {
            result.parseErrors.push({ row: rowIndex, message: "Thiếu password" });
            result.skippedCount++;
            continue;
          }

          // Resolve provider
          let providerId = defaultProviderId;
          if (row.provider) {
            const resolved = providerMap.get(row.provider.toLowerCase().trim());
            if (resolved) providerId = resolved;
          }

          // Resolve products (comma-separated names)
          const productIds: string[] = [];
          if (row.products) {
            const productNames = row.products.split(",").map((s) => s.trim().toLowerCase());
            for (const pn of productNames) {
              const pid = productMap.get(pn);
              if (pid) productIds.push(pid);
            }
          }

          // Build credentials
          const credentials: Array<{ type: string; value: string; label?: string }> = [];
          if (row.duolingo_id) {
            credentials.push({ type: "duolingo_id", value: row.duolingo_id, label: "Duolingo ID" });
          }
          if (row.link_join) {
            credentials.push({ type: "link_join", value: row.link_join, label: "Link Join" });
          }

          const encryptedPassword = encryptCredential(row.password);
          const encryptedCredentials = credentials.length > 0
            ? encryptCredential(JSON.stringify(credentials))
            : null;

          // Parse dates
          const expiresAt = row.expiresAt ? parseExcelDate(row.expiresAt) : getDefaultExpiry();
          const maxSlots = row.maxSlots ?? 6;

          rowsToInsert.push({
            email: row.email.trim(),
            password: encryptedPassword,
            provider: providerId,
            product_ids: productIds.length > 0 ? productIds : null,
            max_slots: maxSlots,
            used_slots: 0,
            expires_at: expiresAt,
            credentials: encryptedCredentials,
            status: "active",
            purchase_cost_vnd: row.purchaseCostVnd || null,
            purchase_date: row.purchaseDate ? parseExcelDate(row.purchaseDate) : null,
            purchase_source: row.purchaseSource || null,
          });
        } catch (err) {
          result.parseErrors.push({
            row: rowIndex,
            message: err instanceof Error ? err.message : "Parse error",
          });
          result.skippedCount++;
        }
      }

      // Insert batch
      if (rowsToInsert.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from("source_accounts")
          .insert(rowsToInsert)
          .select("id");

        if (insertErr) {
          // Try individual inserts
          for (let k = 0; k < rowsToInsert.length; k++) {
            const { error: singleErr } = await supabase
              .from("source_accounts")
              .insert(rowsToInsert[k]);
            if (singleErr) {
              result.insertErrors.push({
                row: i + k + 2,
                message: singleErr.message,
              });
              result.skippedCount++;
            } else {
              result.createdCount++;
            }
          }
        } else {
          result.createdCount += inserted?.length ?? rowsToInsert.length;
        }
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}

/** Normalize raw Excel row to typed ImportRow */
function normalizeRow(raw: Record<string, unknown>): ImportRow {
  // Handle various column name variations (case-insensitive)
  const get = (keys: string[]): string => {
    for (const k of keys) {
      for (const rk of Object.keys(raw)) {
        if (rk.toLowerCase().trim() === k.toLowerCase()) {
          return String(raw[rk] ?? "").trim();
        }
      }
    }
    return "";
  };

  return {
    email: get(["email", "e-mail", "mail", "tài khoản", "account"]),
    password: get(["password", "pass", "mật khẩu", "mk"]),
    provider: get(["provider", "nhà cung cấp", "ncc"]) || undefined,
    products: get(["products", "product", "sản phẩm", "sp"]) || undefined,
    maxSlots: parseInt(get(["maxSlots", "max_slots", "slots", "số slot"]), 10) || undefined,
    expiresAt: get(["expiresAt", "expires_at", "hết hạn", "ngày hết hạn", "expiry"]) || undefined,
    duolingo_id: get(["duolingo_id", "duo_id", "id duolingo"]) || undefined,
    link_join: get(["link_join", "link", "join link", "link gia nhập"]) || undefined,
    purchaseCostVnd: parseInt(get(["purchaseCostVnd", "purchase_cost", "giá mua", "cost"]), 10) || undefined,
    purchaseDate: get(["purchaseDate", "purchase_date", "ngày mua"]) || undefined,
    purchaseSource: get(["purchaseSource", "purchase_source", "nguồn mua"]) || undefined,
  };
}

/** Parse Excel date (could be serial number or string) */
function parseExcelDate(val: string): string {
  // Try ISO format first
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString();

  // Try Excel serial date number
  const serial = parseFloat(val);
  if (!isNaN(serial) && serial > 10000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    return date.toISOString();
  }

  return val;
}

/** Default expiry: 1 year from now */
function getDefaultExpiry(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}
