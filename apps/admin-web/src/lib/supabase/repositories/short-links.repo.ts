// ============================================================
// SHORT LINKS REPOSITORY — Supabase
// Table: short_links
// Atomic click tracking via RPC use_short_link
// ============================================================

import { supabaseAdmin as supabase } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { cached, invalidate, invalidatePrefix, TTL } from '@/lib/cache/db-cache';
import { isMissingColumnError } from '@/lib/supabase/schema-errors';
import { SchemaNotInitializedError } from '@/lib/utils/errors';
import type {
  ShortLinkDeliveryMode,
  ShortLinkFailureTemplateKey,
  ShortLinkLandingTemplateKey,
} from "@/lib/domain/types";

type ShortLinkRowBase = Database['public']['Tables']['short_links']['Row'];
type ShortLinkInsert = Database['public']['Tables']['short_links']['Insert'];
export type ShortLinkRow = ShortLinkRowBase;

const SLUG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const SLUG_LENGTH = 8;
const TOKEN_LENGTH = 12;

const key = {
  list: (accountId: string) => `short_links:list:${accountId}`,
  item: (id: string) => `short_links:item:${id}`,
  slug: (slug: string) => `short_links:slug:${slug}`,
  summary: (slug: string) => `short_links:summary:${slug}`,
};

function buildLegacyShortLinkInsert(
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
  accountId: string,
  slug: string,
  token: string | null,
): ShortLinkInsert {
  return {
    account_id: accountId,
    slug,
    target_url: input.target_url,
    title: input.title ?? null,
    max_clicks: input.max_clicks ?? 999,
    expires_at: input.expires_at ?? null,
    order_id: input.order_id ?? null,
    customer_id: input.customer_id ?? null,
    status: "active",
    created_by: input.created_by ?? null,
    require_token: input.require_token ?? false,
    access_token: token,
    notify_clicks: input.notify_clicks ?? false,
  } as ShortLinkInsert;
}

function buildModernShortLinkInsert(
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
    sales_channel_id?: string | null;
    delivery_mode?: ShortLinkDeliveryMode;
    landing_template_key?: ShortLinkLandingTemplateKey | null;
    failure_template_key?: ShortLinkFailureTemplateKey | null;
    seller_contact_url?: string | null;
  },
  accountId: string,
  slug: string,
  token: string | null,
): ShortLinkInsert {
  return {
    account_id: accountId,
    slug,
    target_url: input.target_url,
    title: input.title ?? null,
    max_clicks: input.max_clicks ?? 999,
    expires_at: input.expires_at ?? null,
    order_id: input.order_id ?? null,
    customer_id: input.customer_id ?? null,
    status: "active",
    created_by: input.created_by ?? null,
    require_token: input.require_token ?? false,
    access_token: token,
    notify_clicks: input.notify_clicks ?? false,
    sales_channel_id: input.sales_channel_id ?? null,
    delivery_mode: input.delivery_mode ?? "inherit_channel",
    landing_template_key: input.landing_template_key ?? null,
    failure_template_key: input.failure_template_key ?? null,
    seller_contact_url: input.seller_contact_url ?? null,
  } as ShortLinkInsert;
}

function isShortLinkExtensionSchemaError(error: unknown): boolean {
  return (
    isMissingColumnError(error, "sales_channel_id", "short_links")
    || isMissingColumnError(error, "delivery_mode", "short_links")
    || isMissingColumnError(error, "landing_template_key", "short_links")
    || isMissingColumnError(error, "failure_template_key", "short_links")
    || isMissingColumnError(error, "seller_contact_url", "short_links")
  );
}

function requiresCreateShortLinkExtensionSchema(input: {
  sales_channel_id?: string | null;
  delivery_mode?: ShortLinkDeliveryMode;
  landing_template_key?: ShortLinkLandingTemplateKey | null;
  failure_template_key?: ShortLinkFailureTemplateKey | null;
  seller_contact_url?: string | null;
}): boolean {
  return Boolean(input.sales_channel_id)
    || input.delivery_mode === "landing_page"
    || Boolean(input.landing_template_key)
    || Boolean(input.failure_template_key)
    || Boolean(input.seller_contact_url);
}

function requiresUpdateShortLinkExtensionSchema(input: {
  sales_channel_id?: string | null;
  delivery_mode?: ShortLinkDeliveryMode;
  landing_template_key?: ShortLinkLandingTemplateKey | null;
  failure_template_key?: ShortLinkFailureTemplateKey | null;
  seller_contact_url?: string | null;
}): boolean {
  return (
    input.sales_channel_id !== undefined
    || input.delivery_mode === "landing_page"
    || input.delivery_mode === "inherit_channel"
    || (input.landing_template_key !== undefined && input.landing_template_key !== null)
    || input.failure_template_key !== undefined
    || input.seller_contact_url !== undefined
  );
}

function createShortLinkExtensionSchemaError(operation: "create" | "update"): SchemaNotInitializedError {
  return new SchemaNotInitializedError(
    "Cấu hình landing hoặc kênh bán của short-link chưa dùng được vì cơ sở dữ liệu chưa được nâng cấp",
    {
      relation: "short_links",
      missingColumns: ["sales_channel_id", "delivery_mode", "landing_template_key", "failure_template_key", "seller_contact_url"],
      operation,
    },
  );
}

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

export async function getShortLinkById(
  id: string,
  accountId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<ShortLinkRow | null> {
  return cached(
    key.item(id),
    async () => {
      let query = supabase
        .from('short_links')
        .select('*')
        .eq('id', id)
        .eq('account_id', accountId);

      if (!options.includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query.single();
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

const PUBLIC_SUMMARY_SELECT =
  "id, account_id, order_id, sales_channel_id, delivery_mode, landing_template_key, failure_template_key, seller_contact_url, title, status, max_clicks, current_clicks, expires_at, notify_clicks, locked_ip, locked_ipv6, require_token, access_token";
const LEGACY_PUBLIC_SUMMARY_SELECT =
  "id, account_id, order_id, title, status, max_clicks, current_clicks, expires_at, notify_clicks, locked_ip, locked_ipv6, require_token, access_token";

export async function getShortLinkBySlugSummary(slug: string): Promise<Omit<ShortLinkRow, "target_url"> | null> {
  return cached(
    `short_links:summary:${slug}`,
    async () => {
      const query = supabase
        .from('short_links')
        .select(PUBLIC_SUMMARY_SELECT)
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();

      const { data, error } = await query;
      if (!error && data) {
        return data as Omit<ShortLinkRow, "target_url">;
      }

      const legacyQuery = supabase
        .from('short_links')
        .select(LEGACY_PUBLIC_SUMMARY_SELECT)
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();

      const { data: legacyData, error: legacyError } = await legacyQuery;
      if (legacyError) return null;
      return legacyData as Omit<ShortLinkRow, "target_url">;
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
    sales_channel_id?: string | null;
    delivery_mode?: ShortLinkDeliveryMode;
    landing_template_key?: ShortLinkLandingTemplateKey | null;
    failure_template_key?: ShortLinkFailureTemplateKey | null;
    seller_contact_url?: string | null;
  },
): Promise<ShortLinkRow> {
  const maxRetries = 3;
  const token = input.require_token ? generateAccessToken() : null;
  const requiresExtensionSchema = requiresCreateShortLinkExtensionSchema(input);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const slug = generateSlug();
    const insertData = requiresExtensionSchema
      ? buildModernShortLinkInsert(input, accountId, slug, token)
      : buildLegacyShortLinkInsert(input, accountId, slug, token);

    let data: ShortLinkRow | null = null;
    let error: { code?: string; message: string } | null = null;
    try {
      const result = await supabase
        .from('short_links')
        .insert(insertData)
        .select()
        .single();
      data = (result as { data: ShortLinkRow | null }).data ?? null;
      error = (result as { error: { code?: string; message: string } | null }).error ?? null;
    } catch (caughtError) {
      error = caughtError as { code?: string; message: string } | null;
    }

    // Duplicate slug — retry with new slug
    if (error?.code === '23505') continue;
    if (error) {
      if (requiresExtensionSchema && isShortLinkExtensionSchemaError(error)) {
        throw createShortLinkExtensionSchemaError("create");
      }

      throw new Error(error.message);
    }

    invalidatePrefix(`short_links:list:${accountId}`);
    invalidate(key.summary(slug));
    if (!data) {
      throw new Error('Failed to create short link');
    }
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
  input: Partial<Pick<
    ShortLinkRow,
    | 'title'
    | 'target_url'
    | 'max_clicks'
    | 'current_clicks'
    | 'expires_at'
    | 'status'
    | 'require_token'
    | 'access_token'
    | 'locked_ip'
    | 'locked_ipv6'
    | 'notify_clicks'
    | 'sales_channel_id'
    | 'delivery_mode'
    | 'landing_template_key'
    | 'failure_template_key'
    | 'seller_contact_url'
  >>,
): Promise<ShortLinkRow> {
  const requiresExtensionSchema = requiresUpdateShortLinkExtensionSchema(input);
  const legacyUpdatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) legacyUpdatePayload.title = input.title;
  if (input.target_url !== undefined) legacyUpdatePayload.target_url = input.target_url;
  if (input.max_clicks !== undefined) legacyUpdatePayload.max_clicks = input.max_clicks;
  if (input.current_clicks !== undefined) legacyUpdatePayload.current_clicks = input.current_clicks;
  if (input.expires_at !== undefined) legacyUpdatePayload.expires_at = input.expires_at;
  if (input.status !== undefined) legacyUpdatePayload.status = input.status;
  if (input.require_token !== undefined) legacyUpdatePayload.require_token = input.require_token;
  if (input.access_token !== undefined) legacyUpdatePayload.access_token = input.access_token;
  if (input.locked_ip !== undefined) legacyUpdatePayload.locked_ip = input.locked_ip;
  if (input.locked_ipv6 !== undefined) legacyUpdatePayload.locked_ipv6 = input.locked_ipv6;
  if (input.notify_clicks !== undefined) legacyUpdatePayload.notify_clicks = input.notify_clicks;

  const updatePayload = requiresExtensionSchema
    ? { ...input, updated_at: new Date().toISOString() }
    : legacyUpdatePayload;

  let data: ShortLinkRow | null = null;
  let error: { code?: string; message: string } | null = null;
  try {
    const result = await supabase
      .from('short_links')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();
    data = (result as { data: ShortLinkRow | null }).data ?? null;
    error = (result as { error: { code?: string; message: string } | null }).error ?? null;
  } catch (caughtError) {
    error = caughtError as { code?: string; message: string } | null;
  }

  if (error) {
    if (requiresExtensionSchema && isShortLinkExtensionSchemaError(error)) {
      throw createShortLinkExtensionSchemaError("update");
    }

    throw new Error(error.message);
  }
  if (!data) throw new Error("Không tìm thấy link rút gọn");

  invalidatePrefix(`short_links:list:${accountId}`);
  invalidate(key.item(id));
  invalidate(key.slug(data.slug));
  invalidate(key.summary(data.slug));
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
  if (link?.slug) invalidate(key.summary(link.slug));
}

/** Lock a short link to a specific IP (first visitor) */
export async function lockShortLinkIP(linkId: string, ip: string): Promise<void> {
  await supabase
    .from('short_links')
    .update({ locked_ip: ip, updated_at: new Date().toISOString() })
    .eq('id', linkId)
    .is('locked_ip', null); // only lock if not already locked
}
