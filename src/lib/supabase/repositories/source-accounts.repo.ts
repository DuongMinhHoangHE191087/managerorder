// ============================================================
// SOURCE ACCOUNTS REPOSITORY — Supabase
// Replaces in-memory: listSourceAccounts
// Table: source_accounts
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { cached, invalidate, invalidatePrefix, TTL } from '@/lib/cache/db-cache';
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';

type SourceAccountRow = Database['public']['Tables']['source_accounts']['Row'];
type SourceAccountInsert = Database['public']['Tables']['source_accounts']['Insert'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export type { SourceAccountRow };

const key = {
  list: (accountId: string) => `source_accounts:list:${accountId}`,
  byProduct: (accountId: string, productId: string) => `source_accounts:product:${accountId}:${productId}`,
  item: (id: string, accountId: string) => `source_accounts:item:${id}:${accountId}`,
};

type OrderBaseRow = {
  id: string;
  account_id: string;
  customer_id: string;
  created_at: string;
  status: string;
};

type CustomerBaseRow = {
  id: string;
  full_name: string;
  type: string;
};

type CustomerContactRow = {
  id: string;
  customer_id: string;
  channel: string;
  value: string;
  is_primary: boolean;
  created_at: string;
};

type SourceAccountOrderContext = {
  item: OrderItemRow;
  order: OrderBaseRow | null;
  customer: (CustomerBaseRow & { customer_contacts: CustomerContactRow[] }) | null;
};

async function loadSourceAccountOrderItems(
  sourceAccountId: string | null,
  productIds?: string[],
): Promise<OrderItemRow[]> {
  if (productIds && productIds.length === 0) {
    return [];
  }

  let query = supabase.from('order_items').select('*');
  if (sourceAccountId === null) {
    query = query.is('assigned_source_account_id', null);
  } else {
    query = query.eq('assigned_source_account_id', sourceAccountId);
  }
  if (productIds?.length) {
    query = query.in('product_id', productIds);
  }
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderItemRow[];
}

async function loadOrderContextsForItems(
  items: OrderItemRow[],
  accountId: string,
  includeContacts = false,
): Promise<SourceAccountOrderContext[]> {
  if (items.length === 0) {
    return [];
  }

  const orderIds = [...new Set(items.map((item) => item.order_id).filter(Boolean))];
  const ordersMap = await loadRowsByIds<OrderBaseRow>(
    supabase,
    'orders',
    accountId,
    orderIds,
    'id, account_id, customer_id, created_at, status',
  );

  const customerIds = [...new Set([...ordersMap.values()].map((order) => order.customer_id).filter(Boolean))];
  const customersMap = await loadRowsByIds<CustomerBaseRow>(
    supabase,
    'customers',
    accountId,
    customerIds,
    'id, full_name, type',
  );

  const contactsByCustomer = new Map<string, CustomerContactRow[]>();
  if (includeContacts && customerIds.length > 0) {
    const { data: contacts, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    for (const contact of contacts ?? []) {
      const row = contact as CustomerContactRow;
      const list = contactsByCustomer.get(row.customer_id) ?? [];
      list.push(row);
      contactsByCustomer.set(row.customer_id, list);
    }
  }

  return items.map((item) => {
    const order = ordersMap.get(item.order_id) ?? null;
    const customer = order ? customersMap.get(order.customer_id) ?? null : null;
    return {
      item,
      order,
      customer: customer
        ? {
            ...customer,
            customer_contacts: contactsByCustomer.get(customer.id) ?? [],
          }
        : null,
    };
  });
}

export async function listSourceAccounts(accountId: string): Promise<SourceAccountRow[]> {
  return cached(
    key.list(accountId),
    async () => {
      const { data, error } = await supabase
        .from('source_accounts')
        .select('*')
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    TTL.LIST,
  );
}

export async function getSourceAccountById(
  id: string,
  accountId: string
): Promise<SourceAccountRow | null> {
  return cached(
    key.item(id, accountId),
    async () => {
      const { data, error } = await supabase
        .from('source_accounts')
        .select('*')
        .eq('id', id)
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .single();
      if (error) return null;
      return data;
    },
    TTL.ITEM,
  );
}

export async function getSourceAccountsByProduct(
  accountId: string,
  productId: string
): Promise<SourceAccountRow[]> {
  return cached(
    key.byProduct(accountId, productId),
    async () => {
      const { data, error } = await supabase
        .from('source_accounts')
        .select('*')
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .contains('product_ids', [productId]);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    TTL.ITEM,
  );
}

export async function searchSourceAccountsByEmail(
  query: string,
  accountId: string,
  limit = 5
): Promise<Array<Pick<SourceAccountRow, 'id' | 'email' | 'max_slots' | 'used_slots' | 'provider' | 'expires_at'>>> {
  const keyword = query.trim();
  if (!keyword) return [];

  const { data, error } = await supabase
    .from('source_accounts')
    .select('id, email, max_slots, used_slots, provider, expires_at')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .ilike('email', `%${keyword}%`)
    .order('email')
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSourceAccount(
  accountId: string,
  input: Omit<SourceAccountInsert, 'id' | 'created_at' | 'updated_at'>
): Promise<SourceAccountRow> {
  const { data, error } = await supabase
    .from('source_accounts')
    .insert({ ...input, account_id: accountId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidatePrefix(`source_accounts:list:${accountId}`);
  invalidatePrefix(`source_accounts:product:${accountId}`);
  return data;
}

export async function updateSourceAccountSlots(
  id: string,
  accountId: string,
  usedSlots: number
): Promise<SourceAccountRow> {
  const { data, error } = await supabase
    .from('source_accounts')
    .update({ used_slots: usedSlots, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Source account not found');
  invalidatePrefix(`source_accounts:list:${accountId}`);
  invalidatePrefix(`source_accounts:product:${accountId}`);
  invalidate(key.item(id, accountId));
  return data;
}

export async function updateSourceAccount(
  id: string,
  accountId: string,
  input: Partial<Pick<SourceAccountRow, 'email' | 'provider' | 'max_slots' | 'used_slots' | 'product_ids' | 'notes' | 'expires_at' | 'purchase_cost_vnd' | 'purchase_date' | 'purchase_source'>>
): Promise<SourceAccountRow> {
  const { data, error } = await supabase
    .from('source_accounts')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Source account not found');
  invalidatePrefix(`source_accounts:list:${accountId}`);
  invalidatePrefix(`source_accounts:product:${accountId}`);
  invalidate(key.item(id, accountId));
  return data;
}

export async function deleteSourceAccount(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('source_accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidatePrefix(`source_accounts:list:${accountId}`);
  invalidatePrefix(`source_accounts:product:${accountId}`);
  invalidate(key.item(id, accountId));
}

// ============================================
// CONNECTIONS (Order Items -> Source Account)
// ============================================

export async function getSourceAccountConnections(id: string, accountId: string): Promise<{ connected: Record<string, unknown>[]; unconnected: Record<string, unknown>[] }> {
  const sourceAccount = await getSourceAccountById(id, accountId);
  if (!sourceAccount) throw new Error("Source account not found");

  const [connectedItems, unconnectedItems] = await Promise.all([
    loadSourceAccountOrderItems(id),
    loadSourceAccountOrderItems(null, sourceAccount.product_ids || []),
  ]);

  const [connectedContexts, unconnectedContexts] = await Promise.all([
    loadOrderContextsForItems(connectedItems, accountId, false),
    loadOrderContextsForItems(unconnectedItems, accountId, false),
  ]);

  return {
    connected: connectedContexts
      .filter((context) => Boolean(context.order))
      .map((context) => ({
        ...context.item,
        orders: {
          id: context.order!.id,
          account_id: context.order!.account_id,
          customer_id: context.order!.customer_id,
          customers: context.customer
            ? {
                full_name: context.customer.full_name,
                type: context.customer.type,
              }
            : null,
        },
      })),
    unconnected: unconnectedContexts
      .filter((context) => Boolean(context.order))
      .map((context) => ({
        ...context.item,
        orders: {
          id: context.order!.id,
          account_id: context.order!.account_id,
          customer_id: context.order!.customer_id,
          customers: context.customer
            ? {
                full_name: context.customer.full_name,
                type: context.customer.type,
              }
            : null,
        },
      })),
  };
}

/**
 * Enriched connections — returns full order/customer details for each connected item.
 * Powers the connection-detail-row UI with order status, dates, customer contacts.
 */
export async function getConnectionsEnriched(id: string, accountId: string) {
  const sourceAccount = await getSourceAccountById(id, accountId);
  if (!sourceAccount) throw new Error("Source account not found");

  const items = await loadSourceAccountOrderItems(id);
  const contexts = (await loadOrderContextsForItems(items, accountId, true))
    .filter((context) => Boolean(context.order));

  // Transform into EnrichedConnection shape
  const enriched = contexts.map((context) => {
    const contacts = context.customer?.customer_contacts ?? [];
    const primaryContact = contacts.length ? `${contacts[0].channel}: ${contacts[0].value}` : null;

    return {
      id: context.item.id,
      productId: context.item.product_id,
      productNameSnapshot: context.item.product_name_snapshot,
      quantity: context.item.quantity,
      customerNickUsed: context.item.customer_nick_used ?? null,
      orderId: context.order!.id,
      orderStatus: context.order!.status ?? 'unknown',
      orderCreatedAt: context.order!.created_at,
      customerId: context.order!.customer_id,
      customerName: context.customer?.full_name ?? 'N/A',
      customerContact: primaryContact,
    };
  });

  return enriched;
}

export async function disconnectSourceAccount(sourceAccountId: string, orderItemId: string, accountId: string): Promise<void> {
  // 1. Unlink order item
  const { error: itemError } = await supabase
    .from('order_items')
    .update({ assigned_source_account_id: null })
    .eq('id', orderItemId);
  if (itemError) throw new Error(itemError.message);

  // 2. Auto-recalc used slots to guarantee perfect synchronization
  await recalculateUsedSlots(sourceAccountId, accountId);
}

export async function reconnectSourceAccount(sourceAccountId: string, orderItemId: string, accountId: string): Promise<void> {
  // Invalidate cache first to get fresh slot data (prevent stale reads)
  invalidate(key.item(sourceAccountId, accountId));

  const sourceAccount = await getSourceAccountById(sourceAccountId, accountId);
  if (!sourceAccount) throw new Error("Source account not found");

  const breakdown = await getSlotBreakdown(sourceAccountId, accountId);
  const currentUsed = breakdown.connectedCount + breakdown.reservedCount;

  if (currentUsed >= sourceAccount.max_slots) {
    throw new Error("Không thể kết nối do tài khoản hết slot");
  }

  // 1. Link order item
  const { error: itemError } = await supabase
    .from('order_items')
    .update({ assigned_source_account_id: sourceAccountId })
    .eq('id', orderItemId);
  if (itemError) throw new Error(itemError.message);

  // 2. Auto-recalc used slots to guarantee perfect synchronization
  await recalculateUsedSlots(sourceAccountId, accountId);
}

// ============================================
// RESERVED NICKS (also affects used_slots)
// ============================================

export async function addReservedNick(
  id: string,
  accountId: string,
  nick: string
): Promise<SourceAccountRow> {
  const sa = await getSourceAccountById(id, accountId);
  if (!sa) throw new Error('Source account not found');

  const current = sa.reserved_nicks ?? [];
  const trimmed = nick.trim().toLowerCase();
  if (!trimmed) throw new Error('Nick cannot be empty');
  if (current.includes(trimmed)) throw new Error(`Nick "${trimmed}" đã được đặt trước`);

  // Check slot capacity before reserving
  if (sa.used_slots >= sa.max_slots) {
    throw new Error('Không đủ slot để đặt trước nick này');
  }

  const { data, error } = await supabase
    .from('source_accounts')
    .update({
      reserved_nicks: [...current, trimmed],
      used_slots: sa.used_slots + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Source account not found');

  invalidate(key.item(id, accountId));
  invalidatePrefix(`source_accounts:list:${accountId}`);
  return data;
}

export async function removeReservedNick(
  id: string,
  accountId: string,
  nick: string
): Promise<SourceAccountRow> {
  const sa = await getSourceAccountById(id, accountId);
  if (!sa) throw new Error('Source account not found');

  const trimmed = nick.trim().toLowerCase();
  const current = (sa.reserved_nicks ?? []).filter((n) => n !== trimmed);

  const { data, error } = await supabase
    .from('source_accounts')
    .update({
      reserved_nicks: current,
      used_slots: Math.max(0, sa.used_slots - 1),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Source account not found');

  invalidate(key.item(id, accountId));
  invalidatePrefix(`source_accounts:list:${accountId}`);
  return data;
}

// ============================================
// SLOT RECALCULATION (Sync used_slots from actual data)
// ============================================

export interface SlotBreakdown {
  connectedCount: number;
  reservedCount: number;
  availableCount: number;
  total: number;
  connectedItems: Array<{
    orderItemId: string;
    orderId: string;
    productId: string;
    quantity: number;
    customerName: string;
    nickUsed: string | null;
  }>;
  reservedNicks: string[];
}

export async function getSlotBreakdown(
  id: string,
  accountId: string
): Promise<SlotBreakdown> {
  const sa = await getSourceAccountById(id, accountId);
  if (!sa) throw new Error('Source account not found');

  const connectedItems = await loadSourceAccountOrderItems(id);
  const contexts = (await loadOrderContextsForItems(connectedItems, accountId, false))
    .filter((context) => Boolean(context.order));

  const items = contexts.map((context) => ({
    orderItemId: context.item.id,
    orderId: context.order!.id,
    productId: context.item.product_id as string,
    quantity: context.item.quantity,
    customerName: context.customer?.full_name ?? 'Không rõ',
    nickUsed: context.item.customer_nick_used as string | null,
  }));

  const connectedCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const reservedNicks = sa.reserved_nicks ?? [];
  const reservedCount = reservedNicks.length;
  const total = sa.max_slots;
  const availableCount = Math.max(0, total - connectedCount - reservedCount);

  return {
    connectedCount,
    reservedCount,
    availableCount,
    total,
    connectedItems: items,
    reservedNicks,
  };
}

export async function recalculateUsedSlots(
  id: string,
  accountId: string
): Promise<{ previous: number; recalculated: number; changed: boolean }> {
  const sa = await getSourceAccountById(id, accountId);
  if (!sa) throw new Error('Source account not found');

  const connectedItems = await loadSourceAccountOrderItems(id);
  const contexts = (await loadOrderContextsForItems(connectedItems, accountId, false))
    .filter((context) => Boolean(context.order));

  const connectedSlots = contexts.map((context) => context.item.quantity).reduce(
    (sum, qty) => sum + qty,
    0
  );

  // Reserved nicks count
  const reservedCount = (sa.reserved_nicks ?? []).length;

  // Total actual used slots
  const recalculated = connectedSlots + reservedCount;
  const previous = sa.used_slots;

  if (recalculated !== previous) {
    const { error: updateErr } = await supabase
      .from('source_accounts')
      .update({ used_slots: recalculated, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('account_id', accountId);

    if (updateErr) throw new Error(updateErr.message);

    invalidate(key.item(id, accountId));
    invalidatePrefix(`source_accounts:list:${accountId}`);
  }

  return { previous, recalculated, changed: recalculated !== previous };
}

/**
 * Batch recalculate used_slots for ALL source accounts of an account.
 * Returns summary of which accounts were changed.
 */
export async function recalculateAllSlots(
  accountId: string
): Promise<{ total: number; changed: number; results: Array<{ id: string; email: string; previous: number; recalculated: number }> }> {
  const accounts = await listSourceAccounts(accountId);
  const results: Array<{ id: string; email: string; previous: number; recalculated: number }> = [];
  let changed = 0;

  for (const sa of accounts) {
    const result = await recalculateUsedSlots(sa.id, accountId);
    if (result.changed) {
      changed++;
      results.push({
        id: sa.id,
        email: sa.email ?? '',
        previous: result.previous,
        recalculated: result.recalculated,
      });
    }
  }

  return { total: accounts.length, changed, results };
}
