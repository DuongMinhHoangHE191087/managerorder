import { supabaseAdmin as supabase } from '@/lib/supabase/admin';

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

/**
 * Creates a new activity log entry.
 * Designed to fail gracefully (log error but return null) so it doesn't break main business flows.
 */
export async function createActivityLog(input: ActivityLogInsert): Promise<ActivityLog | null> {
  try {
    const safeInput = { ...input, details: flattenDetails(input.details) };
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

  let query = supabase
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
  if (search) {
     const sanitized = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
     const searchPattern = `%${sanitized}%`;
     query = query.or(`action_type.ilike.${searchPattern},created_by.ilike.${searchPattern}`);
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
