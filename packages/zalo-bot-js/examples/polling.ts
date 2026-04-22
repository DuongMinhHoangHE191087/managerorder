import { Bot } from "../src";

async function main() {
  const token = process.env.ZALO_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing ZALO_BOT_TOKEN");
  }

  const bot = new Bot({ token });

  bot.on("message", async (message) => {
    console.log("Received message:", message.text ?? message.messageId);
  });

  bot.on("text", async (message) => {
    if (message.text === "hello") {
      await bot.sendMessage(message.chat.id, "Xin chao! Toi da nhan duoc loi chao cua ban.");
      return;
    }

    if (message.text && !message.text.startsWith("/")) {
      await bot.sendMessage(message.chat.id, `Ban vua noi: ${message.text}`);
    }
  });

  bot.onText(/\/start(?:\s+(.+))?/, async (message, match) => {
    const payload = match[1]?.trim();
    await bot.sendMessage(
      message.chat.id,
      payload ? `Chao ${payload}! Toi la bot Zalo viet bang TypeScript.` : "Chao ban!",
    );
  });

  bot.onText(/\/ping/, async (message) => {
    await bot.sendMessage(message.chat.id, "pong");
  });

  bot.onText(/\/help/, async (message) => {
    await bot.sendMessage(
      message.chat.id,
      "Thu lenh nay:\n/start\n/ping\n/help\nHoac gui hello de test text handler.",
    );
  });

  bot.command("photos", async (message) => {
    await bot.sendPhotos(
      message.chat.id,
      [
        "https://example.com/photo-1.jpg",
        "https://example.com/photo-2.jpg",
      ],
      "Album fallback from SDK",
    );
  });

  await bot.startPolling();
}

void main();
