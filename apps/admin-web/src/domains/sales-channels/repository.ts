import { supabaseAdmin as supabase } from "@/lib/supabase/admin";
import type {
  ShortLinkDeliveryMode,
  ShortLinkResolvedDeliveryMode,
  SalesChannelRuntimeSummary,
} from "@/lib/domain/types";
import {
  createSalesChannel,
  deleteSalesChannel,
  getSalesChannelById,
  listSalesChannels,
  updateSalesChannel,
  type SalesChannelRow,
} from "@/lib/supabase/repositories/settings.repo";

export {
  createSalesChannel,
  deleteSalesChannel,
  getSalesChannelById,
  listSalesChannels,
  updateSalesChannel,
  type SalesChannelRow,
} from "@/lib/supabase/repositories/settings.repo";

export interface SalesChannelRuntimeRow extends SalesChannelRow {
  runtime: SalesChannelRuntimeSummary;
}

type SalesChannelRuntimeOrderRow = {
  id: string;
  sales_channel_id: string | null;
};

type SalesChannelRuntimeShortLinkRow = {
  id: string;
  order_id: string | null;
  sales_channel_id: string | null;
  delivery_mode: ShortLinkDeliveryMode | null;
};

function createRuntimeSummary(): SalesChannelRuntimeSummary {
  return {
    linkedOrderCount: 0,
    shortLinkCount: 0,
    landingLinkCount: 0,
    directLinkCount: 0,
    inheritedLinkCount: 0,
    overrideLinkCount: 0,
  };
}

function resolveEffectiveDeliveryMode(
  deliveryMode: ShortLinkDeliveryMode | null,
  defaultDeliveryMode: ShortLinkResolvedDeliveryMode,
): ShortLinkResolvedDeliveryMode {
  if (deliveryMode === "landing_page" || deliveryMode === "direct_redirect") {
    return deliveryMode;
  }

  return defaultDeliveryMode;
}

export function buildSalesChannelRuntimeRows(
  channels: SalesChannelRow[],
  orders: SalesChannelRuntimeOrderRow[],
  shortLinks: SalesChannelRuntimeShortLinkRow[],
): SalesChannelRuntimeRow[] {
  const runtimeByChannel = new Map<string, SalesChannelRuntimeSummary>();
  const defaultDeliveryModeByChannel = new Map<string, ShortLinkResolvedDeliveryMode>();
  const orderChannelById = new Map<string, string>();

  for (const channel of channels) {
    runtimeByChannel.set(channel.id, createRuntimeSummary());
    defaultDeliveryModeByChannel.set(channel.id, channel.default_delivery_mode);
  }

  for (const order of orders) {
    if (!order.sales_channel_id) {
      continue;
    }
    orderChannelById.set(order.id, order.sales_channel_id);
    const runtime = runtimeByChannel.get(order.sales_channel_id);
    if (runtime) {
      runtime.linkedOrderCount += 1;
    }
  }

  for (const link of shortLinks) {
    const effectiveChannelId =
      link.sales_channel_id ?? (link.order_id ? orderChannelById.get(link.order_id) ?? null : null);

    if (!effectiveChannelId) {
      continue;
    }

    const runtime = runtimeByChannel.get(effectiveChannelId);
    if (!runtime) {
      continue;
    }

    const effectiveDeliveryMode = resolveEffectiveDeliveryMode(
      link.delivery_mode,
      defaultDeliveryModeByChannel.get(effectiveChannelId) ?? "direct_redirect",
    );

    runtime.shortLinkCount += 1;
    if (effectiveDeliveryMode === "landing_page") {
      runtime.landingLinkCount += 1;
    } else {
      runtime.directLinkCount += 1;
    }

    if (link.delivery_mode === "inherit_channel") {
      runtime.inheritedLinkCount += 1;
    } else {
      runtime.overrideLinkCount += 1;
    }
  }

  return channels.map((channel) => ({
    ...channel,
    runtime: runtimeByChannel.get(channel.id) ?? createRuntimeSummary(),
  }));
}

export async function listSalesChannelsWithRuntime(accountId: string): Promise<SalesChannelRuntimeRow[]> {
  const channels = await listSalesChannels(accountId);

  const [ordersResult, shortLinksResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, sales_channel_id")
      .eq("account_id", accountId)
      .is("deleted_at", null),
    supabase
      .from("short_links")
      .select("id, order_id, sales_channel_id, delivery_mode")
      .eq("account_id", accountId)
      .is("deleted_at", null),
  ]);

  const orders = ordersResult.error ? [] : (ordersResult.data ?? []);
  const shortLinks = shortLinksResult.error ? [] : (shortLinksResult.data ?? []);

  return buildSalesChannelRuntimeRows(
    channels,
    orders as SalesChannelRuntimeOrderRow[],
    shortLinks as SalesChannelRuntimeShortLinkRow[],
  );
}
