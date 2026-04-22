import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePlanName, normalizePaymentStatus } from "@/lib/utils";
import { generateOrderCode } from "@/lib/utils/order-code";

// Re-export schema, types, and validation from shared module (client+server safe)
export {
  importOrderSchema,
  bulkImportSchema,
  preValidateRecords,
  type ImportRecord,
  type ValidationError,
  type ValidationWarning,
  type PreValidationResult,
} from "./import-validation";

import type { ImportRecord } from "./import-validation";

// ── Helpers ────────────────────────────────────────────────────────

/** Normalise a string for case-insensitive DB lookup */
function lc(str: string | undefined | null): string {
  return (str ?? '').toLowerCase().trim();
}

/** Determine final order status from Excel payment status field */
export function resolveOrderStatus(record: ImportRecord): string {
  if (record.normalizedStatus) return record.normalizedStatus;
  if (record.rawPaymentStatus) return normalizePaymentStatus(record.rawPaymentStatus);
  if (record.totalPaid >= record.totalAmountVnd && record.totalAmountVnd > 0) return 'paid';
  if (record.totalPaid > 0) return 'pending_payment';
  return 'draft';
}

interface ProductLite {
  id: string;
  name: string;
  buy_price_vnd?: number;
  [key: string]: unknown;
}

/** Match a plan name against existing products (exact then best partial) */
export function findProductByPlanSlug<T extends ProductLite>(
  planName: string,
  productMap: Map<string, T>
): T | undefined {
  const slug = normalizePlanName(planName);
  if (productMap.has(slug)) return productMap.get(slug);

  // Collect all partial matches, then pick the longest key (most specific)
  let bestMatch: T | undefined;
  let bestLen = 0;
  for (const [key, product] of productMap.entries()) {
    if (key.includes(slug) || slug.includes(key)) {
      if (key.length > bestLen) {
        bestMatch = product;
        bestLen = key.length;
      }
    }
  }
  return bestMatch;
}

// ── Service ────────────────────────────────────────────────────────

export interface ImportResult {
  importedCount: number;
  customersCreated: number;
  ctvCreated: number;
  productsCreated: number;
  orderIds: string[];
  itemErrors: string[];
  duplicateCodesSkipped: number;
}

/** Callback for tracking import progress */
export type ImportProgressCallback = (phase: string, current: number, total: number) => void;

export class ImportService {
  /**
   * Step 1: Resolve import records to customer IDs — matches existing or creates new.
   * Returns a map of import-key → customer_id.
   */
  async resolveCustomers(
    accountId: string,
    records: ImportRecord[]
  ): Promise<{ customerResolutionMap: Map<string, string>; customersCreated: number; ctvCreated: number }> {
    // Fetch existing customers + contacts using base tables
    const { data: customers, error: customersError } = await supabaseAdmin
      .from("customers")
      .select("id, full_name")
      .eq("account_id", accountId);
    if (customersError) throw new Error(customersError.message);

    const customerIds = (customers ?? []).map((row) => row.id);
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("customer_contacts")
      .select("customer_id, channel, value")
      .in("customer_id", customerIds);
    if (contactsError) throw new Error(contactsError.message);

    // Build lookup maps
    const nameMap = new Map<string, string>();
    const duolingoMap = new Map<string, string>();
    const facebookMap = new Map<string, string>();

    const contactsByCustomer = new Map<string, { channel: string; value: string | null }[]>();
    for (const contact of contacts ?? []) {
      const list = contactsByCustomer.get(contact.customer_id) ?? [];
      list.push({ channel: contact.channel, value: contact.value });
      contactsByCustomer.set(contact.customer_id, list);
    }

    (customers || []).forEach(c => {
      nameMap.set(lc(c.full_name), c.id);
      (contactsByCustomer.get(c.id) ?? []).forEach((contact: { channel: string; value: string | null }) => {
        if (contact.channel === 'duolingo') duolingoMap.set(lc(contact.value), c.id);
        if (contact.channel === 'facebook' && contact.value) facebookMap.set(contact.value.trim(), c.id);
      });
    });

    // Determine new customers + resolve existing
    const customersToCreate = new Map<string, {
      full_name: string;
      type: 'retail' | 'wholesale' | 'agency';
      duolingoUsername?: string;
      duolingoId?: string;
      facebookUrl?: string;
      contactChannels?: { channel: string; value: string }[];
    }>();
    const customerResolutionMap = new Map<string, string>();
    const ctvNamesToCreate = new Set<string>();

    for (const record of records) {
      const importKey = (record.duolingoUsername || record.customerName).toLowerCase();

      let resolvedId: string | undefined;
      if (record.duolingoUsername && duolingoMap.has(lc(record.duolingoUsername))) {
        resolvedId = duolingoMap.get(lc(record.duolingoUsername));
      } else if (record.facebookUrl && facebookMap.has(record.facebookUrl.trim())) {
        resolvedId = facebookMap.get(record.facebookUrl.trim());
      } else if (nameMap.has(lc(record.customerName))) {
        resolvedId = nameMap.get(lc(record.customerName));
      }

      if (resolvedId) {
        customerResolutionMap.set(importKey, resolvedId);
      } else if (!customersToCreate.has(importKey)) {
        customersToCreate.set(importKey, {
          full_name: record.customerName,
          type: 'retail',
          duolingoUsername: record.duolingoUsername,
          duolingoId: record.duolingoId,
          facebookUrl: record.facebookUrl,
          contactChannels: record._contactChannels,
        });
      }

      // BUG 8 fix: also check customerResolutionMap to avoid creating
      // CTV that was just resolved or created in this batch
      if (record.ctvName && !nameMap.has(lc(record.ctvName)) && !customerResolutionMap.has(lc(record.ctvName))) {
        ctvNamesToCreate.add(record.ctvName.trim());
      }
    }

    // Bulk-create new regular customers
    if (customersToCreate.size > 0) {
      const inserts = Array.from(customersToCreate.entries()).map(([, c]) => ({
        account_id: accountId,
        full_name: c.full_name,
        type: c.type,
      }));

      const { data: insertedCustomers, error: insertCustErr } = await supabaseAdmin
        .from('customers')
        .insert(inserts)
        .select('id, full_name');

      if (insertCustErr) throw new Error(insertCustErr.message);

      const contactInserts: {
        customer_id: string; channel: string; value: string; is_primary: boolean;
      }[] = [];

      // BUG 4 fix: match by importKey instead of full_name to prevent same-name collisions
      const pendingKeys = Array.from(customersToCreate.entries());
      insertedCustomers?.forEach((newC) => {
        const matched = pendingKeys.find(([, c]) => c.full_name === newC.full_name);
        if (matched) {
          const [importKey, cReq] = matched;
          customerResolutionMap.set(importKey, newC.id);
          // Also add to nameMap so future lookups find this customer
          nameMap.set(lc(newC.full_name), newC.id);
          // Remove from pendingKeys to prevent re-matching same full_name
          const matchIdx = pendingKeys.indexOf(matched);
          if (matchIdx >= 0) pendingKeys.splice(matchIdx, 1);

          if (cReq.duolingoUsername) {
            contactInserts.push({ customer_id: newC.id, channel: 'duolingo', value: cReq.duolingoUsername, is_primary: true });
          }
          if (cReq.facebookUrl) {
            contactInserts.push({ customer_id: newC.id, channel: 'facebook', value: cReq.facebookUrl, is_primary: false });
          }
          // Insert all flexible contact channels
          if (cReq.contactChannels) {
            cReq.contactChannels.forEach((ch, idx) => {
              // Avoid duplicating duolingo & facebook already inserted above
              if (ch.channel === 'duolingo' || ch.channel === 'facebook') return;
              contactInserts.push({
                customer_id: newC.id,
                channel: ch.channel,
                value: ch.value,
                is_primary: idx === 0 && !cReq.duolingoUsername,
              });
            });
          }
        }
      });

      if (contactInserts.length > 0) {
        await supabaseAdmin.from('customer_contacts').insert(contactInserts);
      }
    }

    // Bulk-create CTV (agency) customers
    if (ctvNamesToCreate.size > 0) {
      const ctvInserts = Array.from(ctvNamesToCreate).map(name => ({
        account_id: accountId,
        full_name: name,
        type: 'agency' as const,
      }));
      const { data: insertedCtvs } = await supabaseAdmin
        .from('customers')
        .insert(ctvInserts)
        .select('id, full_name');

      // Save CTV to name map so orders referencing CTV can resolve correctly
      insertedCtvs?.forEach(ctv => {
        nameMap.set(lc(ctv.full_name), ctv.id);
      });
    }

    return {
      customerResolutionMap,
      customersCreated: customersToCreate.size,
      ctvCreated: ctvNamesToCreate.size,
    };
  }

  /**
   * Step 2: Resolve product names to IDs — matches existing or creates new.
   * Returns productMap AND count of newly created products.
   */
  async resolveProducts(
    accountId: string,
    records: ImportRecord[]
  ): Promise<{ productMap: Map<string, ProductLite>; productsCreated: number }> {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, buy_price_vnd, sell_price_vnd, duration_type, duration_value')
      .eq('account_id', accountId);

    const productMap = new Map<string, ProductLite>();
    (products || []).forEach(p => {
      productMap.set(normalizePlanName(p.name), p);
    });

    const productsToCreate = new Set<string>();
    for (const record of records) {
      if (!findProductByPlanSlug(record.productName, productMap)) {
        productsToCreate.add(record.productName);
      }
    }

    if (productsToCreate.size > 0) {
      const newProducts = Array.from(productsToCreate).map(name => ({
        account_id: accountId,
        name,
        buy_price_vnd: 0,
        sell_price_vnd: 0,
        duration_type: 'months',
        duration_value: 1,
        is_active: true,
      }));
      const { data: insertedProducts } = await supabaseAdmin
        .from('products')
        .insert(newProducts)
        .select('*');
      insertedProducts?.forEach(p => productMap.set(normalizePlanName(p.name), p));
    }

    return { productMap, productsCreated: productsToCreate.size };
  }

  /**
   * Step 3: Build order rows for insert.
   */
  buildOrderInserts(
    accountId: string,
    records: ImportRecord[],
    customerResolutionMap: Map<string, string>,
    productMap: Map<string, ProductLite>
  ) {
    return records.map(record => {
      const importKey = (record.duolingoUsername || record.customerName).toLowerCase();
      const customerId = customerResolutionMap.get(importKey);
      const product = findProductByPlanSlug(record.productName, productMap);
      const status = resolveOrderStatus(record);

      let salesNote = record.salesNote || '';
      if (record.ctvName) {
        salesNote = salesNote ? `${salesNote} | CTV: ${record.ctvName}` : `CTV: ${record.ctvName}`;
      }
      if (record.sourceUsername) {
        salesNote = salesNote ? `${salesNote} | Family: ${record.sourceUsername}` : `Family: ${record.sourceUsername}`;
      }
      if (record.idFamily) {
        salesNote = salesNote ? `${salesNote} | ID Family: ${record.idFamily}` : `ID Family: ${record.idFamily}`;
      }

      return {
        account_id: accountId,
        order_code: record.orderCode || generateOrderCode(record.endDate),
        customer_id: customerId ?? null,
        product_id: product?.id ?? null,
        product_name_snapshot: record.productName,
        quantity: record.quantity,
        unit_price_vnd: record.quantity && record.quantity > 0 ? record.totalAmountVnd / record.quantity : record.totalAmountVnd,
        cost_price_vnd: Number(product?.buy_price_vnd || 0),
        total_cost_vnd: Number(product?.buy_price_vnd || 0) * (record.quantity || 1),
        total_amount_vnd: record.totalAmountVnd,
        total_paid: record.totalPaid,
        payment_method: record.paymentMethod,
        sales_note: salesNote || null,
        contact_snapshot: record._contactChannels && record._contactChannels.length > 0
          ? record._contactChannels.map(c => `${c.channel}:${c.value}`).join(' | ')
          : record.duolingoUsername || record.facebookUrl || null,
        status,
        created_at: record.startDate
          ? (record.startDate.includes('T') ? record.startDate : `${record.startDate}T00:00:00+07:00`)
          : new Date().toISOString(),
        expires_at: record.endDate || null,
      };
    });
  }

  /**
   * Step 4: Build order item rows for insert.
   */
  buildOrderItemInserts(
    insertedOrders: Array<{ id: string; product_id: string | null }>,
    records: ImportRecord[],
    productMap: Map<string, ProductLite>
  ) {
    return insertedOrders.map((order, idx) => {
      const record = records[idx];
      const product = findProductByPlanSlug(record.productName, productMap);
      return {
        order_id: order.id,
        product_id: order.product_id,
        product_name_snapshot: record.productName,
        quantity: record.quantity,
        price_vnd: record.totalAmountVnd / (record.quantity || 1),
        cost_price_vnd: product?.buy_price_vnd || 0,
        subtotal_vnd: record.totalAmountVnd,
      };
    });
  }

  // ── MULTI-STEP BULK IMPORT (v5 — validation + idempotency) ──────
  /**
   * Multi-step import using direct Supabase inserts.
   * Steps:
   *   1+2. Resolve customers + products IN PARALLEL
   *   3. Build order rows + idempotency guard (skip existing order_codes)
   *   4. Insert orders in batches of 1000
   *   5. Build & insert order items (collect errors instead of swallowing)
   *
   * v5 improvements over v4:
   *   - Accurate productsCreated count
   *   - Idempotency guard: skip orders with existing order_code
   *   - Item insert errors collected and returned (not swallowed)
   *   - duplicateCodesSkipped metric for transparency
   */
  async bulkImportAtomic(
    accountId: string,
    records: ImportRecord[],
    onProgress?: ImportProgressCallback
  ): Promise<ImportResult> {
    // ── Step 1+2: Resolve customers & products IN PARALLEL ──────
    onProgress?.('resolving', 0, records.length);

    const [customerResult, productResult] = await Promise.all([
      this.resolveCustomers(accountId, records),
      this.resolveProducts(accountId, records),
    ]);

    const { customerResolutionMap, customersCreated, ctvCreated } = customerResult;
    const { productMap, productsCreated } = productResult;

    // ── Step 3: Build order rows ────────────────────────────────
    onProgress?.('building', 0, records.length);
    let orderRows = this.buildOrderInserts(accountId, records, customerResolutionMap, productMap);
    // Track records in parallel so we can correctly map orders → items later
    let filteredRecords = [...records];

    // ── Step 3.5: Idempotency guard — skip existing order_codes ─
    let duplicateCodesSkipped = 0;
    const orderCodes = orderRows.map(r => r.order_code).filter(Boolean);
    if (orderCodes.length > 0) {
      // Check in batches of 500 to avoid query limits
      const CODE_CHECK_BATCH = 500;
      const existingCodeSet = new Set<string>();
      for (let i = 0; i < orderCodes.length; i += CODE_CHECK_BATCH) {
        const codeBatch = orderCodes.slice(i, i + CODE_CHECK_BATCH);
        const { data: dupes } = await supabaseAdmin
          .from('orders')
          .select('order_code')
          .eq('account_id', accountId)
          .in('order_code', codeBatch);
        dupes?.forEach(d => existingCodeSet.add(d.order_code));
      }
      if (existingCodeSet.size > 0) {
        duplicateCodesSkipped = orderRows.filter(r => existingCodeSet.has(r.order_code)).length;
        // Filter both orderRows AND filteredRecords in sync
        const keepIndices = orderRows.map((r, i) => existingCodeSet.has(r.order_code) ? -1 : i).filter(i => i >= 0);
        orderRows = keepIndices.map(i => orderRows[i]);
        filteredRecords = keepIndices.map(i => filteredRecords[i]);
      }
    }

    if (orderRows.length === 0) {
      return {
        importedCount: 0,
        customersCreated,
        ctvCreated,
        productsCreated,
        orderIds: [],
        itemErrors: [],
        duplicateCodesSkipped,
      };
    }

    // ── Step 4: Insert orders in batches of 1000 ────────────────
    const BATCH_SIZE = 1000;
    const allInsertedOrders: Array<{ id: string; product_id: string | null }> = [];

    for (let i = 0; i < orderRows.length; i += BATCH_SIZE) {
      const batch = orderRows.slice(i, i + BATCH_SIZE);
      const { data: inserted, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert(batch)
        .select('id, product_id');

      if (orderErr) {
        throw new Error(`Order insert failed at batch ${Math.floor(i / BATCH_SIZE) + 1}: ${orderErr.message}`);
      }
      if (inserted) {
        allInsertedOrders.push(...inserted);
      }
      onProgress?.('inserting_orders', Math.min(i + BATCH_SIZE, orderRows.length), orderRows.length);
    }

    // ── Step 5: Build & insert order items (collect errors) ─────
    const itemErrors: string[] = [];
    if (allInsertedOrders.length > 0) {
      // Use filteredRecords (not original records) — indices match after idempotency filter
      const itemRows = this.buildOrderItemInserts(allInsertedOrders, filteredRecords.slice(0, allInsertedOrders.length), productMap);

      for (let i = 0; i < itemRows.length; i += BATCH_SIZE) {
        const batch = itemRows.slice(i, i + BATCH_SIZE);
        const { error: itemErr } = await supabaseAdmin
          .from('order_items')
          .insert(batch);

        if (itemErr) {
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          itemErrors.push(`Batch ${batchNum}: ${itemErr.message}`);
          console.error(`[Import] Order items batch ${batchNum} failed:`, itemErr.message);
        }
        onProgress?.('inserting_items', Math.min(i + BATCH_SIZE, itemRows.length), itemRows.length);
      }
    }

    return {
      importedCount: allInsertedOrders.length,
      customersCreated,
      ctvCreated,
      productsCreated,
      orderIds: allInsertedOrders.map(o => o.id),
      itemErrors,
      duplicateCodesSkipped,
    };
  }
}
