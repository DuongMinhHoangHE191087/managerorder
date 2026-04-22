import type {
  BotCustomerMatchCandidate,
  BotUserContact,
  BotUserContactChannel,
} from "@/lib/domain/types";
import type { ContactInfo } from "@/lib/domain/types";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseAdmin } from "@/lib/supabase/admin";

type BotUserContactRow = Database["public"]["Tables"]["bot_user_contacts"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerContactRow = Database["public"]["Tables"]["customer_contacts"]["Row"];

const CONTACT_SEARCH_LIMIT = 100;
const CUSTOMER_MATCH_LIMIT = 8;

function normalizeText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizePhone(value?: string | null): string | null {
  const normalized = value?.replace(/\s+/g, "").trim();
  return normalized ? normalized : null;
}

function mapContactType(channel: string): ContactInfo["type"] {
  if (channel === "phone" || channel === "email" || channel === "zalo" || channel === "facebook" || channel === "telegram") {
    return channel;
  }
  return "other";
}

function mapBotUserContact(
  row: BotUserContactRow,
  customerName?: string | null,
): BotUserContact {
  return {
    id: row.id,
    accountId: row.account_id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    chatId: row.chat_id,
    displayName: row.display_name,
    username: row.username,
    phone: row.phone,
    customerId: row.customer_id,
    customerName: customerName ?? null,
    autoReminderEnabled: row.auto_reminder_enabled,
    lastInteractionAt: row.last_interaction_at,
    lastMessageText: row.last_message_text,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveCustomerNames(customerIds: string[]): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (customerIds.length === 0) return nameMap;

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, full_name")
    .in("id", customerIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as Array<Pick<CustomerRow, "id" | "full_name">>) {
    nameMap.set(row.id, row.full_name);
  }

  return nameMap;
}

export async function upsertBotUserContact(input: {
  accountId: string;
  channel: BotUserContactChannel;
  externalUserId: string;
  chatId?: string | null;
  displayName?: string | null;
  username?: string | null;
  phone?: string | null;
  lastMessageText?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<BotUserContact> {
  const row = {
    account_id: input.accountId,
    channel: input.channel,
    external_user_id: input.externalUserId.trim(),
    chat_id: normalizeText(input.chatId) ?? input.externalUserId.trim(),
    display_name: normalizeText(input.displayName),
    username: normalizeText(input.username),
    phone: normalizePhone(input.phone),
    last_message_text: normalizeText(input.lastMessageText),
    metadata: input.metadata ?? {},
    last_interaction_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("bot_user_contacts")
    .upsert(row, {
      onConflict: "account_id,channel,external_user_id",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapBotUserContact(data as BotUserContactRow);
}

export async function listBotUserContacts(
  accountId: string,
  options?: {
    channel?: BotUserContactChannel;
    search?: string;
    matched?: boolean;
    limit?: number;
  },
): Promise<BotUserContact[]> {
  let builder = supabaseAdmin
    .from("bot_user_contacts")
    .select("*")
    .eq("account_id", accountId)
    .order("last_interaction_at", { ascending: false })
    .limit(Math.min(options?.limit ?? CONTACT_SEARCH_LIMIT, CONTACT_SEARCH_LIMIT));

  if (options?.channel) {
    builder = builder.eq("channel", options.channel);
  }

  if (options?.matched === true) {
    builder = builder.not("customer_id", "is", null);
  } else if (options?.matched === false) {
    builder = builder.is("customer_id", null);
  }

  const search = options?.search?.trim();
  if (search) {
    const safe = search.replace(/[%_]/g, "");
    builder = builder.or(
      `display_name.ilike.%${safe}%,external_user_id.ilike.%${safe}%,chat_id.ilike.%${safe}%,phone.ilike.%${safe}%`,
    );
  }

  const { data, error } = await builder;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as BotUserContactRow[];
  const customerIds = rows.map((row) => row.customer_id).filter(Boolean) as string[];
  const customerNames = await resolveCustomerNames(customerIds);

  return rows.map((row) => mapBotUserContact(row, row.customer_id ? customerNames.get(row.customer_id) : null));
}

export async function updateBotUserContact(
  accountId: string,
  contactId: string,
  updates: {
    customerId?: string | null;
    autoReminderEnabled?: boolean;
  },
): Promise<BotUserContact> {
  const payload: Database["public"]["Tables"]["bot_user_contacts"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if ("customerId" in updates) {
    payload.customer_id = updates.customerId ?? null;
  }
  if ("autoReminderEnabled" in updates) {
    payload.auto_reminder_enabled = Boolean(updates.autoReminderEnabled);
  }

  const { data, error } = await supabaseAdmin
    .from("bot_user_contacts")
    .update(payload)
    .eq("account_id", accountId)
    .eq("id", contactId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const customerNames = await resolveCustomerNames(data.customer_id ? [data.customer_id] : []);
  return mapBotUserContact(
    data as BotUserContactRow,
    data.customer_id ? customerNames.get(data.customer_id) : null,
  );
}

export async function findBotCustomerMatchCandidates(
  accountId: string,
  query: string,
): Promise<BotCustomerMatchCandidate[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const customerIds = new Set<string>();
  const safe = normalized.replace(/[%_]/g, "");

  const [{ data: customerMatches, error: customerError }, { data: contactMatches, error: contactError }] =
    await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("id")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .ilike("full_name", `%${safe}%`)
        .limit(CUSTOMER_MATCH_LIMIT),
      supabaseAdmin
        .from("customer_contacts")
        .select("customer_id")
        .ilike("value", `%${safe}%`)
        .limit(CUSTOMER_MATCH_LIMIT * 2),
    ]);

  if (customerError) {
    throw new Error(customerError.message);
  }
  if (contactError) {
    throw new Error(contactError.message);
  }

  for (const row of customerMatches ?? []) {
    customerIds.add(row.id);
  }
  for (const row of contactMatches ?? []) {
    if (row.customer_id) customerIds.add(row.customer_id);
  }

  if (customerIds.size === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, customer_contacts(channel, value)")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .in("id", Array.from(customerIds))
    .limit(CUSTOMER_MATCH_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name,
    contacts: ((row.customer_contacts ?? []) as CustomerContactRow[]).map((contact) => ({
      type: mapContactType(contact.channel),
      value: contact.value,
    })),
  }));
}

export async function listCustomerZaloReminderTargets(
  accountId: string,
  customerId: string,
): Promise<BotUserContact[]> {
  const { data, error } = await supabaseAdmin
    .from("bot_user_contacts")
    .select("*")
    .eq("account_id", accountId)
    .eq("channel", "zalo")
    .eq("customer_id", customerId)
    .eq("auto_reminder_enabled", true)
    .not("chat_id", "is", null)
    .order("last_interaction_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as BotUserContactRow[]).map((row) => mapBotUserContact(row));
}
