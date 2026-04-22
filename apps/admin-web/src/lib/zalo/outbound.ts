import { canStartZaloBot, resolveZaloRuntimeConfig } from "./config";
import { createZaloBot } from "./sdk";
import type { ZaloBotLike } from "./types";

let outboundBotPromise: Promise<ZaloBotLike | null> | null = null;

async function createOutboundBot(env: NodeJS.ProcessEnv): Promise<ZaloBotLike | null> {
  const config = resolveZaloRuntimeConfig(env);
  if (!canStartZaloBot(config)) {
    return null;
  }

  const bot = createZaloBot(config.botToken);
  await bot.initialize();
  return bot;
}

async function getOutboundBot(env: NodeJS.ProcessEnv = process.env): Promise<ZaloBotLike | null> {
  outboundBotPromise ??= createOutboundBot(env);
  return outboundBotPromise;
}

export async function sendZaloTextMessage(
  chatId: string,
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const bot = await getOutboundBot(env);
  if (!bot) {
    return false;
  }

  try {
    await bot.sendMessage(chatId, text);
    return true;
  } catch (error) {
    console.error("[Zalo] Failed to send outbound message:", error);
    return false;
  }
}
