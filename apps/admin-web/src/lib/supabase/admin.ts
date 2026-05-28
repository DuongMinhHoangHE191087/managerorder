import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("supabase/admin is server-only");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Missing Supabase service role key. Admin bypass features won't work properly.");
}

/**
 * Admin Supabase client using the SERVICE ROLE key.
 * DANGER: This client bypasses all Row Level Security (RLS) policies.
 * 
 * TENANT ISOLATION WARNING: Every time you query using this client, you MUST 
 * strictly append `.eq('account_id', accountId)` to ensure cross-tenant data 
 * does not leak. Missing this is a critical security vulnerability.
 * 
 * ONLY use this in secure server-side routes (e.g. Next.js API Routes, Server Actions)
 * NEVER expose this to the browser/client.
 */
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || "placeholder-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
