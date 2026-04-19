// ============================================================
// SHORT LINKS REPOSITORY — Supabase
// Table: short_links
// Atomic click tracking via RPC use_short_link
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { cached, invalidate, invalidatePrefix, TTL } from '@/lib/cache/db-cache';

type ShortLinkRowBase = Database['public']['Tables']['short_links']['Row'];
type ShortLinkInsert = Database['public']['Tables']['short_links']['Insert'];

// Extended type with anti-fraud columns (added by migration, not yet in generated types)
export type ShortLinkRow = ShortLinkRowBase & {
  access_token?: string | null;
  locked_ip?: string | null;
  require_token?: boolean;
  notify_clicks?: boolean;
};

const SLUG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const SLUG_LENGTH = 8;
const TOKEN_LENGTH = 12;

const key = {
  list: (accountId: string) => `short_links:list:${accountId}`,
  item: (id: string) => `short_links:item:${id}`,
  slug: (slug: string) => `short_links:slug:${slug}`,
};

/** Generate a URL-safe random slug */
function generateSlug(): string {
  const bytes = new Uint8Array(SLUG_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => SLUG_CHARS[b % SLUG_CHARS.length]).join('');
}

/** Generate a short access token (12 chars) */
function generateAccessToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => SLUG_CHARS[b % SLUG_CHARS.length]).join('');
}

export async function listShortLinks(accountId: string): Promise<ShortLinkRow[]> {
  return cached(
    key.list(accountId),
    async () => {
      const { data, error } = await supabase
        .from('short_links')
        .select('*')
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    TTL.LIST,
  );
}

export async function getShortLinkById(id: string, accountId: string): Promise<ShortLinkRow | null> {
  return cached(
    key.item(id),
    async () => {
      const { data, error } = await supabase
        .from('short_links')
        .select('*')
        .eq('id', id)
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .single();
      if (error) return null;
      return data;
    },
    TTL.ITEM,
  );
}

export async function getShortLinkBySlug(slug: string): Promise<ShortLinkRow | null> {
  return cached(
    key.slug(slug),
    async () => {
      const { data, error } = await supabase
        .from('short_links')
        .select('*')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();
      if (error) return null;
      return data;
    },
    TTL.ITEM,
  );
}

export async function createShortLink(
  accountId: string,
  input: {
    target_url: string;
    title?: string;
    max_clicks?: number;
    expires_at?: string | null;
    order_id?: string | null;
    customer_id?: string | null;
    created_by?: string;
    require_token?: boolean;
    notify_clicks?: boolean;
  },
): Promise<ShortLinkRow> {
  const maxRetries = 3;
  const token = input.require_token ? generateAccessToken() : null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const slug = generateSlug();

    const insertData: ShortLinkInsert = {
      account_id: accountId,
      slug,
      target_url: input.target_url,
      title: input.title ?? null,
      max_clicks: input.max_clicks ?? 999,
      expires_at: input.expires_at ?? null,
      order_id: input.order_id ?? null,
      customer_id: input.customer_id ?? null,
      created_by: input.created_by ?? null,
      require_token: input.require_token ?? false,
      access_token: token,
      notify_clicks: input.notify_clicks ?? false,
    } as ShortLinkInsert;

    const { data, error } = await supabase
      .from('short_links')
      .insert(insertData)
      .select()
      .single();

    // Duplicate slug — retry with new slug
    if (error?.code === '23505') continue;
    if (error) throw new Error(error.message);

    invalidatePrefix(`short_links:list:${accountId}`);
    return data;
  }

  throw new Error('Failed to generate unique slug after retries');
}

/**
 * Atomic click-and-validate via Supabase RPC.
 * Returns { target_url, is_valid, remaining } or null if slug not found.
 */
export async function executeShortLink(
  slug: string,
): Promise<{ target_url: string; is_valid: boolean; remaining: number } | null> {
  // Invalidate cache so next lookup sees updated state
  invalidate(key.slug(slug));

  const { data, error } = await supabase.rpc('use_short_link' as never, {
    p_slug: slug,
  } as never);

  if (error) {
    console.error('[executeShortLink] RPC error:', error.message);
    // Fallback: JS-side atomic check
    return executeShortLinkFallback(slug);
  }

  const rows = data as unknown as Array<{ target_url: string; is_valid: boolean; remaining: number }>;
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

/** JS-side fallback if RPC not deployed yet */
async function executeShortLinkFallback(
  slug: string,
): Promise<{ target_url: string; is_valid: boolean; remaining: number } | null> {
  const { data: link, error } = await supabase
    .from('short_links')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (error || !link) return null;

  if (link.status !== 'active') {
    return { target_url: '', is_valid: false, remaining: 0 };
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await supabase.from('short_links').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', link.id);
    return { target_url: '', is_valid: false, remaining: 0 };
  }

  if (link.current_clicks >= link.max_clicks) {
    await supabase.from('short_links').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', link.id);
    return { target_url: '', is_valid: false, remaining: 0 };
  }

  // Atomic increment
  const { error: updateError } = await supabase
    .from('short_links')
    .update({
      current_clicks: link.current_clicks + 1,
      status: link.current_clicks + 1 >= link.max_clicks ? 'expired' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.id)
    .eq('current_clicks', link.current_clicks); // optimistic locking

  if (updateError) {
    return { target_url: '', is_valid: false, remaining: 0 };
  }

  return {
    target_url: link.target_url,
    is_valid: true,
    remaining: link.max_clicks - link.current_clicks - 1,
  };
}

export async function updateShortLink(
  id: string,
  accountId: string,
  input: Partial<Pick<ShortLinkRow, 'title' | 'target_url' | 'max_clicks' | 'expires_at' | 'status' | 'require_token' | 'locked_ip' | 'notify_clicks'>>,
): Promise<ShortLinkRow> {
  const { data, error } = await supabase
    .from('short_links')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Short link not found');

  invalidatePrefix(`short_links:list:${accountId}`);
  invalidate(key.item(id));
  invalidate(key.slug(data.slug));
  return data;
}

export async function deleteShortLink(id: string, accountId: string): Promise<void> {
  // Get slug before delete for cache invalidation
  const { data: link } = await supabase
    .from('short_links')
    .select('slug')
    .eq('id', id)
    .eq('account_id', accountId)
    .single();

  const { error } = await supabase
    .from('short_links')
    .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);

  invalidatePrefix(`short_links:list:${accountId}`);
  invalidate(key.item(id));
  if (link?.slug) invalidate(key.slug(link.slug));
}

/** Lock a short link to a specific IP (first visitor) */
export async function lockShortLinkIP(linkId: string, ip: string): Promise<void> {
  await supabase
    .from('short_links')
    .update({ locked_ip: ip, updated_at: new Date().toISOString() })
    .eq('id', linkId)
    .is('locked_ip', null); // only lock if not already locked
}
