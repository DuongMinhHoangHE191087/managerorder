// ============================================================
// CALENDAR REPOSITORY — Supabase
// Multi-customer support via customer_ids UUID[] array
// 2-step manual join for customer data (no FK required)
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

type ReminderRow = Database['public']['Tables']['reminder_events']['Row'];
type ReminderInsert = Database['public']['Tables']['reminder_events']['Insert'];

export type CustomerInfo = {
  id: string;
  full_name: string;
  type: string;
  customer_contacts: { value: string; is_verified: boolean; channel: string }[];
};

/** Enriched row with multiple customers attached */
export type ReminderRowWithCustomers = ReminderRow & {
  _customers: CustomerInfo[];
};

/** Shared: collect all unique customer IDs from events (from both customer_ids array and legacy customer_id) */
function collectCustomerIds(events: ReminderRow[]): string[] {
  const idSet = new Set<string>();
  for (const e of events) {
    if (e.customer_ids && e.customer_ids.length > 0) {
      e.customer_ids.forEach(id => idSet.add(id));
    } else if (e.customer_id) {
      idSet.add(e.customer_id);
    }
  }
  return [...idSet];
}

/** Shared: batch-fetch customers by IDs */
async function batchFetchCustomers(ids: string[]): Promise<Map<string, CustomerInfo>> {
  if (ids.length === 0) return new Map();
  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, full_name, type')
    .in('id', ids);
  if (customerError) throw new Error(customerError.message);

  const { data: contacts, error: contactError } = await supabase
    .from('customer_contacts')
    .select('customer_id, value, is_verified, channel')
    .in('customer_id', ids)
    .order('created_at', { ascending: true });
  if (contactError) throw new Error(contactError.message);

  const contactsByCustomer = new Map<string, CustomerInfo['customer_contacts']>();
  for (const contact of contacts ?? []) {
    const list = contactsByCustomer.get(contact.customer_id) ?? [];
    list.push({
      value: contact.value,
      is_verified: contact.is_verified,
      channel: contact.channel,
    });
    contactsByCustomer.set(contact.customer_id, list);
  }

  return new Map((customers ?? []).map((customer) => [
    customer.id,
    {
      id: customer.id,
      full_name: customer.full_name,
      type: customer.type,
      customer_contacts: contactsByCustomer.get(customer.id) ?? [],
    } satisfies CustomerInfo,
  ]));
}

/** Shared: attach customer data to events */
function enrichEvents(events: ReminderRow[], customerMap: Map<string, CustomerInfo>): ReminderRowWithCustomers[] {
  return events.map(evt => {
    const ids = (evt.customer_ids && evt.customer_ids.length > 0)
      ? evt.customer_ids
      : evt.customer_id ? [evt.customer_id] : [];
    return {
      ...evt,
      _customers: ids.map(id => customerMap.get(id)).filter((c): c is CustomerInfo => !!c),
    };
  });
}

/** List all calendar events for an account, enriched with customer data */
export async function listCalendarEvents(accountId: string): Promise<ReminderRowWithCustomers[]> {
  const { data: events, error } = await supabase
    .from('reminder_events')
    .select('*')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .order('due_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!events || events.length === 0) return [];

  const customerMap = await batchFetchCustomers(collectCustomerIds(events));
  return enrichEvents(events, customerMap);
}

/** Fetch ALL today's reminder events across ALL accounts (for Telegram cron) */
export async function listAllTodayReminderEvents(dateStr: string): Promise<ReminderRowWithCustomers[]> {
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;

  const { data: events, error } = await supabase
    .from('reminder_events')
    .select('*')
    .eq('has_reminder', true)
    .eq('is_done', false)
    .is('deleted_at', null)
    .gte('due_at', dayStart)
    .lte('due_at', dayEnd)
    .order('due_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!events || events.length === 0) return [];

  const customerMap = await batchFetchCustomers(collectCustomerIds(events));
  return enrichEvents(events, customerMap);
}

export async function createCalendarEvent(
  accountId: string,
  input: {
    title: string;
    due_at: string;
    type?: ReminderRow['type'];
    is_done?: boolean;
    customer_ids?: string[];
    notes?: string;
    has_reminder?: boolean;
    gcal_event_id?: string | null;
  }
): Promise<ReminderRow> {
  const { data, error } = await supabase
    .from('reminder_events')
    .insert({
      account_id: accountId,
      title: input.title,
      due_at: input.due_at,
      type: input.type ?? 'follow_up',
      is_done: input.is_done ?? false,
      customer_ids: input.customer_ids ?? [],
      customer_id: input.customer_ids?.[0] ?? null,
      notes: input.notes,
      has_reminder: input.has_reminder ?? false,
      gcal_event_id: input.gcal_event_id ?? null,
    } satisfies ReminderInsert)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCalendarEvent(
  id: string,
  accountId: string,
  input: {
    title?: string;
    due_at?: string;
    type?: ReminderRow['type'];
    is_done?: boolean;
    customer_ids?: string[];
    notes?: string;
    has_reminder?: boolean;
    gcal_event_id?: string | null;
  }
): Promise<ReminderRow> {
  const payload: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  // Sync legacy customer_id with first item 
  if (input.customer_ids !== undefined) {
    payload.customer_id = input.customer_ids[0] ?? null;
  }
  const { data, error } = await supabase
    .from('reminder_events')
    .update(payload)
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Calendar event not found');
  return data;
}

export async function deleteCalendarEvent(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('reminder_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
}
