import { config as loadEnv } from "dotenv";
import { Bot } from "../src";

async function main() {
  loadEnv();

  const token = process.env.ZALO_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing ZALO_BOT_TOKEN");
  }

  const bot = new Bot({ token });
  const targetId = "0a4b216ff6331f6d4622";
  const messageText = "Xin chào dương minh hoàng";

  console.log(`Đang gửi tin nhắn đến ID: ${targetId}...`);
  const result = await bot.sendMessage(targetId, messageText);
  console.log(`Đã gửi thành công! Message ID: ${result.messageId}`);
}

void main().catch(console.error);
