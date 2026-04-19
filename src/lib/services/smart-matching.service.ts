// ============================================================
// SMART MATCHING SERVICE
// ============================================================
// Business logic for fuzzy-matching unconnected order items
// to source accounts by nick, notes, or nicks_registry.
// Extracted from source-accounts.repo.ts for SRP compliance.

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import {
  listSourceAccounts,
  getSourceAccountById,
} from '@/lib/supabase/repositories/source-accounts.repo';

// ─── Types ────────────────────────────────────────────────────

export interface SmartMatchSuggestion {
  sourceAccountId: string;
  sourceAccountEmail: string;
  orderItemId: string;
  orderItemQuantity: number;
  productNameSnapshot: string;
  customerName: string;
  orderId: string;
  matchedField: 'nick_used' | 'item_notes' | 'registry' | 'reserved_nick';
  matchedValue: string;
  confidence: number;
}

/** Result shape for searchUnconnectedByNickOrNote (M4 fix) */
export interface UnconnectedSearchResult {
  id: string;
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  notes: string | null;
  customer_nick_used: string | null;
  assigned_source_account_id: string | null;
  order_id: string | null;
}

type NickEntry = { nick?: string; username?: string };
type BaseOrderRow = { id: string; customer_id: string };
type BaseCustomerRow = { id: string; full_name: string };
type BaseOrderItemRow = {
  id: string;
  product_id: string | null;
  product_name_snapshot: string | null;
  quantity: number;
  notes: string | null;
  customer_nick_used: string | null;
  assigned_source_account_id: string | null;
  order_id: string | null;
};

// Confidence scores by match type (higher = more reliable)
const CONFIDENCE_MAP: Record<SmartMatchSuggestion['matchedField'], number> = {
  reserved_nick: 100, // Exact match with pre-reserved nick
  nick_used: 90,      // Nick used in order matches source account
  registry: 75,       // Customer's nicks_registry matches
  item_notes: 60,     // Notes-based (lowest confidence)
};

// ─── Shared Helpers (M5 — DRY extraction) ─────────────────────

/**
 * Batch-loads nicks_registry for a set of customer IDs.
 * Gracefully returns empty map if the column doesn't exist.
 */
async function batchLoadNicksRegistry(customerIds: string[]): Promise<Map<string, NickEntry[]>> {
  const nicksMap = new Map<string, NickEntry[]>();
  if (customerIds.length === 0) return nicksMap;

  try {
    const { data: custData } = await supabase
      .from('customers')
      .select('id, nicks_registry')
      .in('id', customerIds);
    for (const c of custData ?? []) {
      nicksMap.set(c.id, (c.nicks_registry as NickEntry[]) ?? []);
    }
  } catch {
    // nicks_registry column may not exist — skip gracefully
  }

  return nicksMap;
}

async function loadOrderContextMaps(accountId: string, orderIds: string[]): Promise<{
  orders: Map<string, BaseOrderRow>;
  customers: Map<string, BaseCustomerRow>;
}> {
  if (orderIds.length === 0) {
    return {
      orders: new Map<string, BaseOrderRow>(),
      customers: new Map<string, BaseCustomerRow>(),
    };
  }

  const ordersResult = await supabase
    .from('orders')
    .select('id, customer_id')
    .eq('account_id', accountId)
    .in('id', orderIds);

  if (ordersResult.error) throw new Error(ordersResult.error.message);

  const orders = new Map<string, BaseOrderRow>();
  for (const row of ordersResult.data ?? []) {
    orders.set(row.id, row as BaseOrderRow);
  }

  const customerIds = [...new Set([...orders.values()].map((order) => order.customer_id).filter(Boolean))];
  const customersResult = await supabase
    .from('customers')
    .select('id, full_name')
    .eq('account_id', accountId)
    .in('id', customerIds);

  if (customersResult.error) throw new Error(customersResult.error.message);

  const customers = new Map<string, BaseCustomerRow>();
  for (const row of customersResult.data ?? []) {
    customers.set(row.id, row as BaseCustomerRow);
  }

  return { orders, customers };
}

/**
 * Extracts unique order IDs from a list of order item rows.
 */
function extractUniqueOrderIds(rows: BaseOrderItemRow[]): string[] {
  return [...new Set(rows.map((item) => item.order_id).filter(Boolean))] as string[];
}

// ─── Search Unconnected ───────────────────────────────────────

/**
 * Search unconnected order_items whose customer_nick_used or notes text-matches a query,
 * filtered to only the products associated with the given source account.
 */
export async function searchUnconnectedByNickOrNote(
  sourceAccountId: string,
  accountId: string,
  query: string
): Promise<UnconnectedSearchResult[]> {
  const sourceAccount = await getSourceAccountById(sourceAccountId, accountId);
  if (!sourceAccount) throw new Error('Source account not found');

  const productIds = sourceAccount.product_ids ?? [];
  if (productIds.length === 0) return [];

  const q = query.trim().toLowerCase();
  if (!q) return [];

  const { data, error } = await supabase
    .from('order_items')
    .select(`
      id, product_id, product_name_snapshot, quantity, notes, customer_nick_used, assigned_source_account_id, order_id
    `)
    .is('assigned_source_account_id', null)
    .in('product_id', productIds);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as BaseOrderItemRow[];

  const orderIds = extractUniqueOrderIds(rows);
  const { orders, customers } = await loadOrderContextMaps(accountId, orderIds);
  const customerIds = [...new Set([...orders.values()].map((order) => order.customer_id).filter(Boolean))];
  const nicksMap = await batchLoadNicksRegistry(customerIds);

  return rows.filter((item) => {
    const nickUsed = (item.customer_nick_used ?? '').toLowerCase();
    const itemNotes = (item.notes ?? '').toLowerCase();
    const order = item.order_id ? orders.get(item.order_id) ?? null : null;
    const customer = order ? customers.get(order.customer_id) ?? null : null;
    const customerName = (customer?.full_name ?? '').toLowerCase();
    const registryNicks = nicksMap.get(order?.customer_id ?? '') ?? [];
    const registryMatch = registryNicks.some((n) =>
      (n.nick ?? n.username ?? '').toLowerCase().includes(q)
    );
    return (
      nickUsed.includes(q) ||
      itemNotes.includes(q) ||
      customerName.includes(q) ||
      registryMatch
    );
  }) as UnconnectedSearchResult[];
}

// ─── Smart Match Scanner ──────────────────────────────────────

/**
 * Scan ALL source accounts for an account and find unconnected order_items
 * that fuzzy-match by nick_used, item notes, or customer nicks_registry.
 * Returns a list of suggested connections.
 */
export async function scanSmartMatches(
  accountId: string
): Promise<SmartMatchSuggestion[]> {
  // 1. Get all source accounts
  const sourceAccounts = await listSourceAccounts(accountId);

  // 2. Get all unconnected order items
  const { data: unconnected, error } = await supabase
    .from('order_items')
    .select(`
      id, product_id, product_name_snapshot, quantity, notes, customer_nick_used, assigned_source_account_id, order_id
    `)
    .is('assigned_source_account_id', null);

  if (error) throw new Error(error.message);

  // 3. Batch-load nicks_registry using shared helper
  const rows = (unconnected ?? []) as BaseOrderItemRow[];
  const orderIds = extractUniqueOrderIds(rows);
  const { orders, customers } = await loadOrderContextMaps(accountId, orderIds);
  const customerIds = [...new Set([...orders.values()].map((order) => order.customer_id).filter(Boolean))];
  const nicksMap = await batchLoadNicksRegistry(customerIds);

  const suggestions: SmartMatchSuggestion[] = [];
  const seen = new Set<string>();

  for (const sa of sourceAccounts) {
    const saEmail = (sa.email ?? '').toLowerCase();
    const saNotes = String(sa.notes ?? '').toLowerCase();
    const productIds: string[] = sa.product_ids ?? [];
    const reservedNicks: string[] = (sa.reserved_nicks ?? []).map((n) => n.toLowerCase());
    const availableSlots = sa.max_slots - sa.used_slots;
    if (availableSlots <= 0 || productIds.length === 0) continue;

    const eligible = rows.filter((item) =>
      productIds.includes(item.product_id as string) && !seen.has(item.id)
    );

    for (const item of eligible) {
      const nickUsed = (item.customer_nick_used ?? '').toLowerCase();
      const itemNotes = (item.notes ?? '').toLowerCase();
      const order = item.order_id ? orders.get(item.order_id) ?? null : null;
      const customer = order ? customers.get(order.customer_id) ?? null : null;
      const registry = nicksMap.get(order?.customer_id ?? '') ?? [];

      let matchedField: SmartMatchSuggestion['matchedField'] | null = null;
      let matchedValue = '';

      if (nickUsed && reservedNicks.includes(nickUsed)) {
        matchedField = 'reserved_nick';
        matchedValue = item.customer_nick_used ?? '';
      } else if (nickUsed && (saEmail.includes(nickUsed) || saNotes.includes(nickUsed))) {
        matchedField = 'nick_used';
        matchedValue = item.customer_nick_used ?? '';
      } else if (itemNotes && (saEmail.includes(itemNotes) || saNotes.includes(itemNotes))) {
        matchedField = 'item_notes';
        matchedValue = item.notes ?? '';
      } else {
        const regMatch = registry.find((n) => {
          const nick = (n.nick ?? n.username ?? '').toLowerCase();
          return nick && (saEmail.includes(nick) || saNotes.includes(nick) || reservedNicks.includes(nick));
        });
        if (regMatch) {
          matchedField = 'registry';
          matchedValue = regMatch.nick ?? regMatch.username ?? '';
        }
      }

      if (matchedField) {
        seen.add(item.id);
        suggestions.push({
          sourceAccountId: sa.id,
          sourceAccountEmail: sa.email ?? '',
          orderItemId: item.id,
          orderItemQuantity: item.quantity,
          productNameSnapshot: item.product_name_snapshot ?? '',
          customerName: customer?.full_name ?? '',
          orderId: order?.id ?? '',
          matchedField,
          matchedValue,
          confidence: CONFIDENCE_MAP[matchedField],
        });
      }
    }
  }

  return suggestions;
}
