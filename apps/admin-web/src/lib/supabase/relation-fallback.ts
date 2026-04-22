import { supabaseAdmin } from "@/lib/supabase/admin";

type SupabaseClient = typeof supabaseAdmin;

export function isRelationCacheError(
  error: { code?: string | null } | null | undefined,
): boolean {
  return error?.code === "PGRST200" || error?.code === "42703";
}

export async function loadRowsByIds<T extends { id: string }>(
  client: SupabaseClient,
  table: string,
  accountId: string | null | undefined,
  ids: string[],
  select: string,
): Promise<Map<string, T>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];

  if (uniqueIds.length === 0) {
    return new Map<string, T>();
  }

  const query = accountId
    ? client
      .from(table)
      .select(select)
      .eq("account_id", accountId)
    : client
      .from(table)
      .select(select);

  const { data, error } = await query.in("id", uniqueIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as T[];
  return new Map(rows.map((row) => [row.id, row] as const));
}
