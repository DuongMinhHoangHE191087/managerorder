import { loadLocalEnv } from "./load-local-env";
import { pathToFileURL } from "node:url";

loadLocalEnv();

export const FIXTURE_MARKER = "BOT-LIVE-FIXTURE";

export const FIXTURE_IDS = {
  customerId: "7b9d1c51-19e0-4f36-9f81-2d1d9cb67011",
  productId: "7b9d1c51-19e0-4f36-9f81-2d1d9cb67012",
  orderId: "7b9d1c51-19e0-4f36-9f81-2d1d9cb67013",
  customerPhoneContactId: "7b9d1c51-19e0-4f36-9f81-2d1d9cb67014",
  customerZaloContactId: "7b9d1c51-19e0-4f36-9f81-2d1d9cb67015",
} as const;

export type BotLiveFixtureSummary = {
  marker: string;
  accountId: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  orderId: string;
  orderCode: string;
  lookupPhone: string;
  expiresAt: string;
  telegramContactId: string | null;
  zaloContactId: string | null;
  reminderReady: boolean;
};

function isDirectExecution(importMetaUrl: string) {
  const entry = process.argv[1];
  return Boolean(entry) && pathToFileURL(entry).href === importMetaUrl;
}

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function importSupabaseAdmin() {
  const supabaseAdminModule = await import("../src/lib/supabase/admin");
  return supabaseAdminModule.supabaseAdmin;
}

async function importBotContactHelpers() {
  return await import("../src/lib/bot-manager/bot-contacts");
}

export async function ensureBotLiveFixtures(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BotLiveFixtureSummary> {
  const accountId =
    env.NEXT_PUBLIC_TEST_ACCOUNT_ID?.trim() ||
    env.TELEGRAM_BOT_ACCOUNT_ID?.trim() ||
    env.ACCOUNT_ID?.trim();

  if (!accountId) {
    throw new Error("Thiếu NEXT_PUBLIC_TEST_ACCOUNT_ID / TELEGRAM_BOT_ACCOUNT_ID / ACCOUNT_ID.");
  }

  const telegramChatId =
    env.TELEGRAM_ADMIN_CHAT_ID?.trim() ||
    env.TELEGRAM_CHAT_ID?.trim() ||
    null;
  const zaloAdminId =
    (env.ADMIN_ZALO_USER_IDS ?? "")
      .split(/[,\n;]/)
      .map((value) => value.trim())
      .find(Boolean) ?? null;

  const customerName = `${FIXTURE_MARKER} Customer`;
  const productName = `${FIXTURE_MARKER} Lookup Plan`;
  const orderCode = `${FIXTURE_MARKER}-ORDER`;
  const lookupPhone = "0901234567";
  const expiresAt = plusDays(3);
  const nowIso = new Date().toISOString();
  const supabaseAdmin = await importSupabaseAdmin();
  const { upsertBotUserContact, updateBotUserContact } =
    await importBotContactHelpers();

  const customerPayload = {
    id: FIXTURE_IDS.customerId,
    account_id: accountId,
    full_name: customerName,
    type: "retail" as const,
    phone: lookupPhone,
    email: "bot-live-fixture@managerorder.local",
    notes: `${FIXTURE_MARKER} customer for bot lookup/matching/reminder verification`,
    reliability_score: 90,
    debt_amount_vnd: 0,
    debt_overdue_days: 0,
    segment: "regular",
    deleted_at: null,
    updated_at: nowIso,
  };

  const productPayload = {
    id: FIXTURE_IDS.productId,
    account_id: accountId,
    name: productName,
    mode: "slot" as const,
    duration_type: "months" as const,
    duration_value: 1,
    buy_price_vnd: 99000,
    sell_price_vnd: 159000,
    description: `${FIXTURE_MARKER} product for bot lookup verification`,
    is_active: true,
    deleted_at: null,
    updated_at: nowIso,
  };

  const orderPayload = {
    id: FIXTURE_IDS.orderId,
    account_id: accountId,
    order_code: orderCode,
    customer_id: FIXTURE_IDS.customerId,
    product_id: FIXTURE_IDS.productId,
    quantity: 1,
    unit_price_vnd: 159000,
    product_name_snapshot: productName,
    cost_price_vnd: 99000,
    total_cost_vnd: 99000,
    total_amount_vnd: 159000,
    total_paid: 0,
    payment_method: null,
    payment_terms: "credit" as const,
    payment_source_id: null,
    sales_channel_id: null,
    status: "active" as const,
    contact_snapshot: lookupPhone,
    proof_image_urls: null,
    sales_note: `${FIXTURE_MARKER} order for bot lookup and reminder verification`,
    deleted_at: null,
    updated_at: nowIso,
    expires_at: expiresAt,
    invoice_snapshot: null,
    billing_details: null,
  };

  const phoneContactPayload = {
    id: FIXTURE_IDS.customerPhoneContactId,
    customer_id: FIXTURE_IDS.customerId,
    channel: "phone" as const,
    value: lookupPhone,
    is_verified: true,
  };

  const zaloContactPayload = {
    id: FIXTURE_IDS.customerZaloContactId,
    customer_id: FIXTURE_IDS.customerId,
    channel: "zalo" as const,
    value: zaloAdminId ?? lookupPhone,
    is_verified: true,
  };

  const { error: customerError } = await supabaseAdmin
    .from("customers")
    .upsert(customerPayload)
    .select("id")
    .single();

  if (customerError) {
    throw new Error(`Seed customer failed: ${customerError.message}`);
  }

  const { error: productError } = await supabaseAdmin
    .from("products")
    .upsert(productPayload)
    .select("id")
    .single();

  if (productError) {
    throw new Error(`Seed product failed: ${productError.message}`);
  }

  const { error: orderError } = await supabaseAdmin
    .from("orders")
    .upsert(orderPayload)
    .select("id")
    .single();

  if (orderError) {
    throw new Error(`Seed order failed: ${orderError.message}`);
  }

  const { error: phoneContactError } = await supabaseAdmin
    .from("customer_contacts")
    .upsert(phoneContactPayload)
    .select("id")
    .single();

  if (phoneContactError) {
    throw new Error(`Seed phone contact failed: ${phoneContactError.message}`);
  }

  if (zaloAdminId) {
    const { error: zaloContactError } = await supabaseAdmin
      .from("customer_contacts")
      .upsert(zaloContactPayload)
      .select("id")
      .single();

    if (zaloContactError) {
      throw new Error(`Seed Zalo contact failed: ${zaloContactError.message}`);
    }
  }

  let telegramContactId: string | null = null;
  if (telegramChatId) {
    const telegramContact = await upsertBotUserContact({
      accountId,
      channel: "telegram",
      externalUserId: telegramChatId,
      chatId: telegramChatId,
      displayName: "Telegram Admin Live Fixture",
      username: "telegram-live-fixture",
      phone: lookupPhone,
      lastMessageText: `${FIXTURE_MARKER} telegram contact`,
      metadata: {
        marker: FIXTURE_MARKER,
        seededBy: "check-bots-live",
      },
    });

    const updatedTelegramContact = await updateBotUserContact(
      accountId,
      telegramContact.id,
      {
        customerId: FIXTURE_IDS.customerId,
        autoReminderEnabled: true,
      },
    );

    telegramContactId = updatedTelegramContact.id;
  }

  let zaloContactId: string | null = null;
  if (zaloAdminId) {
    const zaloContact = await upsertBotUserContact({
      accountId,
      channel: "zalo",
      externalUserId: zaloAdminId,
      chatId: zaloAdminId,
      displayName: "Zalo Admin Live Fixture",
      username: "zalo-live-fixture",
      phone: lookupPhone,
      lastMessageText: `${FIXTURE_MARKER} zalo contact`,
      metadata: {
        marker: FIXTURE_MARKER,
        seededBy: "check-bots-live",
      },
    });

    const updatedZaloContact = await updateBotUserContact(
      accountId,
      zaloContact.id,
      {
        customerId: FIXTURE_IDS.customerId,
        autoReminderEnabled: true,
      },
    );

    zaloContactId = updatedZaloContact.id;
  }

  return {
    marker: FIXTURE_MARKER,
    accountId,
    customerId: FIXTURE_IDS.customerId,
    customerName,
    productId: FIXTURE_IDS.productId,
    productName,
    orderId: FIXTURE_IDS.orderId,
    orderCode,
    lookupPhone,
    expiresAt,
    telegramContactId,
    zaloContactId,
    reminderReady: Boolean(zaloContactId),
  };
}

if (isDirectExecution(import.meta.url)) {
  ensureBotLiveFixtures()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error("[seed-bot-live-fixtures]", error);
      process.exit(1);
    });
}
