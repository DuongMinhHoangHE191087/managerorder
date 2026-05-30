// ============================================================
// ORDERS REPOSITORY — Supabase
// Replaces in-memory: listOrders, createOrder,
//                     updateOrderStatus, deleteOrder
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { cached, invalidate, invalidatePrefix, TTL } from '@/lib/cache/db-cache';
import { derivePaymentState } from '@/lib/domain/financial';
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';
import { filterRowsBySearchQuery, hasSearchTokens, paginateRows } from '@/shared/lib/filtering/search';
import {
  buildLocalDebtOrders,
  buildLocalOrderCandidatesByCode,
  buildLocalOrderExportRows,
  buildLocalOrderNickMatches,
  buildLocalOrderRows,
  buildLocalOrderStats,
  buildLocalOrderWithItems,
  buildLocalOrderWithItemsByCode,
  buildLocalOrdersForTelegramSearch,
  buildLocalOrdersPaginated,
  buildLocalRecentCustomerOrders,
  invalidateOrderFixtureState,
  isLocalOrderFixtureAccount,
} from './orders.local-fixtures';

export type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
export type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

/** Full order joined with its line items — used for detail views and invoices. */
export interface OrderWithItems extends OrderRow {
  items: (OrderItemRow & { 
    assigned_source_account?: { id: string; email: string; provider: string } | null;
    license_keys?: { id: string; key_code: string }[] | null;
  })[];
  customer?: { id: string; full_name: string; type?: string; avatar_url?: string | null; customer_contacts: { id: string; channel: string; value: string; is_verified: boolean }[] } | null;
  product?: { id: string; name: string; mode?: string; icon_url?: string | null } | null;
  sales_channel?: { id: string; name: string } | null;
  payment_source?: { id: string; name: string; icon: string | null } | null;
}

export interface TelegramOrderSummary {
  id: string;
  order_code: string | null;
  status: string | null;
  total_amount_vnd: number | null;
  total_paid: number | null;
  product_name_snapshot: string | null;
  created_at: string | null;
  expires_at: string | null;
  customer: {
    id?: string | null;
    full_name: string | null;
  } | null;
}

export interface TelegramOrderNickMatch {
  customer_nick_used: string | null;
  product_name_snapshot: string | null;
  order: {
    order_code: string | null;
    status: string | null;
    customer: {
      full_name: string | null;
    } | null;
  } | null;
}

function adjustEndDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

type OrderRelationRow = Pick<OrderRow, 'id' | 'customer_id' | 'product_id'> & {
  order_code?: string | null;
  quantity?: number | null;
  total_amount_vnd?: number | null;
  total_cost_vnd?: number | null;
  total_paid?: number | null;
  status?: string | null;
  payment_method?: string | null;
  payment_terms?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  product_name_snapshot?: string | null;
  payment_source_id?: string | null;
  sales_channel_id?: string | null;
};

type OrderCustomerRow = {
  id: string;
  full_name: string;
  type: string | null;
  avatar_url?: string | null;
  customer_contacts?: CustomerContactRow[];
};

type OrderProductRow = {
  id: string;
  name: string;
  mode: string | null;
  icon_url?: string | null;
};

type OrderPaymentSourceRow = {
  id: string;
  name: string;
  icon: string | null;
};

type OrderSalesChannelRow = {
  id: string;
  name: string;
};

type CustomerContactRow = {
  id: string;
  customer_id: string;
  channel: string;
  value: string;
  is_verified: boolean;
  created_at: string;
};

type EnrichedOrderSearchRow = OrderRelationRow & {
  customer: {
    id: string;
    full_name: string;
    type: string | null;
    customer_contacts: CustomerContactRow[];
  } | null;
  product: OrderProductRow | null;
  payment_source: OrderPaymentSourceRow | null;
  sales_channel: OrderSalesChannelRow | null;
};

async function loadOrderRelationMaps(
  accountId: string,
  rows: OrderRelationRow[],
  includeContacts = false,
): Promise<{
  customers: Map<string, OrderCustomerRow>;
  products: Map<string, OrderProductRow>;
  paymentSources: Map<string, OrderPaymentSourceRow>;
  salesChannels: Map<string, OrderSalesChannelRow>;
  contacts: Map<string, CustomerContactRow[]>;
}> {
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter((id): id is string => Boolean(id)))];
  const paymentSourceIds = [...new Set(rows.map((row) => row.payment_source_id).filter((id): id is string => Boolean(id)))];
  const salesChannelIds = [...new Set(rows.map((row) => row.sales_channel_id).filter((id): id is string => Boolean(id)))];

  const [customers, products, paymentSources, salesChannels] = await Promise.all([
    loadRowsByIds<OrderCustomerRow>(
      supabase,
      'customers',
      accountId,
      customerIds,
      'id, full_name, type, avatar_url',
    ),
    loadRowsByIds<OrderProductRow>(
      supabase,
      'products',
      accountId,
      productIds,
      'id, name, mode, icon_url',
    ),
    loadRowsByIds<OrderPaymentSourceRow>(
      supabase,
      'payment_sources',
      accountId,
      paymentSourceIds,
      'id, name, icon',
    ),
    loadRowsByIds<OrderSalesChannelRow>(
      supabase,
      'sales_channels',
      accountId,
      salesChannelIds,
      'id, name',
    ),
  ]);

  let contacts = new Map<string, CustomerContactRow[]>();
  if (includeContacts && customerIds.length > 0) {
    const { data, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    contacts = new Map();
    for (const row of data ?? []) {
      const contact = row as CustomerContactRow;
      const list = contacts.get(contact.customer_id) ?? [];
      list.push(contact);
      contacts.set(contact.customer_id, list);
    }
  }

  return { customers, products, paymentSources, salesChannels, contacts };
}

function attachOrderRelations<T extends OrderRelationRow & Record<string, unknown>>(
  rows: T[],
  maps: {
    customers: Map<string, OrderCustomerRow>;
    products: Map<string, OrderProductRow>;
    paymentSources: Map<string, OrderPaymentSourceRow>;
    salesChannels: Map<string, OrderSalesChannelRow>;
    contacts: Map<string, CustomerContactRow[]>;
  },
  includeContacts = false,
) {
  return rows.map((row) => {
    const customer = maps.customers.get(row.customer_id) ?? null;
    const productId = row.product_id ?? null;
    const paymentSourceId = row.payment_source_id ?? null;
    const salesChannelId = row.sales_channel_id ?? null;
    return {
      ...row,
      customer: customer
        ? {
            ...customer,
            avatar_url: customer.avatar_url,
            customer_contacts: includeContacts
              ? maps.contacts.get(customer.id) ?? []
              : customer.customer_contacts ?? [],
          }
        : null,
      product: productId
        ? maps.products.get(productId)
          ? {
              ...maps.products.get(productId)!,
              icon_url: maps.products.get(productId)!.icon_url,
            }
          : null
        : null,
      payment_source: paymentSourceId ? maps.paymentSources.get(paymentSourceId) ?? null : null,
      sales_channel: salesChannelId ? maps.salesChannels.get(salesChannelId) ?? null : null,
    };
  });
}

const key = {
  list: (accountId: string) => `orders:list:${accountId}`,
  item: (id: string, accountId: string) => `orders:item:${id}:${accountId}`,
  itemWithItems: (id: string, accountId: string) => `orders:itemWithItems:${id}:${accountId}`,
};

async function shouldUseLocalOrderFixtures(accountId: string): Promise<boolean> {
  return isLocalOrderFixtureAccount(accountId);
}

async function loadOrdersForFiltering(
  accountId: string,
  params: Omit<GetOrdersParams, 'page' | 'limit'>,
) {
  const { data, error } = await buildOrdersBaseQuery(
    accountId,
    {
      customerId: params.customerId,
      status: params.status,
      date_from: params.date_from,
      date_to: params.date_to,
    },
    false,
  );

  if (error) {
    throw new Error(error.message);
  }

  const baseRows = (data ?? []) as OrderRelationRow[];
  const maps = await loadOrderRelationMaps(accountId, baseRows, true);
  const enrichedRows = attachOrderRelations(baseRows, maps, true) as EnrichedOrderSearchRow[];

  const filteredBySearch = filterRowsBySearchQuery(
    enrichedRows,
    params.search ?? '',
    (row) => [
      row.id,
      row.order_code,
      row.product_name_snapshot,
      row.status,
      row.payment_method,
      row.payment_terms,
      row.customer?.full_name,
      row.customer?.customer_contacts,
      row.product?.name,
      row.sales_channel?.name,
      row.payment_source?.name,
    ],
  );

  return filteredBySearch.filter((row) => matchesOrderPaymentState(row, params.paymentState));
}

export async function listOrders(accountId: string): Promise<OrderRow[]> {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderRows(accountId) as OrderRow[];
  }

  return cached(
    key.list(accountId),
    async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const maps = await loadOrderRelationMaps(accountId, (data ?? []) as OrderRelationRow[], false);
      return attachOrderRelations(data ?? [], maps, false) as OrderRow[];
    },
    TTL.LIST,
  );
}

/**
 * Get a single order with all its line items.
 * Used for detail views, payment reconciliation, and invoice generation.
 */
export async function getOrderWithItems(
  id: string,
  accountId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<OrderWithItems | null> {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderWithItems(accountId, id);
  }

  return loadOrderWithItemsFallback(id, accountId, options.includeDeleted ?? false);
}

async function loadOrderWithItemsFallback(
  id: string,
  accountId: string,
  includeDeleted = false,
): Promise<OrderWithItems | null> {
  let orderQuery = supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('account_id', accountId);

  if (!includeDeleted) {
    orderQuery = orderQuery.is('deleted_at', null);
  }

  const { data: orderData, error: orderError } = await orderQuery.single();

  if (orderError || !orderData) {
    return null;
  }

  const [itemsResult, keysResult, customerContactsResult] = await Promise.all([
    supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('license_keys')
      .select('id, key_code, product_id')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', orderData.customer_id)
      .order('created_at', { ascending: true }),
  ]);

  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (keysResult.error) throw new Error(keysResult.error.message);
  if (customerContactsResult.error) throw new Error(customerContactsResult.error.message);

  const rawItems = itemsResult.data ?? [];
  const accountIds = rawItems
    .map((item) => item.assigned_source_account_id)
    .filter((value): value is string => Boolean(value));
  const [sourceAccountsMap, customerMap, productMap, paymentSourceMap, salesChannelMap] = await Promise.all([
    (async () => {
      if (accountIds.length === 0) {
        return new Map<string, { id: string; email: string; provider: string }>();
      }

      const { data: accounts, error } = await supabase
        .from('source_accounts')
        .select('id, email, provider')
        .eq('account_id', accountId)
        .in('id', accountIds)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return new Map((accounts ?? []).map((row) => [row.id, row] as const));
    })(),
    loadRowsByIds<OrderCustomerRow>(
      supabase,
      'customers',
      accountId,
      orderData.customer_id ? [orderData.customer_id] : [],
      'id, full_name, type, avatar_url',
    ),
    loadRowsByIds<{ id: string; name: string; mode?: string; icon_url?: string | null }>(
      supabase,
      'products',
      accountId,
      orderData.product_id ? [orderData.product_id] : [],
      'id, name, mode, icon_url',
    ),
    loadRowsByIds<{ id: string; name: string; icon: string | null }>(
      supabase,
      'payment_sources',
      accountId,
      orderData.payment_source_id ? [orderData.payment_source_id] : [],
      'id, name, icon',
    ),
    loadRowsByIds<{ id: string; name: string }>(
      supabase,
      'sales_channels',
      accountId,
      orderData.sales_channel_id ? [orderData.sales_channel_id] : [],
      'id, name',
    ),
  ]);

  const customer = customerMap.get(orderData.customer_id) ?? null;
  const product = orderData.product_id ? productMap.get(orderData.product_id) ?? null : null;
  const paymentSource = orderData.payment_source_id ? paymentSourceMap.get(orderData.payment_source_id) ?? null : null;
  const salesChannel = orderData.sales_channel_id ? salesChannelMap.get(orderData.sales_channel_id) ?? null : null;
  const customerContacts = (customerContactsResult.data ?? []) as {
    id: string;
    customer_id: string;
    channel: string;
    value: string;
    is_verified: boolean;
  }[];

  const items = rawItems.map((item) => ({
    ...item,
    assigned_source_account: item.assigned_source_account_id
      ? sourceAccountsMap.get(item.assigned_source_account_id) ?? null
      : null,
    license_keys: keysResult.data?.filter((key) => key.product_id === item.product_id) ?? [],
  }));

  return {
    ...orderData,
    customer: customer
      ? {
          id: customer.id,
          full_name: customer.full_name,
          type: customer.type,
          avatar_url: customer.avatar_url,
          customer_contacts: customerContacts,
        }
      : null,
    product: product
      ? {
          id: product.id,
          name: product.name,
          mode: product.mode,
          icon_url: product.icon_url,
        }
      : null,
    payment_source: paymentSource
      ? {
          id: paymentSource.id,
          name: paymentSource.name,
          icon: paymentSource.icon,
        }
      : null,
    sales_channel: salesChannel
      ? {
          id: salesChannel.id,
          name: salesChannel.name,
        }
      : null,
    items,
  } as OrderWithItems;
}

export async function getOrderWithItemsByCode(
  orderCode: string,
  accountId: string
): Promise<OrderWithItems | null> {
  const normalizedCode = orderCode.trim().toUpperCase();
  if (!normalizedCode) return null;

  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderWithItemsByCode(accountId, normalizedCode);
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .ilike('order_code', normalizedCode)
    .maybeSingle();

  if (error || !data?.id) return null;
  return getOrderWithItems(data.id, accountId);
}

export async function findOrderCandidatesByCode(
  orderCode: string,
  accountId: string,
  limit = 5
): Promise<TelegramOrderSummary[]> {
  const normalizedCode = orderCode.trim().toUpperCase();
  if (!normalizedCode) return [];

  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderCandidatesByCode(accountId, normalizedCode, limit);
  }

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_code,
      status,
      total_amount_vnd,
      total_paid,
      product_name_snapshot,
      created_at,
      expires_at,
      customer_id,
      product_id
    `)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .ilike('order_code', `%${normalizedCode}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const maps = await loadOrderRelationMaps(accountId, (data ?? []) as unknown as OrderRelationRow[], false);
  return attachOrderRelations(data ?? [], maps, false) as unknown as TelegramOrderSummary[];
}

export async function searchOrdersForTelegram(
  query: string,
  accountId: string,
  limit = 5
): Promise<TelegramOrderSummary[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrdersForTelegramSearch(accountId, keyword, limit);
  }

  const [byCode, byProduct] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id,
        order_code,
        status,
        total_amount_vnd,
        total_paid,
        product_name_snapshot,
        created_at,
        expires_at,
        customer_id,
        product_id
      `)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .ilike('order_code', `%${keyword}%`)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('orders')
      .select(`
        id,
        order_code,
        status,
        total_amount_vnd,
        total_paid,
        product_name_snapshot,
        created_at,
        expires_at,
        customer_id,
        product_id
      `)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .ilike('product_name_snapshot', `%${keyword}%`)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (byCode.error) throw new Error(byCode.error.message);
  if (byProduct.error) throw new Error(byProduct.error.message);

  const merged = [...(byCode.data ?? []), ...(byProduct.data ?? [])];
  const deduped = Array.from(new Map(merged.map((row) => [row.id, row])).values()).slice(0, limit);
  const customerIds = [...new Set(
    deduped
      .map((row) => row.customer_id)
      .filter((id): id is string => Boolean(id))
  )];
  const customersMap = customerIds.length > 0
    ? await loadRowsByIds<OrderCustomerRow>(
        supabase,
        'customers',
        accountId,
        customerIds,
        'id, full_name, type',
      )
    : new Map<string, OrderCustomerRow>();

  return deduped.map((row) => {
    const customer = row.customer_id ? customersMap.get(row.customer_id) ?? null : null;
    return {
      id: row.id,
      order_code: row.order_code,
      status: row.status,
      total_amount_vnd: row.total_amount_vnd,
      total_paid: row.total_paid,
      product_name_snapshot: row.product_name_snapshot,
      created_at: row.created_at,
      expires_at: row.expires_at,
      customer: customer
        ? {
            id: customer.id,
            full_name: customer.full_name,
          }
        : null,
    };
  }) as TelegramOrderSummary[];
}

export async function searchOrderNicksForTelegram(
  query: string,
  accountId: string,
  limit = 5
): Promise<TelegramOrderNickMatch[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderNickMatches(accountId, keyword, limit);
  }

  const { data, error } = await supabase
    .from('order_items')
    .select(`
      customer_nick_used,
      product_name_snapshot,
      order_id
    `)
    .eq('account_id', accountId)
    .ilike('customer_nick_used', `%${keyword}%`)
    .limit(limit);

  if (error) throw new Error(error.message);

  const orderIds = [...new Set((data ?? []).map((row) => row.order_id).filter((id): id is string => Boolean(id)))];
  const ordersMap = orderIds.length > 0
    ? await loadRowsByIds<OrderRow>(
        supabase,
        'orders',
        accountId,
        orderIds,
        'id, account_id, customer_id, order_code, status',
      )
    : new Map<string, OrderRow>();

  const customerIds = [...new Set(
    [...ordersMap.values()]
      .map((order) => order.customer_id)
      .filter((id): id is string => Boolean(id))
  )];
  const customersMap = customerIds.length > 0
    ? await loadRowsByIds<OrderCustomerRow>(
        supabase,
        'customers',
        accountId,
        customerIds,
        'id, full_name, type',
      )
    : new Map<string, OrderCustomerRow>();

  return (data ?? []).map((row) => {
    const order = row.order_id ? ordersMap.get(row.order_id) ?? null : null;
    const customer = order ? customersMap.get(order.customer_id) ?? null : null;
    return {
      customer_nick_used: row.customer_nick_used,
      product_name_snapshot: row.product_name_snapshot,
      order: order
        ? {
            order_code: order.order_code,
            status: order.status,
            customer: customer
              ? {
                  full_name: customer.full_name,
                }
              : null,
          }
        : null,
    };
  }) as TelegramOrderNickMatch[];
}

export async function listRecentCustomerOrdersForTelegram(
  customerId: string,
  accountId: string,
  limit = 5
): Promise<TelegramOrderSummary[]> {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalRecentCustomerOrders(accountId, customerId, limit);
  }

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_code,
      status,
      total_amount_vnd,
      total_paid,
      product_name_snapshot,
      created_at,
      expires_at,
      customer_id,
      product_id
    `)
    .eq('account_id', accountId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const maps = await loadOrderRelationMaps(accountId, (data ?? []) as unknown as OrderRelationRow[], false);
  return attachOrderRelations(data ?? [], maps, false) as unknown as TelegramOrderSummary[];
}

export async function listDebtOrdersForTelegram(accountId: string): Promise<TelegramOrderSummary[]> {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalDebtOrders(accountId);
  }

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_code,
      status,
      total_amount_vnd,
      total_paid,
      product_name_snapshot,
      created_at,
      expires_at,
      customer_id,
      product_id
    `)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .not('status', 'in', '(draft,refunded)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const maps = await loadOrderRelationMaps(accountId, (data ?? []) as unknown as OrderRelationRow[], false);
  return attachOrderRelations(data ?? [], maps, false) as unknown as TelegramOrderSummary[];
}

export async function getOrderById(
  id: string,
  accountId: string
): Promise<OrderRow | null> {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderWithItems(accountId, id);
  }

  return cached(
    key.item(id, accountId),
    async () => {
      const { data, error } = await supabase
        .from('orders')
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

export async function createOrder(
  accountId: string,
  input: Omit<OrderInsert, 'account_id' | 'id' | 'updated_at'>
): Promise<OrderRow> {
  const { data, error } = await supabase
    .from('orders')
    .insert({ ...input, account_id: accountId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  
  invalidate(key.list(accountId));
  invalidateOrderFixtureState(accountId);
  return data;
}

export async function updateOrderStatus(
  id: string,
  accountId: string,
  status: OrderRow['status']
): Promise<OrderRow> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Order not found');
  
  invalidate(key.list(accountId));
  invalidate(key.item(id, accountId));
  invalidate(key.itemWithItems(id, accountId));
  return data;
}

export async function updateOrderPaymentAndStatus(
  id: string,
  accountId: string,
  updates: {
    customer_id?: string;
    status?: OrderRow['status'];
    total_paid?: number;
    payment_method?: string;
    payment_terms?: OrderRow['payment_terms'];
    payment_source_id?: string;
    sales_channel_id?: string;
    sales_note?: string;
    expires_at?: string;
    created_at?: string;
    unit_price_vnd?: number;
    cost_price_vnd?: number;
    total_amount_vnd?: number;
    total_cost_vnd?: number;
    proof_image_urls?: string[];
    items?: { id: string, notes?: string, customer_nick_used?: string, assigned_source_account_id?: string | null }[];
  }
): Promise<OrderRow> {
  const { items, ...orderUpdates } = updates;

  // 1. Update order header if there are fields to update
  let orderData: OrderRow | null = null;
  if (Object.keys(orderUpdates).length > 0) {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        ...orderUpdates,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Order not found');
    orderData = data;
  }

  // 2. Update line items if provided
  if (items && items.length > 0) {
    // Only update items that belong to this order to prevent unauthorized edits
    await Promise.all(items.map(async (item) => {
      // Don't update undefined/null fields
      const patch: Partial<{
        notes: string;
        customer_nick_used: string;
        assigned_source_account_id: string | null;
      }> = {};
      if (item.notes !== undefined) patch.notes = item.notes;
      if (item.customer_nick_used !== undefined) patch.customer_nick_used = item.customer_nick_used;
      if (item.assigned_source_account_id !== undefined) patch.assigned_source_account_id = item.assigned_source_account_id;
      
      if (Object.keys(patch).length > 0) {
        await supabase
          .from('order_items')
          .update(patch)
          .eq('id', item.id)
          .eq('order_id', id); // Security check
      }
    }));
  }
  
  invalidate(key.list(accountId));
  invalidate(key.item(id, accountId));
  invalidate(key.itemWithItems(id, accountId));
  
  // Return the updated order (might be null if only items were updated, so we fetch if needed)
  if (!orderData) {
    const freshOrder = await getOrderById(id, accountId);
    if (!freshOrder) throw new Error('Order not found after items update');
    return freshOrder;
  }
  return orderData;
}

export async function deleteOrder(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);

  if (error) throw new Error(error.message);
  
  invalidate(key.list(accountId));
  invalidate(key.item(id, accountId));
  invalidate(key.itemWithItems(id, accountId));
  invalidateOrderFixtureState(accountId);
}

export interface GetOrdersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentState?: string;
  customerId?: string;
  date_from?: string;
  date_to?: string;
}

function buildOrdersBaseQuery(
  accountId: string,
  params: Omit<GetOrdersParams, 'page' | 'limit' | 'search' | 'paymentState'>,
  withCount = false,
) {
  let query = withCount
    ? supabase.from('orders').select('*', { count: 'exact' })
    : supabase.from('orders').select('*');

  query = query
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (params.customerId) {
    query = query.eq('customer_id', params.customerId);
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.date_from) {
    query = query.gte('created_at', params.date_from);
  }

  if (params.date_to) {
    query = query.lt('created_at', adjustEndDate(params.date_to));
  }

  return query;
}

function matchesOrderPaymentState(
  row: Pick<OrderRelationRow, 'total_amount_vnd' | 'total_paid'>,
  paymentState?: string,
) {
  if (!paymentState) {
    return true;
  }

  return derivePaymentState(row.total_amount_vnd, row.total_paid) === paymentState;
}

async function getOrdersWithServerFilters(
  accountId: string,
  params: GetOrdersParams,
) {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrdersPaginated(accountId, params);
  }

  const page = params.page || 1;
  const limit = params.limit || 10;
  const filteredRows = await loadOrdersForFiltering(accountId, params);

  return {
    ...paginateRows(filteredRows, page, limit),
    source: "database" as const,
  };
}

export async function getOrdersPaginated(
  accountId: string,
  params: GetOrdersParams
) {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrdersPaginated(accountId, params);
  }

  const page = params.page || 1;
  const limit = params.limit || 10;
  const offset = (page - 1) * limit;

  if (hasSearchTokens(params.search ?? '') || params.paymentState) {
    return getOrdersWithServerFilters(accountId, params);
  }

  let query = buildOrdersBaseQuery(
    accountId,
    {
      customerId: params.customerId,
      status: params.status,
      date_from: params.date_from,
      date_to: params.date_to,
    },
    true,
  );

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(error.message);
  }

  const maps = await loadOrderRelationMaps(accountId, (data ?? []) as OrderRelationRow[], true);
  const enriched = attachOrderRelations(data ?? [], maps, true);

  return {
    data: enriched,
    count: count || 0,
    page,
    limit,
    totalPages: count ? Math.ceil(count / limit) : 0,
    source: "database" as const,
  };
}

// ── Aggregated Stats ──────────────────────────────────────────────────────────

export interface OrderStats {
  total_orders: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_paid_amount: number;
  total_debt: number;
  pending_count: number;
  active_count: number;
  paid_count: number;
  expired_count: number;
}

export async function getOrdersStats(
  accountId: string,
  params: Omit<GetOrdersParams, 'page' | 'limit'> = {}
): Promise<OrderStats> {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderStats(accountId, params);
  }

  if (hasSearchTokens(params.search ?? '') || params.paymentState) {
    return getOrdersStatsFallback(accountId, params);
  }

  // Use DB-level aggregation via RPC for performance (no full-table fetch)
  const dateToAdjusted = params.date_to ? adjustEndDate(params.date_to) : null;

  const { data, error } = await supabase.rpc('get_order_stats' as never, {
    p_account_id: accountId,
    p_status: params.status || null,
    p_customer_id: params.customerId || null,
    p_date_from: params.date_from || null,
    p_date_to: dateToAdjusted,
  } as never);

  if (error) {
    // Fallback to JS aggregation if RPC not yet deployed
    return getOrdersStatsFallback(accountId, params);
  }

  const stats = data as unknown as OrderStats;
  return {
    total_orders: Number(stats.total_orders) || 0,
    total_revenue: Number(stats.total_revenue) || 0,
    total_cost: Number(stats.total_cost) || 0,
    total_profit: Number(stats.total_profit) || 0,
    total_paid_amount: Number(stats.total_paid_amount) || 0,
    total_debt: Number(stats.total_debt) || 0,
    pending_count: Number(stats.pending_count) || 0,
    active_count: Number(stats.active_count) || 0,
    paid_count: Number(stats.paid_count) || 0,
    expired_count: Number(stats.expired_count) || 0,
  };
}

/** Fallback: JS-side aggregation if RPC is not available */
async function getOrdersStatsFallback(
  accountId: string,
  params: Omit<GetOrdersParams, 'page' | 'limit'>
): Promise<OrderStats> {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderStats(accountId, params);
  }

  const rows = await loadOrdersForFiltering(accountId, params);
  let totalRevenue = 0, totalCost = 0, totalPaid = 0;
  let pendingCount = 0, activeCount = 0, paidCount = 0, expiredCount = 0;

  for (const row of rows) {
    totalRevenue += Number(row.total_amount_vnd) || 0;
    totalCost += Number(row.total_cost_vnd) || 0;
    totalPaid += Number(row.total_paid) || 0;
    if (row.status === 'pending_payment') pendingCount++;
    if (row.status === 'active') activeCount++;
    if (row.status === 'paid') paidCount++;
    if (row.status === 'expired') expiredCount++;
  }

  return {
    total_orders: rows.length,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    total_profit: totalRevenue - totalCost,
    total_paid_amount: totalPaid,
    total_debt: totalRevenue - totalPaid,
    pending_count: pendingCount,
    active_count: activeCount,
    paid_count: paidCount,
    expired_count: expiredCount,
  };
}

// ── Batch Delete ──────────────────────────────────────────────────────────────

export async function batchDeleteOrders(
  ids: string[],
  accountId: string
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);

  // Bulk invalidation — much faster than per-key loop
  invalidatePrefix(`orders:`);
  invalidateOrderFixtureState(accountId);
}

// ── Export ─────────────────────────────────────────────────────────────────────

export async function getOrdersForExport(
  accountId: string,
  params: Omit<GetOrdersParams, 'page' | 'limit'> = {}
) {
  if (await shouldUseLocalOrderFixtures(accountId)) {
    return buildLocalOrderExportRows(accountId, params);
  }

  if (hasSearchTokens(params.search ?? '') || params.paymentState) {
    return loadOrdersForFiltering(accountId, params) as unknown as OrderRow[];
  }

  let query = supabase
    .from('orders')
    .select(`
      id, order_code, quantity, total_amount_vnd, total_cost_vnd, total_paid, status, payment_method, payment_terms,
      created_at, expires_at, product_name_snapshot,
      customer_id, product_id
    `)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.customerId) query = query.eq('customer_id', params.customerId);
  if (params.date_from) query = query.gte('created_at', params.date_from);
  if (params.date_to) {
    query = query.lt('created_at', adjustEndDate(params.date_to));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const maps = await loadOrderRelationMaps(accountId, (data ?? []) as unknown as OrderRelationRow[], false);
  return attachOrderRelations(data ?? [], maps, false) as unknown as OrderRow[];
}
