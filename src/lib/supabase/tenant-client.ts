/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "./admin";

/**
 * Tenant-scoped helper that enforces account_id on standard queries.
 * Use this wrapper instead of supabaseAdmin directly when dealing with tenant-owned tables
 * in background jobs or server bypasses.
 */
export const createTenantQuery = (accountId: string) => {
  return {
    from: (table: string) => ({
      select: (columns?: string, options?: any) => supabaseAdmin.from(table).select(columns, options).eq("account_id", accountId),
      insert: (values: any, options?: any) => supabaseAdmin.from(table).insert(
        Array.isArray(values) ? values.map(v => ({...v, account_id: accountId})) : {...values, account_id: accountId},
        options
      ),
      update: (values: any, options?: any) => supabaseAdmin.from(table).update(values, options).eq("account_id", accountId),
      delete: (options?: any) => supabaseAdmin.from(table).delete(options).eq("account_id", accountId),
    }),
    rpc: (fn: string, args: any = {}) => supabaseAdmin.rpc(fn, { ...args, account_id: accountId }),
  };
};
