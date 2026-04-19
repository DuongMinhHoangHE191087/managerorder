// ============================================================
// TRASH REPOSITORY — Supabase
// List, restore, and purge soft-deleted items across all tables
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';

// Supported entity types for trash operations
export type TrashEntityType =
  | 'customers'
  | 'orders'
  | 'products'
  | 'providers'
  | 'source_accounts'
  | 'license_keys'
  | 'short_links';

// Column mappings: which columns to select for display in trash table
const DISPLAY_COLUMNS: Record<TrashEntityType, string> = {
  customers: 'id, full_name, type, phone, email, notes, created_at, deleted_at',
  orders: 'id, order_code, status, total_amount_vnd, payment_method, notes, created_at, deleted_at',
  products: 'id, name, mode, price_vnd, cost_vnd, description, created_at, deleted_at',
  providers: 'id, name, tier, contact_email, notes, created_at, deleted_at',
  source_accounts: 'id, email, provider, status, notes, created_at, deleted_at',
  license_keys: 'id, key_code, status, product_id, notes, created_at, deleted_at',
  short_links: 'id, title, slug, target_url, max_clicks, current_clicks, status, created_at, deleted_at',
};

// Human-readable labels
export const ENTITY_LABELS: Record<TrashEntityType, string> = {
  customers: 'Khách hàng',
  orders: 'Đơn hàng',
  products: 'Sản phẩm',
  providers: 'Nhà cung cấp',
  source_accounts: 'Tài khoản nguồn',
  license_keys: 'Kho / License Keys',
  short_links: 'Link rút gọn',
};

/**
 * List all soft-deleted items of a given type.
 * Returns items where deleted_at IS NOT NULL, ordered by deletion date (newest first).
 */
export async function listDeletedItems(
  accountId: string,
  type: TrashEntityType
): Promise<{ data: Record<string, unknown>[]; count: number }> {
  const columns = DISPLAY_COLUMNS[type];

  const { data, error, count } = await supabase
    .from(type)
    .select(columns, { count: 'exact' })
    .eq('account_id', accountId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as unknown as Record<string, unknown>[], count: count ?? 0 };
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
  return restored;
}

/**
 * Permanently delete items (hard delete).
 * Only works on items already in trash (deleted_at IS NOT NULL).
 * Handles FK cascade for orders (order_items, activity_logs, etc.)
 * and customers (customer_contacts).
 * Chunked internally to avoid timeouts.
 */
export async function purgeItems(
  ids: string[],
  accountId: string,
  type: TrashEntityType
): Promise<number> {
  if (ids.length === 0) return 0; // Guard: prevent accidental mass delete

  // Cascade delete child records for entity types with FK constraints
  const CHILD_TABLES: Partial<Record<TrashEntityType, string[]>> = {
    orders: ['order_items', 'order_status_history', 'activity_logs'],
    customers: ['customer_contacts'],
  };

  const childTables = CHILD_TABLES[type] ?? [];
  const fkColumn = type === 'orders' ? 'order_id' : type === 'customers' ? 'customer_id' : null;

  // Delete child rows first (in chunks)
  if (childTables.length > 0 && fkColumn) {
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      for (const childTable of childTables) {
        // Use try-catch per child: some tables may not exist for all accounts
        try {
          await supabase
            .from(childTable)
            .delete()
            .in(fkColumn, chunk);
        } catch {
          // Ignore errors for optional child tables (e.g., activity_logs may not exist)
        }
      }
    }
  }

  // Now delete the parent records
  let purged = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
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
  return purged;
}
