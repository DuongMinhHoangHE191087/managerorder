import { config as loadEnv } from "dotenv";
import { Bot } from "../src";

async function main() {
  loadEnv();

  const token = process.env.ZALO_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing ZALO_BOT_TOKEN");
  }

  const bot = new Bot({ token });

  bot.on("message", (message) => {
    console.log("-----------------------------------------");
    console.log(`[!] NHẬN ĐƯỢC TIN NHẮN TỪ: ${message.fromUser?.displayName || "Ẩn danh"}`);
    console.log(`[!] CHAT ID: ${message.chat.id}`);
    console.log(`[!] NỘI DUNG: ${message.text || "(Không phải text)"}`);
    console.log("-----------------------------------------");
  });

  console.log(">>> Đang lắng nghe tin nhắn để lấy ID... <<<");
  await bot.startPolling();
}

void main().catch(console.error);
