// ============================================================
// TRASH REPOSITORY — Supabase
// List, restore, and purge soft-deleted items across all tables
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { invalidateAll } from '@/lib/cache/db-cache';

// Supported entity types for trash operations
export type TrashEntityType =
  | 'customers'
  | 'orders'
  | 'products'
  | 'providers'
  | 'source_accounts'
  | 'license_keys'
  | 'short_links'
  | 'reminder_events'
  | 'premium_accounts'
  | 'subscription_renewals'
  | 'account_migrations'
  | 'account_share_links';

const FULL_ROW_SELECT = '*';

// Human-readable labels
export const ENTITY_LABELS: Record<TrashEntityType, string> = {
  customers: 'Khách hàng',
  orders: 'Đơn hàng',
  products: 'Sản phẩm',
  providers: 'Nhà cung cấp',
  source_accounts: 'Tài khoản nguồn',
  license_keys: 'Kho / License Keys',
  short_links: 'Link rút gọn',
  reminder_events: 'Sự kiện lịch / Nhắc nhở',
  premium_accounts: 'Tài khoản thuê bao (Premium)',
  subscription_renewals: 'Gia hạn thuê bao',
  account_migrations: 'Chuyển đổi thuê bao',
  account_share_links: 'Chia sẻ tài khoản',
};

/**
 * List all soft-deleted items of a given type.
 * Returns items where deleted_at IS NOT NULL, ordered by deletion date (newest first).
 */
export async function listDeletedItems(
  accountId: string,
  type: TrashEntityType
): Promise<{ data: Record<string, unknown>[]; count: number }> {
  const { data, error, count } = await supabase
    .from(type)
    .select(FULL_ROW_SELECT, { count: 'exact' })
    .eq('account_id', accountId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as Record<string, unknown>[], count: count ?? 0 };
}

export async function countDeletedItems(
  accountId: string,
  type: TrashEntityType
): Promise<number> {
  const { count, error } = await supabase
    .from(type)
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .not('deleted_at', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * Restore soft-deleted items (set deleted_at = NULL).
 * Chunked internally to avoid timeouts on large batches.
 */
export async function restoreItems(
  ids: string[],
  accountId: string,
  type: TrashEntityType
): Promise<number> {
  let restored = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const { data, error } = await supabase
      .from(type)
      .update({ deleted_at: null })
      .eq('account_id', accountId)
      .in('id', chunk)
      .not('deleted_at', 'is', null)
      .select('id');
    if (error) throw new Error(error.message);
    restored += data?.length ?? 0;
  }
  if (restored > 0) {
    invalidateAll();
  }
  return restored;
}

/**
 * Permanently delete items (hard delete).
 * Only works on items already in trash (deleted_at IS NOT NULL).
 * Handles FK cascade for orders (order_items, activity_logs, etc.),
 * customers (customer_contacts), and products (nullifies referencing order/item product_ids).
 * Chunked internally to avoid timeouts.
 */
export async function purgeItems(
  ids: string[],
  accountId: string,
  type: TrashEntityType
): Promise<number> {
  let targetIds = [...ids];
  if (targetIds.length === 0) return 0; // Guard: prevent accidental mass delete

  // 1. Pre-process and handle custom cascading logic or reference nullification
  if (type === 'customers') {
    // Customers have orders, and orders.customer_id is NOT NULL.
    // We must purge all orders of these customers first.
    const { data: customerOrders, error: orderFetchErr } = await supabase
      .from('orders')
      .select('id')
      .in('customer_id', targetIds);

    if (orderFetchErr) {
      throw new Error(`Failed to fetch orders for customers: ${orderFetchErr.message}`);
    }

    const orderIds = customerOrders?.map((o) => o.id) ?? [];
    if (orderIds.length > 0) {
      await purgeItems(orderIds, accountId, 'orders');
    }
  } else if (type === 'products') {
    // Check which products are referenced by order_items
    const { data: linkedItems, error: linkCheckErr } = await supabase
      .from('order_items')
      .select('product_id')
      .in('product_id', targetIds);

    if (linkCheckErr) {
      throw new Error(`Failed to check product references: ${linkCheckErr.message}`);
    }

    const linkedProductIds = new Set(linkedItems?.map((item) => item.product_id) ?? []);
    
    // Filter out products that are linked
    const safeIds = targetIds.filter((id) => !linkedProductIds.has(id));

    // If it was a single product delete request and it's linked, throw an error
    if (targetIds.length === 1 && safeIds.length === 0) {
      throw new Error('Sản phẩm đang được liên kết với đơn hàng. Vui lòng xóa các đơn hàng liên quan trước khi xóa vĩnh viễn sản phẩm.');
    }

    // If no safe products to delete in bulk, return 0
    if (safeIds.length === 0) {
      return 0;
    }

    // We only proceed with safeIds
    targetIds = safeIds;

    // Nullify product references in orders (which are nullable) to prevent FK errors.
    await supabase.from('orders').update({ product_id: null }).in('product_id', targetIds);

    try {
      await supabase.from('subscription_renewals').update({ new_product_id: null }).in('new_product_id', targetIds);
    } catch {
      // Ignore if table/column does not exist
    }

    try {
      await supabase.from('license_keys').delete().in('product_id', targetIds);
    } catch {
      // Ignore if table does not exist
    }
  } else if (type === 'orders') {
    // Release assigned license keys
    try {
      await supabase
        .from('license_keys')
        .update({ order_id: null, status: 'available', assigned_at: null })
        .in('order_id', targetIds);
    } catch {
      // Ignore if table does not exist
    }
  } else if (type === 'premium_accounts') {
    // Cascade purge associated records:
    // 1. Fetch customer subscriptions related to these premium accounts
    const { data: subscriptions, error: subsFetchErr } = await supabase
      .from('customer_premium_subscriptions')
      .select('id')
      .in('premium_account_id', targetIds);

    if (subsFetchErr) {
      throw new Error(`Failed to fetch premium subscriptions: ${subsFetchErr.message}`);
    }

    const subIds = subscriptions?.map((s) => s.id) ?? [];
    if (subIds.length > 0) {
      // Delete renewals associated with these subscriptions
      try {
        await supabase
          .from('subscription_renewals')
          .delete()
          .in('original_subscription_id', subIds);
      } catch (err) {
        console.warn('Failed to delete renewals for subscriptions:', err);
      }

      // Delete migrations associated with these subscriptions
      try {
        await supabase
          .from('account_migrations')
          .delete()
          .in('subscription_id', subIds);
      } catch (err) {
        console.warn('Failed to delete migrations for subscriptions:', err);
      }

      // Now delete subscriptions
      try {
        await supabase
          .from('customer_premium_subscriptions')
          .delete()
          .in('id', subIds);
      } catch (err) {
        throw new Error(`Failed to delete customer premium subscriptions: ${(err as Error).message}`);
      }
    }

    // 2. Delete premium account users
    try {
      await supabase
        .from('premium_account_users')
        .delete()
        .in('premium_account_id', targetIds);
    } catch (err) {
      console.warn('Failed to delete premium account users:', err);
    }

    // 3. Delete health logs
    try {
      await supabase
        .from('premium_account_health_logs')
        .delete()
        .in('premium_account_id', targetIds);
    } catch (err) {
      console.warn('Failed to delete health logs:', err);
    }

    // 4. Delete user history
    try {
      await supabase
        .from('premium_account_user_history')
        .delete()
        .in('premium_account_id', targetIds);
    } catch (err) {
      console.warn('Failed to delete premium account user history:', err);
    }

    // 5. Delete migrations where this account is source or target
    try {
      await supabase
        .from('account_migrations')
        .delete()
        .in('source_account_id', targetIds);
      await supabase
        .from('account_migrations')
        .delete()
        .in('target_account_id', targetIds);
    } catch (err) {
      console.warn('Failed to delete associated migrations:', err);
    }
  }

  // 2. Cascade delete standard child tables
  const CHILD_TABLES: Partial<Record<TrashEntityType, string[]>> = {
    orders: ['order_items', 'order_status_history', 'activity_logs', 'payments', 'refund_requests'],
    customers: ['customer_contacts'],
    account_migrations: ['account_migration_history'],
    account_share_links: ['account_share_access_logs'],
  };

  const childTables = CHILD_TABLES[type] ?? [];
  const fkColumn =
    type === 'orders'
      ? 'order_id'
      : type === 'customers'
      ? 'customer_id'
      : type === 'account_migrations'
      ? 'migration_id'
      : type === 'account_share_links'
      ? 'account_share_link_id'
      : null;

  if (childTables.length > 0 && fkColumn) {
    for (let i = 0; i < targetIds.length; i += 50) {
      const chunk = targetIds.slice(i, i + 50);
      for (const childTable of childTables) {
        // Use try-catch per child: some tables may not exist for all accounts
        try {
          const { error } = await supabase
            .from(childTable)
            .delete()
            .in(fkColumn, chunk);
          if (error) {
            console.warn(`[purgeItems] Warning deleting child records from ${childTable}:`, error.message);
          }
        } catch {
          // Ignore errors for optional child tables
        }
      }
    }
  }

  // 3. Now delete the parent records
  let purged = 0;
  for (let i = 0; i < targetIds.length; i += 50) {
    const chunk = targetIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from(type)
      .delete()
      .eq('account_id', accountId)
      .in('id', chunk)
      .not('deleted_at', 'is', null)
      .select('id');
    if (error) throw new Error(error.message);
    purged += data?.length ?? 0;
  }
  if (purged > 0) {
    invalidateAll();
  }
  return purged;
}
