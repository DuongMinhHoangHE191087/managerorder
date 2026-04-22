import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined = undefined;

/**
 * Supabase browser client using @supabase/ssr.
 * Used in Client Components for auth operations (login, logout, session).
 * Memoized to prevent "Lock broken by another request" runtime errors.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return browserClient as SupabaseClient;
}

// Legacy client removed — all consumers migrated to:
// - supabaseAdmin (server: premium-accounts-helpers, subscriptions.repo)
// - createSupabaseBrowserClient (client: orders/page.tsx dead import removed)
