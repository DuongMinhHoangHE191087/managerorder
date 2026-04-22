// ============================================================
// TELEGRAM BOT POLLING — MODERN RELAY ARCHITECTURE
// This script replaces the legacy 3000-line monolith.
// It acts solely as a relay: polling Telegram and delegating
// updates to the exact same BotRouter used by the Webhook.
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { loadLocalEnv } from "./load-local-env";
import {
  markBotRuntimeError,
  markBotRuntimeHeartbeat,
  markBotRuntimeInbound,
  markBotRuntimeStarted,
} from "../src/lib/bot-manager/runtime-health";

loadLocalEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not defined in .env.local');
  process.exit(1);
}

// 2. Import the robust BotRouter dynamically to avoid ESM hoisting
let bot: any;

// 3. Polling Logic
let updateOffset = 0;
let isPolling = true;

async function deleteWebhook() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`);
    const data = await res.json();
    if (data.ok) {
      console.log('✅ Webhook deleted to enable long polling.');
    }
  } catch (error) {
    console.error('❌ Failed to delete webhook:', error);
  }
}

async function fetchUpdates() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset: updateOffset,
        timeout: 30, // 30 seconds HTTP long-polling
        allowed_updates: ['message', 'callback_query']
      }),
      signal: AbortSignal.timeout(35000) // Slightly longer than Telegram timeout
    });

    if (!res.ok) {
      if (res.status === 409) {
        console.error('❌ Conflict: Another instance or webhook is running! Please stop other bots.');
        await markBotRuntimeError("telegram", new Error("Telegram polling conflict (409)"), {
          status: 409,
        });
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    await markBotRuntimeHeartbeat("telegram", {
      transport: "polling",
      configuredMode: "polling",
      metadata: {
        updateOffset,
        resultCount: Array.isArray(data?.result) ? data.result.length : 0,
      },
    });
    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        updateOffset = update.update_id + 1;
        await markBotRuntimeInbound("telegram", {
          updateId: update.update_id,
          updateType: update.message ? "message" : update.callback_query ? "callback_query" : "other",
        });
        // Delegate perfectly to the same router logic as webhook
        try {
          await bot.processUpdate(update);
        } catch (botErr) {
          console.error(`[Router Error] Processing update ${update.update_id}:`, botErr);
          await markBotRuntimeError("telegram", botErr, { updateId: update.update_id });
        }
      }
    }
  } catch (error: any) {
    if (error.name !== 'TimeoutError' && error.name !== 'AbortError') {
      console.error('⚠️ Polling error:', error.message);
      await markBotRuntimeError("telegram", error, { stage: "fetchUpdates" });
    }
    // Simple backoff
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function startPolling() {
  console.log('🚀 Starting Telegram Bot (Polling Relay Mode)...');
  await markBotRuntimeStarted({
    channel: "telegram",
    transport: "polling",
    configuredMode: "polling",
    metadata: {
      script: "telegram-bot-poll",
    },
  });
  
  try {
    const telegramModule = await import('@/integrations/telegram');
    bot = telegramModule.bot;
  } catch (e) {
    console.error('❌ Failed to load bot router:', e);
    process.exit(1);
  }

  await deleteWebhook();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    isPolling = false;
    console.log('\n🛑 Stopping bot gracefully...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    isPolling = false;
    process.exit(0);
  });

  while (isPolling) {
    await fetchUpdates();
  }
}

startPolling().catch(err => {
  console.error('❌ Critical startup error:', err);
  void markBotRuntimeError("telegram", err, { stage: "startup" });
  process.exit(1);
});
