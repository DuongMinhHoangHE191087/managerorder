import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import { filterRowsBySearchQuery, hasSearchTokens, paginateRows } from '@/shared/lib/filtering/search';

export interface ActivityLogInsert {
  account_id: string;
  action_type: string;
  customer_id?: string | null;
  order_id?: string | null;
  source_account_id?: string | null;
  details?: Record<string, string | number | boolean | null | object>;
  created_by?: string | null;
}

export interface ActivityLog extends ActivityLogInsert {
  id: string;
  created_at: string;
}

type ActivityLogSearchRow = ActivityLog & {
  customers?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  orders?: { id?: string | null; status?: string | null } | { id?: string | null; status?: string | null }[] | null;
  source_accounts?:
    | { email?: string | null; provider?: string | null }
    | { email?: string | null; provider?: string | null }[]
    | null;
};

/**
 * Flatten nested objects in details to avoid [object Object] in log display.
 * Converts object/array values to JSON strings, keeps primitives as-is.
 */
function flattenDetails(
  details?: Record<string, string | number | boolean | null | object>
): Record<string, string | number | boolean | null> | undefined {
  if (!details) return undefined;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, val] of Object.entries(details)) {
    if (val === null || val === undefined) {
      result[key] = null;
    } else if (typeof val === 'object') {
      result[key] = JSON.stringify(val);
    } else {
      result[key] = val as string | number | boolean;
    }
  }
  return result;
}

function normalizeNullableUuid(value?: string | null): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

/**
 * Creates a new activity log entry.
 * Designed to fail gracefully (log error but return null) so it doesn't break main business flows.
 */
export async function createActivityLog(input: ActivityLogInsert): Promise<ActivityLog | null> {
  try {
    const safeInput = {
      account_id: input.account_id,
      action_type: input.action_type,
      customer_id: normalizeNullableUuid(input.customer_id),
      order_id: normalizeNullableUuid(input.order_id),
      source_account_id: normalizeNullableUuid(input.source_account_id),
      created_by: normalizeNullableUuid(input.created_by),
      details: flattenDetails(input.details),
    };
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([safeInput])
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[ActivityLog] Error:', error);
      return null;
    }
    return data as unknown as ActivityLog;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[ActivityLog] Exception:', err);
    return null;
  }
}

/**
 * Fetches activity logs based on entity filters.
 */
export async function getActivityLogs(
  accountId: string,
  filters?: {
    customerId?: string | null;
    orderId?: string | null;
    sourceAccountId?: string | null;
    limit?: number;
  }
): Promise<ActivityLog[]> {
  try {
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        customers ( full_name ),
        orders ( id, status ),
        source_accounts ( email, provider )
      `)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters?.orderId) {
      query = query.eq('order_id', filters.orderId);
    }
    if (filters?.sourceAccountId) {
      query = query.eq('source_account_id', filters.sourceAccountId);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[ActivityLog] Fetch error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[ActivityLog] Exception:', err);
    return [];
  }
}

/**
 * Advanced paginated and filtered fetch for activity logs
 */
export async function getActivityLogsPaginated(
  accountId: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    actionType?: string;
    customerId?: string;
    orderId?: string;
    sourceAccountId?: string;
    startDate?: string;
    endDate?: string;
  } = {}
) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(Math.max(1, options.limit || 20), 100); // Cap at 100 to prevent DoS
  const search = options.search?.trim() || "";
  const actionType = options.actionType?.trim() || "";

  // Set up the range
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const hasSearch = hasSearchTokens(search);
  let query = hasSearch
    ? supabase
        .from("activity_logs")
        .select(
          `
            *,
            customers ( full_name ),
            orders ( id, status ),
            source_accounts ( email, provider )
          `
        )
        .eq('account_id', accountId)
    : supabase
        .from("activity_logs")
        .select(
          `
            *,
            customers ( full_name ),
            orders ( id, status ),
            source_accounts ( email, provider )
          `,
          { count: "exact" }
        )
        .eq('account_id', accountId);

  // Filters
  if (options.customerId) query = query.eq('customer_id', options.customerId);
  if (options.orderId) query = query.eq('order_id', options.orderId);
  if (options.sourceAccountId) query = query.eq('source_account_id', options.sourceAccountId);

  if (actionType) {
    query = query.eq("action_type", actionType);
  }

  if (options.startDate) query = query.gte("created_at", options.startDate);
  // Add 1 day to endDate to be inclusive of the selected day
  if (options.endDate) {
    const end = new Date(options.endDate);
    end.setDate(end.getDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }

  // Search on text columns only — PostgREST .or() does NOT support ::text casts
  if (hasSearch) {
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[ActivityLog] Paginated error:', error);
      throw error;
    }

    const filteredRows = filterRowsBySearchQuery(
      (data ?? []) as ActivityLogSearchRow[],
      search,
      (row) => [
        row.action_type,
        row.created_by,
        row.details,
        row.customers,
        row.orders,
        row.source_accounts,
      ],
    );
    const paginated = paginateRows(filteredRows, page, limit);

    return {
      data: paginated.data,
      meta: {
        count: paginated.count,
        page: paginated.page,
        limit: paginated.limit,
        totalPages: paginated.totalPages,
      },
    };
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    if (process.env.NODE_ENV === 'development') console.error('[ActivityLog] Paginated error:', error);
    throw error;
  }

  return {
    data: data || [],
    meta: {
      count: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    },
  };
}
