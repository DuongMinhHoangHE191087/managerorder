import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Bot, ChatAction } from "./index";
import { BotFeatureHandler } from "./handlers/BotFeatureHandler";

/**
 * Zalo Bot Application Entry Point
 * Hợp nhất: Duolingo Lookup + Order Lookup + AI Vision + interactive sessions
 */
async function main() {
  console.log("🚀 Đang khởi khởi động Zalo Bot...");

  // 1. Kiểm tra cấu hình .env
  const ZALO_TOKEN = process.env.ZALO_BOT_TOKEN?.trim() || "";
  const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || "";
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY?.trim() || "";
  const GEMINI_KEY = (process.env.GEMINI_API_TOKEN || process.env.GEMINI_API_KEY)?.trim() || "";
  const ACCOUNT_ID = process.env.ACCOUNT_ID?.trim() || "default";

  if (!ZALO_TOKEN) {
    console.error("❌ LỖI: Thiếu ZALO_BOT_TOKEN trong file .env!");
    process.exit(1);
  }

  // 2. Khởi tạo Supabase (Tính năng tra cứu đơn hàng cần cái này)
  let supabase = null;
  if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_KEY.includes("your_service_role_key")) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("✅ Đã kết nối Supabase:", SUPABASE_URL);
    } catch (err) {
      console.error("⚠️ Cảnh báo: Không thể kết nối Supabase. Các tính năng Database sẽ bị vô hiệu hóa.");
    }
  } else {
    console.warn("⚠️ Cảnh báo: Thiếu SUPABASE_URL/KEY hoặc vẫn đang dùng key mặc định!");
  }

  // 3. Khởi tạo Bot instance
  const bot = new Bot(ZALO_TOKEN);

  // 4. Đăng ký Feature Handler (Tất cả logic /tracuu, /layduo, AI Vision ở đây)
  const features = new BotFeatureHandler({
    bot,
    supabase: supabase as any,
    accountId: ACCOUNT_ID,
    geminiApiKey: GEMINI_KEY,
    geminiModelName: "gemini-2.5-flash", // Flash cho tốc độ phản hồi nhanh
    rateLimitPerDay: 5,                  // Giới hạn 5 lượt tra cứu / ngày
  });

  features.register();

  // 5. Thêm logger đơn giản cho lỗi
  bot.onError((err, ctx) => {
    console.error(`[Bot Error] [${ctx.kind}:${ctx.source}]`, err);
  });

  // 6. Xử lý logic gỡ lỗi/trạng thái (Admin commands)
  const ADMIN_IDS = (process.env.ADMIN_ZALO_USER_IDS || "").split(",").map(id => id.trim());
  
  bot.command("status", async (message) => {
    if (!ADMIN_IDS.includes(message.chat.id)) return;
    
    const statusText = [
      "🤖 **Trạng thái hệ thống**",
      `• Database: ${supabase ? "✅ OK" : "❌ OFF"}`,
      `• AI Model: ${GEMINI_KEY ? "✅ OK" : "❌ OFF"}`,
      `• Account ID: \`${ACCOUNT_ID}\``,
      `• Sessions active: ${features["pendingSessions"].size}`,
    ].join("\n");
    
    await message.replyText(statusText);
  });

  // 7. Khởi chạy
  try {
    await bot.initialize();
    console.log("═══════════════════════════════════════════");
    console.log("✅ ZALO BOT ĐANG HOẠT ĐỘNG (POLLING MODE)");
    console.log("═══════════════════════════════════════════");
    console.log("Sẵn sàng nhận lệnh: /help, /layduolingoid, /tracuu...");
    
    void bot.startPolling();
  } catch (err) {
    console.error("❌ LỖI KHỞI CHẠY BOT:", err);
    process.exit(1);
  }
}

// Chạy main
main().catch(console.error);
