// ============================================================
// CUSTOMER TAGS REPOSITORY — Supabase
// CRUD for customer_tags + assign/remove tag operations
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { cached, invalidate, TTL } from '@/lib/cache/db-cache';
import { loadRowsByIds } from '@/lib/supabase/relation-fallback';

export interface CustomerTag {
  id: string;
  account_id: string;
  name: string;
  color: string;
  created_at: string;
}

const key = {
  list: (accountId: string) => `customer-tags:list:${accountId}`,
  customerTags: (customerId: string) => `customer-tags:customer:${customerId}`,
};

/** List all tags for an account */
export async function listCustomerTags(accountId: string): Promise<CustomerTag[]> {
  return cached(
    key.list(accountId),
    async () => {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .eq('account_id', accountId)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as CustomerTag[];
    },
    TTL.LIST,
  );
}

/** Create a new tag */
export async function createCustomerTag(
  accountId: string,
  input: { name: string; color?: string }
): Promise<CustomerTag> {
  const { data, error } = await supabase
    .from('customer_tags')
    .insert({
      account_id: accountId,
      name: input.name.trim(),
      color: input.color ?? '#6366f1',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  return data as CustomerTag;
}

/** Delete a tag (cascade removes assignments) */
export async function deleteCustomerTag(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_tags')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
}

/** Update a tag (name, color) */
export async function updateCustomerTag(
  id: string,
  accountId: string,
  input: Partial<{ name: string; color: string }>
): Promise<CustomerTag> {
  const { data, error } = await supabase
    .from('customer_tags')
    .update(input)
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  invalidate(key.list(accountId));
  return data as CustomerTag;
}

/** Get tags assigned to a specific customer */
export async function getCustomerTags(customerId: string): Promise<CustomerTag[]> {
  return cached(
    key.customerTags(customerId),
    async () => {
      const { data, error } = await supabase
        .from('customer_tag_assignments')
        .select('tag_id, assigned_at')
        .eq('customer_id', customerId)
        .order('assigned_at', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const tagIds = [...new Set(
        (data ?? [])
          .map((row: { tag_id?: string }) => row.tag_id)
          .filter((tagId): tagId is string => Boolean(tagId)),
      )];
      const tagMap = await loadRowsByIds<CustomerTag>(
        supabase,
        'customer_tags',
        null,
        tagIds,
        'id, account_id, name, color, created_at',
      );
      return tagIds
        .map((tagId) => tagMap.get(tagId))
        .filter((tag): tag is CustomerTag => Boolean(tag));
    },
    TTL.ITEM,
  );
}

/** Assign tags to a customer (idempotent - ignores duplicates) */
export async function assignTagsToCustomer(
  customerId: string,
  tagIds: string[]
): Promise<number> {
  if (!tagIds.length) return 0;
  const rows = tagIds.map(tagId => ({
    customer_id: customerId,
    tag_id: tagId,
  }));
  const { data, error } = await supabase
    .from('customer_tag_assignments')
    .upsert(rows, { onConflict: 'customer_id,tag_id', ignoreDuplicates: true })
    .select('customer_id');
  if (error) throw new Error(error.message);
  invalidate(key.customerTags(customerId));
  return data?.length ?? 0;
}

/** Remove specific tags from a customer */
export async function removeTagsFromCustomer(
  customerId: string,
  tagIds: string[]
): Promise<void> {
  if (!tagIds.length) return;
  const { error } = await supabase
    .from('customer_tag_assignments')
    .delete()
    .eq('customer_id', customerId)
    .in('tag_id', tagIds);
  if (error) throw new Error(error.message);
  invalidate(key.customerTags(customerId));
}

/** Replace all tags for a customer (delete old + insert new) */
export async function replaceCustomerTags(
  customerId: string,
  tagIds: string[]
): Promise<void> {
  // Delete all existing assignments
  await supabase
    .from('customer_tag_assignments')
    .delete()
    .eq('customer_id', customerId);

  // Insert new ones
  if (tagIds.length > 0) {
    const rows = tagIds.map(tagId => ({
      customer_id: customerId,
      tag_id: tagId,
    }));
    const { error } = await supabase
      .from('customer_tag_assignments')
      .insert(rows);
    if (error) throw new Error(error.message);
  }
  invalidate(key.customerTags(customerId));
}

/** Batch assign tags to multiple customers */
export async function batchAssignTag(
  customerIds: string[],
  tagId: string
): Promise<number> {
  let count = 0;
  for (let i = 0; i < customerIds.length; i += 50) {
    const chunk = customerIds.slice(i, i + 50);
    const rows = chunk.map(cid => ({ customer_id: cid, tag_id: tagId }));
    const { data, error } = await supabase
      .from('customer_tag_assignments')
      .upsert(rows, { onConflict: 'customer_id,tag_id', ignoreDuplicates: true })
      .select('customer_id');
    if (error) throw new Error(error.message);
    count += data?.length ?? 0;
    chunk.forEach(cid => invalidate(key.customerTags(cid)));
  }
  return count;
}
