// ============================================================
// CUSTOMERS REPOSITORY — Supabase (v2 schema)
// Tables: customers(id, full_name, type) + customer_contacts
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';
import { filterRowsBySearchQuery, hasSearchTokens } from '@/shared/lib/filtering/search';

export interface CustomerRow {
  id: string;
  full_name: string;
  type: 'retail' | 'wholesale' | 'agency';
  nicks_registry?: Record<string, unknown>[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
  contacts?: ContactRow[];
  customer_tags?: { id: string; name: string; color: string }[];
  orders?: { customer_id: string; total_amount_vnd: number | null }[];
}

export interface ContactRow {
  id: string;
  customer_id: string;
  channel: string;
  value: string;
  is_verified: boolean;
  is_primary?: boolean;
  facebook_id?: string | null;
  facebook_name?: string | null;
  created_at: string;
}

type ContactInsertRow = {
  customer_id: string;
  channel: string;
  value: string;
  is_verified: boolean;
  is_primary: boolean;
  facebook_id?: string | null;
  facebook_name?: string | null;
};

const key = {
  list: (accountId: string) => `customers:list:${accountId}`,
};

const OPTIONAL_CONTACT_COLUMNS = ['is_primary', 'facebook_id', 'facebook_name'] as const;

function getMissingCustomerContactColumn(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const message = String((error as { message?: unknown }).message ?? '');
  if (!message) {
    return null;
  }

  const normalized = message.toLowerCase();
  if (!normalized.includes('customer_contacts') || !normalized.includes('schema cache')) {
    return null;
  }

  const match = normalized.match(/'([a-z0-9_]+)'\s+column/);
  return match?.[1] ?? null;
}

function toContactInsertRows(
  customerId: string,
  contacts: Array<{
    channel: string;
    value: string;
    is_verified?: boolean;
    is_primary?: boolean;
    facebook_id?: string;
    facebook_name?: string;
  }>,
): ContactInsertRow[] {
  return contacts.map((contact) => ({
    customer_id: customerId,
    channel: contact.channel,
    value: contact.value,
    is_verified: contact.is_verified ?? false,
    is_primary: contact.is_primary ?? false,
    facebook_id: contact.facebook_id ?? null,
    facebook_name: contact.facebook_name ?? null,
  }));
}

async function insertCustomerContacts(
  rows: ContactInsertRow[],
  options?: { withSelect?: boolean },
) {
  const withSelect = options?.withSelect ?? false;
  const runInsert = async (payload: Array<Record<string, unknown>>) => {
    const query = supabase.from('customer_contacts').insert(payload);
    return withSelect ? query.select() : query;
  };

  let payload: Array<Record<string, unknown>> = rows.map((row) => ({ ...row }));
  const droppedColumns = new Set<string>();

  for (let attempt = 0; attempt <= OPTIONAL_CONTACT_COLUMNS.length; attempt += 1) {
    const result = await runInsert(payload);
    if (!result.error) {
      return result;
    }

    const missingColumn = getMissingCustomerContactColumn(result.error);
    if (
      !missingColumn ||
      !OPTIONAL_CONTACT_COLUMNS.includes(missingColumn as (typeof OPTIONAL_CONTACT_COLUMNS)[number]) ||
      droppedColumns.has(missingColumn)
    ) {
      return result;
    }

    const columnsToDrop =
      missingColumn === 'facebook_id' || missingColumn === 'facebook_name'
        ? ['facebook_id', 'facebook_name']
        : [missingColumn];

    for (const column of columnsToDrop) {
      droppedColumns.add(column);
    }

    payload = payload.map((row) => {
      const next = { ...row };
      for (const column of columnsToDrop) {
        delete next[column];
      }
      return next;
    });
  }

  return runInsert(payload);
}

type CustomerBaseRow = Record<string, unknown> & { id: string };
type CustomerContactBaseRow = {
  id: string;
  customer_id: string;
  channel: string;
  value: string;
  is_verified: boolean;
  created_at: string;
};
type CustomerTagAssignmentBaseRow = {
  customer_id: string;
  tag_id: string;
  assigned_at?: string | null;
};
type CustomerTagBaseRow = {
  id: string;
  name: string;
  color: string;
};
type CustomerOrderBaseRow = {
  customer_id: string;
  total_amount_vnd: number | null;
};

async function loadCustomerFallbackRows(
  accountId: string,
  customerId?: string,
  includeDeleted = false,
): Promise<CustomerBaseRow[]> {
  let customerQuery = supabase
    .from('customers')
    .select('*')
    .eq('account_id', accountId);

  if (!includeDeleted) {
    customerQuery = customerQuery.is('deleted_at', null);
  }

  const { data, error } = customerId
    ? await customerQuery.eq('id', customerId).maybeSingle()
    : await customerQuery.order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => String(row.id)).filter(Boolean);
  const [contactsResult, assignmentsResult, ordersResult] = await Promise.all([
    supabase
      .from('customer_contacts')
      .select('*')
      .in('customer_id', ids)
      .order('created_at', { ascending: true }),
    supabase
      .from('customer_tag_assignments')
      .select('customer_id, tag_id')
      .in('customer_id', ids)
      .order('assigned_at', { ascending: true }),
    supabase
      .from('orders')
      .select('customer_id, total_amount_vnd')
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .in('customer_id', ids)
      .order('created_at', { ascending: true }),
  ]);

  if (contactsResult.error) throw new Error(contactsResult.error.message);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
  if (ordersResult.error) throw new Error(ordersResult.error.message);

  const contactRows = (contactsResult.data ?? []) as CustomerContactBaseRow[];
  const assignmentRows = (assignmentsResult.data ?? []) as CustomerTagAssignmentBaseRow[];
  const orderRows = (ordersResult.data ?? []) as CustomerOrderBaseRow[];
  const tagIds = [...new Set(assignmentRows.map((row) => row.tag_id).filter(Boolean))];
  const tagsById = await loadRowsByIds<CustomerTagBaseRow>(
    supabase,
    'customer_tags',
    accountId,
    tagIds,
    'id, name, color',
  );

  const contactsByCustomer = new Map<string, CustomerContactBaseRow[]>();
  for (const contact of contactRows) {
    const list = contactsByCustomer.get(contact.customer_id) ?? [];
    list.push(contact);
    contactsByCustomer.set(contact.customer_id, list);
  }

  const tagsByCustomer = new Map<string, CustomerTagBaseRow[]>();
  for (const assignment of assignmentRows) {
    const tag = tagsById.get(assignment.tag_id);
    if (!tag) continue;
    const list = tagsByCustomer.get(assignment.customer_id) ?? [];
    list.push(tag);
    tagsByCustomer.set(assignment.customer_id, list);
  }

  const ordersByCustomer = new Map<string, CustomerOrderBaseRow[]>();
  for (const order of orderRows) {
    const list = ordersByCustomer.get(order.customer_id) ?? [];
    list.push(order);
    ordersByCustomer.set(order.customer_id, list);
  }

  return rows.map((row) => {
    const customerIdValue = String(row.id);
    return {
      ...row,
      contacts: contactsByCustomer.get(customerIdValue) ?? [],
      customer_tags: tagsByCustomer.get(customerIdValue) ?? [],
      orders: ordersByCustomer.get(customerIdValue) ?? [],
    } as CustomerBaseRow;
  });
}

/** List all customers for an account with their contacts (excludes soft-deleted) */
export async function listCustomers(accountId: string, options: { search?: string } = {}): Promise<CustomerRow[]> {
  if (hasSearchTokens(options.search ?? '')) {
    const rows = (await loadCustomerFallbackRows(accountId)) as unknown as CustomerRow[];
    return filterRowsBySearchQuery(
      rows,
      options.search ?? '',
      (row) => [
        row.id,
        row.full_name,
        row.type,
        row.notes,
        row.nicks_registry,
        row.contacts,
        row.customer_tags,
      ],
    );
  }

  return cached(
    key.list(accountId),
    async () => {
      return (await loadCustomerFallbackRows(accountId)) as unknown as CustomerRow[];
    },
    TTL.LIST,
  );
}

/** Get a single customer by id with contacts */
export async function getCustomerById(
  id: string,
  accountId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<CustomerRow | null> {
  const fallbackRows = await loadCustomerFallbackRows(accountId, id, options.includeDeleted ?? false);
  return (fallbackRows[0] ?? null) as unknown as CustomerRow | null;
}

/** Create a new customer with contacts */
export async function createCustomer(
  accountId: string,
  input: {
    full_name: string;
    type: 'retail' | 'wholesale' | 'agency';
    notes?: string;
    reliability_score?: number;
    contacts?: {
      channel: string;
      value: string;
      is_verified?: boolean;
      is_primary?: boolean;
      facebook_id?: string;
      facebook_name?: string;
    }[];
  }
): Promise<CustomerRow> {
  // 1. Insert customer
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      account_id: accountId,
      full_name: input.full_name,
      type: input.type,
      notes: input.notes ?? null,
      reliability_score: input.reliability_score ?? 100,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // 2. Insert contacts if provided
  if (input.contacts?.length) {
    const contactRows = toContactInsertRows(customer.id, input.contacts);
    const insertResult = await insertCustomerContacts(contactRows, { withSelect: true });
    const contacts = insertResult.data ?? [];
    const contactInsertError = insertResult.error;
    if (contactInsertError) {
      throw new Error(
        `Không thể lưu thông tin liên hệ: ${
          contactInsertError instanceof Error
            ? contactInsertError.message
            : String((contactInsertError as { message?: unknown }).message ?? contactInsertError)
        }`,
      );
    }
    invalidate(key.list(accountId));
    return { ...customer, contacts: contacts ?? [] } as CustomerRow;
  }

  invalidate(key.list(accountId));
  return { ...customer, contacts: [] } as CustomerRow;
}

/** Update an existing customer and their contacts */
export async function updateCustomer(
  id: string,
  accountId: string,
  input: {
    full_name?: string;
    type?: 'retail' | 'wholesale' | 'agency';
    contacts?: {
      channel: string;
      value: string;
      is_verified?: boolean;
      is_primary?: boolean;
      facebook_id?: string;
      facebook_name?: string;
    }[];
    reliability_score?: number;
    notes?: string;
  }
): Promise<CustomerRow> {
  // 1. Update customer fields
  const updateData: Record<string, unknown> = {};
  if (input.full_name) updateData.full_name = input.full_name;
  if (input.type) updateData.type = input.type;
  if (input.reliability_score !== undefined) updateData.reliability_score = input.reliability_score;
  if (input.notes !== undefined) updateData.notes = input.notes;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) throw new Error(error.message);
  }

  // 2. Replace contacts (delete old + insert new)
  // Verify customer belongs to this account first
  if (input.contacts) {
    // Only delete contacts for customers belonging to this account
    const { count } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('id', id)
      .eq('account_id', accountId);
    if (!count) throw new Error('Customer not found or access denied');

    await supabase.from('customer_contacts').delete().eq('customer_id', id);
    if (input.contacts.length > 0) {
      const contactRows = toContactInsertRows(id, input.contacts);
      const insertResult = await insertCustomerContacts(contactRows);
      if (insertResult.error) {
        throw new Error(
          `Không thể lưu thông tin liên hệ: ${
            insertResult.error instanceof Error
              ? insertResult.error.message
              : String((insertResult.error as { message?: unknown }).message ?? insertResult.error)
          }`,
        );
      }
    }
  }

  // 3. Return updated customer. 
  // We can construct the response without re-fetching because we know the exact data we just wrote.

  // 3. Invalidate cache BEFORE fetch to ensure fresh data
  invalidate(key.list(accountId));

  const result = await getCustomerById(id, accountId);
  if (!result) throw new Error("Customer not found after update");
  return result;
}

/** Soft-delete a single customer (set deleted_at instead of hard delete) */
export async function deleteCustomer(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
}

/** Soft-delete multiple customers at once */
export async function softDeleteCustomers(ids: string[], accountId: string): Promise<number> {
  if (ids.length === 0) return 0; // Guard: prevent accidental mass update
  const { data, error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .in('id', ids)
    .select('id');
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  return data?.length ?? 0;
}

/** Batch update tier/type for multiple customers */
export async function updateCustomersTier(
  ids: string[],
  accountId: string,
  type: 'retail' | 'wholesale' | 'agency'
): Promise<number> {
  const { data, error } = await supabase
    .from('customers')
    .update({ type, updated_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .in('id', ids)
    .select('id');
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  return data?.length ?? 0;
}

/** Check dependencies (orders, activity_logs) for given customer IDs */
export async function getCustomerDependencies(
  ids: string[],
  accountId: string
): Promise<{ customersWithOrders: number; totalOrders: number }> {
  const { data: orders } = await supabase
    .from('orders')
    .select('customer_id')
    .eq('account_id', accountId)
    .in('customer_id', ids);

  const uniqueCustomers = new Set(orders?.map(o => o.customer_id) ?? []);
  return {
    customersWithOrders: uniqueCustomers.size,
    totalOrders: orders?.length ?? 0,
  };
}

export interface TelegramCustomerSummary {
  id: string;
  full_name: string;
  type: 'retail' | 'wholesale' | 'agency';
  nicks_registry?: Record<string, unknown>[];
  notes?: string | null;
  debt_amount_vnd?: number | null;
  created_at: string;
}

export interface TelegramCustomerContactMatch {
  customer_id: string;
  channel: string;
  value: string;
  customer: {
    id: string;
    full_name: string;
    type: 'retail' | 'wholesale' | 'agency';
  } | null;
}

export async function searchCustomersForTelegram(
  query: string,
  accountId: string,
  limit = 8
): Promise<TelegramCustomerSummary[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  const [byName, byNotes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, full_name, type, nicks_registry, notes, debt_amount_vnd, created_at')
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .ilike('full_name', `%${keyword}%`)
      .limit(limit),
    supabase
      .from('customers')
      .select('id, full_name, type, nicks_registry, notes, debt_amount_vnd, created_at')
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .ilike('notes', `%${keyword}%`)
      .limit(limit),
  ]);

  if (byName.error) throw new Error(byName.error.message);
  if (byNotes.error) throw new Error(byNotes.error.message);

  return Array.from(new Map(
    [...(byName.data ?? []), ...(byNotes.data ?? [])].map((row) => [row.id, row])
  ).values()).slice(0, limit) as TelegramCustomerSummary[];
}

export async function searchCustomerContactsForTelegram(
  query: string,
  accountId: string,
  limit = 10
): Promise<TelegramCustomerContactMatch[]> {
  const keyword = query.trim();
  if (!keyword) return [];

  const { data, error } = await supabase
    .from('customer_contacts')
    .select(`
      customer_id,
      channel,
      value,
      customer:customers!inner(id, full_name, type, account_id)
    `)
    .ilike('value', `%${keyword}%`)
    .eq('customer.account_id', accountId)
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    customer_id: row.customer_id,
    channel: row.channel,
    value: row.value,
    customer: Array.isArray(row.customer) ? row.customer[0] ?? null : row.customer,
  })) as TelegramCustomerContactMatch[];
}

export async function listCustomerContactRows(customerIds: string[]): Promise<ContactRow[]> {
  if (!customerIds.length) return [];

  const { data, error } = await supabase
    .from('customer_contacts')
    .select('*')
    .in('customer_id', customerIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as ContactRow[];
}

export async function listCustomerOrderRows(
  accountId: string,
  customerIds: string[]
): Promise<Array<{ customer_id: string }>> {
  if (!customerIds.length) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('customer_id')
    .eq('account_id', accountId)
    .in('customer_id', customerIds)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
  return data ?? [];
}
