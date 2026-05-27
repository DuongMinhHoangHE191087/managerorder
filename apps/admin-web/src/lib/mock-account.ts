import { supabaseAdmin } from "@/lib/supabase/admin";

export const DEFAULT_MOCK_ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";

async function tryResolveAccountFromOrders(): Promise<string | null> {
  try {
    const lookup = supabaseAdmin
      .from("orders")
      .select("account_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2_000);
    });

    const result = await Promise.race([lookup, timeout]);
    const data = result && typeof result === "object" && "data" in result ? (result as { data?: { account_id?: string | null } | null }).data : null;
    if (data?.account_id) {
      return data.account_id;
    }
  } catch {
    // Ignore lookup failures in local/offline environments.
  }

  return null;
}

async function tryResolveAccountFromAccounts(): Promise<string | null> {
  try {
    const lookup = supabaseAdmin
      .from("accounts")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2_000);
    });

    const result = await Promise.race([lookup, timeout]);
    const data = result && typeof result === "object" && "data" in result ? (result as { data?: { id?: string | null } | null }).data : null;
    if (data?.id) {
      return data.id;
    }
  } catch {
    // Ignore lookup failures in local/offline environments.
  }

  return null;
}

export async function resolveBestMockAccountId(explicitAccountId?: string): Promise<string> {
  if (explicitAccountId?.trim()) {
    return explicitAccountId.trim();
  }

  const envAccountId = process.env.E2E_MOCK_ACCOUNT_ID?.trim();
  if (envAccountId) {
    return envAccountId;
  }

  const orderAccountId = await tryResolveAccountFromOrders();
  if (orderAccountId) {
    return orderAccountId;
  }

  const accountId = await tryResolveAccountFromAccounts();
  if (accountId) {
    return accountId;
  }

  return DEFAULT_MOCK_ACCOUNT_ID;
}
