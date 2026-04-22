// ============================================================
// CUSTOMER GROUPS REPOSITORY — Supabase
// CRUD for customer_groups + batch assign/remove operations
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';

export interface CustomerGroup {
  id: string;
  account_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

const key = {
  list: (accountId: string) => `customer-groups:list:${accountId}`,
};

/** List all customer groups with member counts */
export async function listCustomerGroups(accountId: string): Promise<CustomerGroup[]> {
  return cached(
    key.list(accountId),
    async () => {
      // Fetch groups
      const { data: groups, error } = await supabase
        .from('customer_groups')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      // Fetch member counts for each group
      const groupsWithCounts = await Promise.all(
        (groups ?? []).map(async (g) => {
          const { count } = await supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('account_id', accountId)
            .eq('group_id', g.id)
            .is('deleted_at', null);
          return { ...g, member_count: count ?? 0 } as CustomerGroup;
        })
      );

      return groupsWithCounts;
    },
    TTL.LIST,
  );
}

/** Create a new customer group */
export async function createCustomerGroup(
  accountId: string,
  input: { name: string; color?: string; description?: string }
): Promise<CustomerGroup> {
  const { data, error } = await supabase
    .from('customer_groups')
    .insert({
      account_id: accountId,
      name: input.name,
      color: input.color ?? '#6366f1',
      description: input.description ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  return { ...data, member_count: 0 } as CustomerGroup;
}

/** Update a customer group */
export async function updateCustomerGroup(
  id: string,
  accountId: string,
  input: Partial<{ name: string; color: string; description: string }>
): Promise<CustomerGroup> {
  const { data, error } = await supabase
    .from('customer_groups')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  return data as CustomerGroup;
}

/** Delete a customer group (customers.group_id -> NULL via ON DELETE SET NULL) */
export async function deleteCustomerGroup(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_groups')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
}

/** Assign multiple customers to a group */
export async function assignCustomersToGroup(
  customerIds: string[],
  accountId: string,
  groupId: string
): Promise<number> {
  let updated = 0;
  for (let i = 0; i < customerIds.length; i += 50) {
    const chunk = customerIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('customers')
      .update({ group_id: groupId, updated_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .in('id', chunk)
      .is('deleted_at', null)
      .select('id');
    if (error) throw new Error(error.message);
    updated += data?.length ?? 0;
  }
  invalidate(key.list(accountId));
  return updated;
}

/** Remove customers from their group (set group_id = null) */
export async function removeCustomersFromGroup(
  customerIds: string[],
  accountId: string
): Promise<number> {
  let updated = 0;
  for (let i = 0; i < customerIds.length; i += 50) {
    const chunk = customerIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('customers')
      .update({ group_id: null, updated_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .in('id', chunk)
      .select('id');
    if (error) throw new Error(error.message);
    updated += data?.length ?? 0;
  }
  invalidate(key.list(accountId));
  return updated;
}
