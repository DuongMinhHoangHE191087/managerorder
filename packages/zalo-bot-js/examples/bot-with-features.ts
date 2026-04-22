/**
 * Ví dụ tích hợp BotFeatureHandler vào Zalo Bot thực tế
 * File này là EXAMPLE - copy và tích hợp vào entry point chính của bạn
 */

import { createClient } from "@supabase/supabase-js";
import { Bot } from "../src/core/Bot";
import { BotFeatureHandler } from "../src/handlers/BotFeatureHandler";

async function main() {
  // ── 1. Khởi tạo Supabase client ──────────────────────
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── 2. Khởi tạo Bot ───────────────────────────────────
  const botToken = process.env.ZALO_BOT_TOKEN ?? "";
  if (!botToken) throw new Error("Missing ZALO_BOT_TOKEN in .env");

  const bot = new Bot(botToken);

  // ── 3. Đăng ký tất cả features ───────────────────────
  const features = new BotFeatureHandler({
    bot,
    supabase,
    accountId: process.env.ACCOUNT_ID ?? "default",
    geminiApiKey: process.env.GEMINI_API_TOKEN ?? "",
    geminiModelName: "gemini-2.5-flash",
    rateLimitPerDay: 3, // 3 lượt tra cứu đơn hàng / ngày / Zalo ID
  });

  features.register();

  // ── 4. Khởi động bot ──────────────────────────────────
  await bot.initialize();
  console.log("✅ Bot started with AI features enabled");

  // Polling hoặc Webhook tùy cấu hình
  // await bot.startPolling();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
