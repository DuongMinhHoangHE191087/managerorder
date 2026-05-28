import type { Json } from "@/lib/supabase/database.types";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import type {
  AccountShareAccessPolicy,
  AccountShareAccessLogRow,
  AccountShareEventType,
  AccountShareExposurePolicy,
  AccountShareLinkRow,
  ShareVisitorContext,
} from "./types";

export type AccountShareLinkInsert = {
  account_id: string;
  source_account_id: string;
  order_id?: string | null;
  order_item_id?: string | null;
  customer_id?: string | null;
  short_link_id?: string | null;
  slug: string;
  title?: string | null;
  expires_at?: string | null;
  max_views?: number;
  max_unlocks?: number;
  passcode_hash?: string | null;
  exposure_policy: AccountShareExposurePolicy;
  access_policy: AccountShareAccessPolicy;
  created_by?: string | null;
};

export type AccountShareLinkUpdate = Partial<{
  title: string | null;
  status: "active" | "disabled" | "expired";
  expires_at: string | null;
  max_views: number;
  max_unlocks: number;
  passcode_hash: string | null;
  exposure_policy: AccountShareExposurePolicy;
  access_policy: AccountShareAccessPolicy;
  locked_ip: string | null;
  locked_ipv6: string | null;
}>;

type AccountShareCounter = "view_count" | "unlock_count";
type AccountShareMaxCounter = "max_views" | "max_unlocks";

export async function listAccountShareLinks(
  accountId: string,
  filters: { sourceAccountId?: string | null } = {},
): Promise<AccountShareLinkRow[]> {
  let query = supabase
    .from("account_share_links")
    .select("*")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.sourceAccountId) {
    query = query.eq("source_account_id", filters.sourceAccountId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAccountShareLinkById(id: string, accountId: string): Promise<AccountShareLinkRow | null> {
  const { data, error } = await supabase
    .from("account_share_links")
    .select("*")
    .eq("id", id)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getAccountShareLinkBySlug(slug: string): Promise<AccountShareLinkRow | null> {
  const { data, error } = await supabase
    .from("account_share_links")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function listAccountShareAccessLogs(
  linkId: string,
  accountId: string,
  limit = 50,
): Promise<AccountShareAccessLogRow[]> {
  const { data, error } = await supabase
    .from("account_share_access_logs")
    .select("*")
    .eq("account_share_link_id", linkId)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createAccountShareLink(input: AccountShareLinkInsert): Promise<AccountShareLinkRow> {
  const { data, error } = await supabase
    .from("account_share_links")
    .insert({
      ...input,
      exposure_policy: input.exposure_policy as unknown as Json,
      access_policy: input.access_policy as unknown as Json,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateAccountShareLink(
  id: string,
  accountId: string,
  input: AccountShareLinkUpdate,
): Promise<AccountShareLinkRow> {
  const payload: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  if (input.exposure_policy) {
    payload.exposure_policy = input.exposure_policy;
  }
  if (input.access_policy) {
    payload.access_policy = input.access_policy;
  }

  const { data, error } = await supabase
    .from("account_share_links")
    .update(payload)
    .eq("id", id)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteAccountShareLink(id: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from("account_share_links")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("account_id", accountId);

  if (error) throw new Error(error.message);
}

export async function consumeAccountShareView(id: string): Promise<AccountShareLinkRow | null> {
  const { data, error } = await supabase.rpc("consume_account_share_view" as never, {
    p_link_id: id,
  } as never);

  if (!error) {
    const rows = data as unknown as AccountShareLinkRow[] | null;
    return rows?.[0] ?? null;
  }

  console.warn("[AccountShare] consume_account_share_view RPC unavailable, using fallback:", error.message);
  return consumeAccountShareCounterFallback(id, "view_count", "max_views");
}

export async function consumeAccountShareUnlock(id: string): Promise<AccountShareLinkRow | null> {
  const { data, error } = await supabase.rpc("consume_account_share_unlock" as never, {
    p_link_id: id,
  } as never);

  if (!error) {
    const rows = data as unknown as AccountShareLinkRow[] | null;
    return rows?.[0] ?? null;
  }

  console.warn("[AccountShare] consume_account_share_unlock RPC unavailable, using fallback:", error.message);
  return consumeAccountShareCounterFallback(id, "unlock_count", "max_unlocks");
}

async function consumeAccountShareCounterFallback(
  id: string,
  counter: AccountShareCounter,
  maxCounter: AccountShareMaxCounter,
): Promise<AccountShareLinkRow | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row, error: readError } = await supabase
      .from("account_share_links")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (readError) throw new Error(readError.message);
    if (!row || (row[maxCounter] > 0 && row[counter] >= row[maxCounter])) {
      return null;
    }

    const { data: updated, error: updateError } = await supabase
      .from("account_share_links")
      .update({ [counter]: row[counter] + 1, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq(counter, row[counter])
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (updated) {
      return updated;
    }
  }

  return null;
}

export async function lockAccountShareIp(
  id: string,
  field: "locked_ip" | "locked_ipv6",
  ipAddress: string,
): Promise<void> {
  const { error } = await supabase
    .from("account_share_links")
    .update({ [field]: ipAddress, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is(field, null);

  if (error) throw new Error(error.message);
}

export async function logAccountShareAccess(input: {
  linkId: string;
  accountId: string;
  eventType: AccountShareEventType;
  visitor: ShareVisitorContext;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase
    .from("account_share_access_logs")
    .insert({
      account_share_link_id: input.linkId,
      account_id: input.accountId,
      event_type: input.eventType,
      ip_address: input.visitor.ipAddress,
      ip_version: input.visitor.ipVersion,
      user_agent: input.visitor.userAgent,
      reason: input.reason ?? null,
      metadata: (input.metadata ?? {}) as Json,
    });

  if (error) {
    console.warn("[AccountShare] failed to write access log:", error.message);
  }
}

export async function countRecentFailedUnlocks(
  linkId: string,
  ipAddress: string | null,
  minutes = 10,
): Promise<number> {
  if (!ipAddress) return 0;
  
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from("account_share_access_logs")
    .select("*", { count: "exact", head: true })
    .eq("account_share_link_id", linkId)
    .eq("event_type", "blocked")
    .eq("reason", "invalid_passcode")
    .eq("ip_address", ipAddress)
    .gte("created_at", since);

  if (error) {
    console.warn("[AccountShare] count failed unlocks error:", error.message);
    return 0;
  }
  
  return count ?? 0;
}
