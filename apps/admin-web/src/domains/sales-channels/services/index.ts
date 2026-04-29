import type {
  CreateSalesChannelInput,
  UpdateSalesChannelInput,
} from "@/lib/domain/schemas";
import type { SalesChannel } from "@/lib/domain/types";
import {
  createSalesChannel as createSalesChannelRepo,
  deleteSalesChannel as deleteSalesChannelRepo,
  getSalesChannelById as getSalesChannelByIdRepo,
  listSalesChannelsWithRuntime as listSalesChannelsWithRuntimeRepo,
  updateSalesChannel as updateSalesChannelRepo,
  type SalesChannelRuntimeRow,
  type SalesChannelRow,
} from "../repository";

function mapSalesChannel(row: SalesChannelRow | SalesChannelRuntimeRow): SalesChannel {
  const runtime = "runtime" in row ? row.runtime : undefined;
  return {
    id: row.id,
    name: row.name,
    defaultDeliveryMode: row.default_delivery_mode,
    defaultLandingTemplateKey: row.default_landing_template_key,
    defaultFailureTemplateKey: row.default_failure_template_key ?? "customer_offer_wall",
    sellerContactUrl: row.seller_contact_url ?? null,
    ...(runtime ? { runtime } : {}),
  };
}

export async function listSalesChannelsForAccount(accountId: string): Promise<SalesChannel[]> {
  const rows = await listSalesChannelsWithRuntimeRepo(accountId);
  return rows.map(mapSalesChannel);
}

export async function getSalesChannelForAccount(
  id: string,
  accountId: string,
): Promise<SalesChannel | null> {
  const row = await getSalesChannelByIdRepo(id, accountId);
  return row ? mapSalesChannel(row) : null;
}

export async function createSalesChannelForAccount(
  accountId: string,
  input: CreateSalesChannelInput,
): Promise<SalesChannel> {
  const row = await createSalesChannelRepo(accountId, input);
  return mapSalesChannel(row);
}

export async function updateSalesChannelForAccount(
  id: string,
  accountId: string,
  input: UpdateSalesChannelInput,
): Promise<SalesChannel> {
  const row = await updateSalesChannelRepo(id, accountId, input);
  return mapSalesChannel(row);
}

export async function deleteSalesChannelForAccount(id: string, accountId: string): Promise<void> {
  await deleteSalesChannelRepo(id, accountId);
}

export { mapSalesChannel };
