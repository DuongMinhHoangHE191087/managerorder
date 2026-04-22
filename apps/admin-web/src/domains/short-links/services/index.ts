import type {
  CreateShortLinkInput,
  UpdateShortLinkInput,
} from "@/lib/domain/schemas";
import type { SalesChannel } from "@/lib/domain/types";
import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import { mapSalesChannel } from "@/domains/sales-channels";
import { getSalesChannelById } from "@/domains/sales-channels/repository";
import {
  createShortLink as createShortLinkRepo,
  getShortLinkById as getShortLinkByIdRepo,
  getShortLinkBySlug as getShortLinkBySlugRepo,
  getShortLinkBySlugSummary as getShortLinkBySlugSummaryRepo,
  listShortLinks as listShortLinksRepo,
  updateShortLink as updateShortLinkRepo,
  type ShortLinkRow,
} from "../repository";
import {
  resolveShortLinkPolicy,
  type ResolvedShortLinkPolicy,
} from "./policy";
import {
  applyShortLinkRuntimePolicy,
  getShortLinkRuntimePolicy,
} from "./runtime";

export interface ShortLinkResolvedContext {
  salesChannel: SalesChannel | null;
  resolvedPolicy: ResolvedShortLinkPolicy;
}

export type ShortLinkPublicSummary = Omit<ShortLinkRow, "target_url">;

export interface ShortLinkDetailRecord extends ShortLinkResolvedContext {
  link: ShortLinkRow;
}

export interface ShortLinkPublicSummaryRecord extends ShortLinkResolvedContext {
  link: ShortLinkPublicSummary;
}

const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const TOKEN_LENGTH = 12;

function generateAccessToken() {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => TOKEN_CHARS[value % TOKEN_CHARS.length]).join("");
}

async function getInheritedSalesChannelId(
  accountId: string,
  orderId?: string | null,
): Promise<string | null> {
  if (!orderId) {
    return null;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("sales_channel_id")
    .eq("id", orderId)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }

  return data?.sales_channel_id ?? null;
}

async function getEffectiveSalesChannelId(
  link: Pick<ShortLinkPublicSummary, "account_id" | "sales_channel_id" | "order_id">,
): Promise<string | null> {
  if (link.sales_channel_id) {
    return link.sales_channel_id;
  }

  return getInheritedSalesChannelId(link.account_id, link.order_id);
}

function normalizeCreateInput(
  input: CreateShortLinkInput,
  salesChannelId: string | null,
): Parameters<typeof createShortLinkRepo>[1] {
  const deliveryMode = input.delivery_mode ?? "inherit_channel";

  return {
    ...input,
    sales_channel_id: salesChannelId,
    delivery_mode: deliveryMode,
    landing_template_key:
      deliveryMode === "direct_redirect" ? null : (input.landing_template_key ?? null),
  };
}

function normalizeUpdateInput(input: UpdateShortLinkInput): Parameters<typeof updateShortLinkRepo>[2] {
  if (input.delivery_mode === "direct_redirect") {
    return {
      ...input,
      landing_template_key: null,
    };
  }

  return input;
}

export async function listShortLinksForAccount(accountId: string): Promise<ShortLinkRow[]> {
  return listShortLinksRepo(accountId);
}

export async function createShortLinkForAccount(
  accountId: string,
  input: CreateShortLinkInput,
): Promise<ShortLinkRow> {
  const inheritedSalesChannelId =
    input.sales_channel_id ?? (await getInheritedSalesChannelId(accountId, input.order_id));

  return createShortLinkRepo(accountId, normalizeCreateInput(input, inheritedSalesChannelId));
}

export async function updateShortLinkForAccount(
  id: string,
  accountId: string,
  input: UpdateShortLinkInput,
): Promise<ShortLinkRow> {
  const existing = await getShortLinkByIdRepo(id, accountId);
  if (!existing) {
    throw new Error("Short link not found");
  }

  const normalizedInput = normalizeUpdateInput(input);

  if (input.require_token === true && (!existing.require_token || !existing.access_token)) {
    normalizedInput.access_token = generateAccessToken();
    normalizedInput.locked_ip = null;
    normalizedInput.locked_ipv6 = null;
  }

  if (input.require_token === false && existing.require_token) {
    normalizedInput.access_token = null;
    normalizedInput.locked_ip = null;
    normalizedInput.locked_ipv6 = null;
  }

  return updateShortLinkRepo(id, accountId, normalizedInput);
}

export async function resolveShortLinkContext(
  link: Pick<ShortLinkPublicSummary, "account_id" | "sales_channel_id" | "order_id" | "delivery_mode" | "landing_template_key">,
): Promise<ShortLinkResolvedContext> {
  const effectiveSalesChannelId = await getEffectiveSalesChannelId(link);
  const salesChannelRow = effectiveSalesChannelId
    ? await getSalesChannelById(effectiveSalesChannelId, link.account_id)
    : null;
  const salesChannel = salesChannelRow ? mapSalesChannel(salesChannelRow) : null;
  const runtimePolicy = getShortLinkRuntimePolicy();

  return {
    salesChannel,
    resolvedPolicy: applyShortLinkRuntimePolicy(
      resolveShortLinkPolicy(
        {
          delivery_mode: link.delivery_mode,
          landing_template_key: link.landing_template_key,
        },
        salesChannelRow
          ? {
              default_delivery_mode: salesChannelRow.default_delivery_mode,
              default_landing_template_key: salesChannelRow.default_landing_template_key,
            }
          : null,
      ),
      runtimePolicy,
    ),
  };
}

export async function resolvePublicShortLinkSummaryBySlug(
  slug: string,
): Promise<ShortLinkPublicSummaryRecord | null> {
  const link = await getShortLinkBySlugSummaryRepo(slug);
  if (!link) {
    return null;
  }

  const context = await resolveShortLinkContext(link);
  return {
    link,
    ...context,
  };
}

export async function getShortLinkDetailForAccount(
  id: string,
  accountId: string,
): Promise<ShortLinkDetailRecord | null> {
  const link = await getShortLinkByIdRepo(id, accountId);
  if (!link) {
    return null;
  }

  const context = await resolveShortLinkContext(link);
  return {
    link,
    ...context,
  };
}

export async function resolvePublicShortLinkBySlug(
  slug: string,
): Promise<ShortLinkDetailRecord | null> {
  const link = await getShortLinkBySlugRepo(slug);
  if (!link) {
    return null;
  }

  const context = await resolveShortLinkContext(link);
  return {
    link,
    ...context,
  };
}

export { resolveShortLinkPolicy } from "./policy";
export type { ResolvedShortLinkPolicy } from "./policy";
export {
  applyShortLinkRuntimePolicy,
  getShortLinkRuntimePolicy,
} from "./runtime";
export {
  logShortLinkClick,
  type ShortLinkClickEventType,
  type ShortLinkClickRecord,
  type ShortLinkClickInsertClient,
} from "./click-log";
