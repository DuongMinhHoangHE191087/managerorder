import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { loadRowsByIds } from "@/lib/supabase/relation-fallback";

const checkSchema = z.object({
  name: z.string().min(1),
  contacts: z.array(z.object({
    value: z.string().min(1),
  })).optional(),
  excludeId: z.string().uuid().optional(),
});

export const POST = withErrorHandler(
  withAccount(async (request: NextRequest, { accountId }) => {
    const body = await request.json();
    const { name, contacts, excludeId } = checkSchema.parse(body);

    const duplicates: {
      id: string;
      name: string;
      matchType: "name" | "contact" | "both";
      matchValue?: string;
      similarity: number;
    }[] = [];

    // 1. Check name similarity using pg_trgm
    const { data: nameDups } = await supabase
      .rpc("check_customer_name_similarity", {
        p_account_id: accountId,
        p_name: name.trim(),
        p_threshold: 0.4,
        p_limit: 5,
      });

    // Fallback: if RPC not available, use basic ILIKE
    if (!nameDups) {
      const { data: fallbackDups } = await supabase
        .from("customers")
        .select("id, full_name")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .ilike("full_name", `%${name.trim()}%`)
        .limit(5);

      (fallbackDups ?? []).forEach((row: Record<string, unknown>) => {
        const rowId = String(row.id);
        if (excludeId && rowId === excludeId) return;
        duplicates.push({
          id: rowId,
          name: String(row.full_name),
          matchType: "name",
          similarity: 0.7,
        });
      });
    } else {
      (nameDups as Record<string, unknown>[]).forEach((row) => {
        const rowId = String(row.id);
        if (excludeId && rowId === excludeId) return;
        duplicates.push({
          id: rowId,
          name: String(row.full_name),
          matchType: "name",
          similarity: Number(row.similarity ?? 0.5),
        });
      });
    }

    // 2. Check contact value exact matches
    if (contacts?.length) {
      const contactValues = contacts
        .map(c => c.value.trim().toLowerCase())
        .filter(Boolean);
      
      if (contactValues.length > 0) {
        const { data: contactDups, error: contactError } = await supabase
          .from("customer_contacts")
          .select("customer_id, value")
          .in("value", contactValues)
          .limit(10);

        const addContactMatches = (
          rows: Array<Record<string, unknown>>,
          customerLookup: Map<string, { id: string; full_name: string; account_id?: string; deleted_at?: string | null }>,
        ) => {
          rows.forEach((row: Record<string, unknown>) => {
            const customerId = String(row.customer_id ?? "");
            const resolvedCustomer = (customerLookup.get(customerId) ?? null) as
              | { id: string; full_name: string; account_id?: string; deleted_at?: string | null }
              | null;
            if (!resolvedCustomer) return;
            if (String(resolvedCustomer.account_id ?? accountId) !== accountId) return;
            if (resolvedCustomer.deleted_at) return;
            const cid = String(resolvedCustomer.id);
            if (excludeId && cid === excludeId) return;

            const existing = duplicates.find(d => d.id === cid);
            if (existing) {
              existing.matchType = "both";
              existing.matchValue = String(row.value);
              existing.similarity = Math.max(existing.similarity, 0.9);
            } else {
              duplicates.push({
                id: cid,
                name: String(resolvedCustomer.full_name),
                matchType: "contact",
                matchValue: String(row.value),
                similarity: 0.9,
              });
            }
          });
        };

        if (contactError) throw contactError;

        const customerIds = [...new Set((contactDups ?? []).map((row: Record<string, unknown>) => String(row.customer_id ?? "")).filter(Boolean))];
        const customerLookup = await loadRowsByIds<{ id: string; full_name: string; account_id: string; deleted_at: string | null }>(
          supabase,
          "customers",
          accountId,
          customerIds,
          "id, full_name, account_id, deleted_at",
        );
        addContactMatches((contactDups ?? []) as Array<Record<string, unknown>>, customerLookup);
      }
    }

    // Deduplicate and sort by similarity desc
    const unique = Array.from(new Map(duplicates.map(d => [d.id, d])).values())
      .sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({ data: unique });
  })
);
