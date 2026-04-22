#!/usr/bin/env npx tsx
// ============================================================
// WEBHOOK SETUP SCRIPT — Run manually to register webhook
// ============================================================
// Usage: npx tsx scripts/setup-webhook.ts
// 
// This script sets the Telegram webhook URL with secret_token.
// Run after deploy to ensure webhook is correctly configured.
// ============================================================

import { config } from 'dotenv';
config({ path: '.env.local' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://celadon-vacherin-3723d0.netlify.app';
const WEBHOOK_URL = `${SITE_URL}/api/telegram/webhook`;

async function main() {
  console.log('🔧 Telegram Webhook Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (!BOT_TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN not set!'); process.exit(1); }
  if (!WEBHOOK_SECRET) { console.error('❌ TELEGRAM_WEBHOOK_SECRET not set!'); process.exit(1); }

  // 1. Check current webhook
  console.log('\n📊 Current webhook info:');
  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log(JSON.stringify(infoData.result, null, 2));

  const currentUrl = infoData.result?.url ?? '';
  if (currentUrl === WEBHOOK_URL) {
    console.log(`\n✅ Webhook already correct: ${WEBHOOK_URL}`);
    console.log('💡 To force re-register, run: npx tsx scripts/setup-webhook.ts --force');
    if (!process.argv.includes('--force')) return;
    console.log('⚡ Force mode: re-registering...');
  }

  // 2. Delete old webhook
  console.log('\n🗑️ Deleting old webhook...');
  const delRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, { method: 'POST' });
  const delData = await delRes.json();
  console.log('Delete result:', delData.ok ? '✅' : `❌ ${delData.description}`);

  // 3. Set new webhook with secret_token
  console.log(`\n📡 Setting webhook → ${WEBHOOK_URL}`);
  const setRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
      max_connections: 40,
    }),
  });
  const setData = await setRes.json();
  console.log('Set result:', setData.ok ? '✅ Webhook set!' : `❌ ${setData.description}`);

  // 4. Verify
  console.log('\n📊 Verify webhook:');
  const verRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const verData = await verRes.json();
  console.log(JSON.stringify(verData.result, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Done! Bot should now receive updates.');
}

main().catch(console.error);
