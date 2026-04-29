import { loadLocalEnv } from "./load-local-env";
import { FIXTURE_IDS, FIXTURE_MARKER } from "./bot-live-fixtures";
import { pathToFileURL } from "node:url";

loadLocalEnv();

export type BotLiveFixtureCleanupSummary = {
  marker: string;
  accountId: string;
  removed: {
    botUserContacts: number;
    customerContacts: number;
    orders: number;
    products: number;
    customers: number;
  };
};

function isDirectExecution(importMetaUrl: string) {
  const entry = process.argv[1];
  return Boolean(entry) && pathToFileURL(entry).href === importMetaUrl;
}

async function importSupabaseAdmin() {
  const supabaseAdminModule = await import("../src/lib/supabase/admin");
  return supabaseAdminModule.supabaseAdmin;
}

function resolveAccountId(env: NodeJS.ProcessEnv = process.env) {
  const accountId =
    env.NEXT_PUBLIC_TEST_ACCOUNT_ID?.trim() ||
    env.TELEGRAM_BOT_ACCOUNT_ID?.trim() ||
    env.ACCOUNT_ID?.trim();

  if (!accountId) {
    throw new Error("Thiếu NEXT_PUBLIC_TEST_ACCOUNT_ID / TELEGRAM_BOT_ACCOUNT_ID / ACCOUNT_ID.");
  }

  return accountId;
}

async function deleteByIds(
  table: string,
  column: string,
  values: string[],
) {
  if (values.length === 0) {
    return 0;
  }

  const supabaseAdmin = await importSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from(table)
    .delete()
    .in(column, values)
    .select(column);

  if (error) {
    throw new Error(`Cleanup ${table} failed: ${error.message}`);
  }

  return Array.isArray(data) ? data.length : 0;
}

export async function cleanupBotLiveFixtures(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BotLiveFixtureCleanupSummary> {
  const accountId = resolveAccountId(env);
  const supabaseAdmin = await importSupabaseAdmin();

  const { data: botContactRows, error: botContactQueryError } = await supabaseAdmin
    .from("bot_user_contacts")
    .select("id")
    .eq("account_id", accountId)
    .eq("metadata->>marker", FIXTURE_MARKER);

  if (botContactQueryError) {
    throw new Error(`Query bot_user_contacts cleanup failed: ${botContactQueryError.message}`);
  }

  const botUserContactIds = Array.isArray(botContactRows)
    ? botContactRows
        .map((row) => (typeof row.id === "string" ? row.id : null))
        .filter((value): value is string => Boolean(value))
    : [];

  const removedBotUserContacts = await deleteByIds("bot_user_contacts", "id", botUserContactIds);
  const removedCustomerContacts = await deleteByIds("customer_contacts", "id", [
    FIXTURE_IDS.customerPhoneContactId,
    FIXTURE_IDS.customerZaloContactId,
  ]);
  const removedOrders = await deleteByIds("orders", "id", [FIXTURE_IDS.orderId]);
  const removedProducts = await deleteByIds("products", "id", [FIXTURE_IDS.productId]);
  const removedCustomers = await deleteByIds("customers", "id", [FIXTURE_IDS.customerId]);

  return {
    marker: FIXTURE_MARKER,
    accountId,
    removed: {
      botUserContacts: removedBotUserContacts,
      customerContacts: removedCustomerContacts,
      orders: removedOrders,
      products: removedProducts,
      customers: removedCustomers,
    },
  };
}

if (isDirectExecution(import.meta.url)) {
  cleanupBotLiveFixtures()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error("[cleanup-bot-live-fixtures]", error);
      process.exit(1);
    });
}
