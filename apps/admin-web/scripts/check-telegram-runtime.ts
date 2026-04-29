import assert from "node:assert/strict";
import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

async function main() {
  const { bot } = await import("../src/lib/telegram/index");
  const legacy = await import("../src/lib/services/telegram-bot.service");

  const snapshot = bot.getDebugSnapshot();

  assert(snapshot.middlewareCount >= 5, `Expected Telegram middleware chain, received ${snapshot.middlewareCount}`);
  assert(snapshot.hasFallback, "Telegram bot router is missing a fallback handler");
  assert(typeof legacy.handleBotUpdate === "function", "Legacy Telegram handler is unavailable");
  assert(typeof legacy.hasLegacySession === "function", "Legacy Telegram session bridge is unavailable");

  const requiredCommands = [
    "start",
    "stats",
    "summary",
    "help",
    "orders",
    "today",
    "expiring",
    "search",
    "customer",
    "kh",
    "debt",
    "no",
    "kho",
    "warehouse",
    "inventory",
    "duolingo",
    "fbid",
    "products",
    "security",
    "creds",
    "active_accounts",
    "tasks",
    "shortlinks",
    "newlink",
    "cancel",
  ];

  for (const command of requiredCommands) {
    assert(snapshot.commands.includes(command), `Missing Telegram command handler: ${command}`);
  }

  const requiredActions = [
    "cmd:start",
    "cmd:stats",
    "cmd:summary",
    "cmd:search",
    "cmd:orders",
    "orders:today",
    "orders:expiring",
    "orders:expired",
    "cmd:kho",
    "kho:stats",
    "kho:slots",
    "kho:creds",
    "cmd:products",
    "cmd:shortlinks",
    "cmd:cancel",
    "noop",
  ];

  for (const action of requiredActions) {
    assert(snapshot.actions.includes(action), `Missing Telegram action handler: ${action}`);
  }

  const requiredActionPrefixes = [
    "orders:today",
    "orders:expiring",
    "orders:expired",
    "kho",
    "customer",
    "runcmd:customer",
    "cmd:debt",
    "products:page",
    "creds",
    "prodview",
    "credreveal",
    "tdone",
    "slpage",
    "slw",
    "sl",
    "cmd",
  ];

  for (const prefix of requiredActionPrefixes) {
    assert(snapshot.actionPrefixes.includes(prefix), `Missing Telegram action prefix handler: ${prefix}`);
  }

  const requiredTextHandlers = [
    "🛒 Sản phẩm",
    "📝 Tạo đơn",
    "📦 Đơn hàng",
    "ℹ️ Hỗ trợ",
    "💰 Doanh thu",
    "🔗 Shortlinks",
    "📦 Kho",
    "📋 Tasks",
  ];

  for (const text of requiredTextHandlers) {
    assert(snapshot.texts.includes(text), `Missing Telegram quick text handler: ${text}`);
  }

  console.log(
    `[check-telegram] Router smoke passed. commands=${snapshot.commands.length} actions=${snapshot.actions.length} prefixes=${snapshot.actionPrefixes.length} texts=${snapshot.texts.length}`,
  );

  process.exit(0);
}

main().catch((error) => {
  console.error("[check-telegram] Runtime handler smoke failed:", error);
  process.exit(1);
});
