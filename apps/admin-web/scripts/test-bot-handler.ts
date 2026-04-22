// Quick test - simulate handleBotUpdate flow for /start
/* eslint-disable @typescript-eslint/no-explicit-any */
// Run: npx tsx scripts/test-bot-handler.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID!;
const TEST_ACCOUNT_ID = process.env.NEXT_PUBLIC_TEST_ACCOUNT_ID!;

console.log('=== ENV CHECK ===');
console.log('BOT_TOKEN:', BOT_TOKEN ? BOT_TOKEN.slice(0, 10) + '...' : 'NOT SET');
console.log('ADMIN_CHAT_ID:', ADMIN_CHAT_ID);
console.log('TEST_ACCOUNT_ID:', TEST_ACCOUNT_ID);

// Test: send a message directly via Telegram API
async function testSendMessage() {
  console.log('\n=== TEST: Send direct message ===');
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: ADMIN_CHAT_ID,
    text: '<b>🧪 Test message</b>\nDirect send from test script.',
    parse_mode: 'HTML',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log('Response status:', res.status);
    console.log('Response body:', JSON.stringify(data, null, 2));
    return data.ok;
  } catch (err) {
    console.error('Error:', err);
    return false;
  }
}

// Test: import and call handleBotUpdate
async function testHandleBotUpdate() {
  console.log('\n=== TEST: handleBotUpdate(/start) ===');
  
  // Dynamic import to load the service
  try {
    const { handleBotUpdate } = await import('../src/lib/services/telegram-bot.service');
    
    const fakeUpdate = {
      update_id: 99999,
      message: {
        message_id: 999,
        from: { id: Number(ADMIN_CHAT_ID), is_bot: false, first_name: 'Admin' },
        chat: { id: Number(ADMIN_CHAT_ID), type: 'private' },
        text: '/start',
        date: Math.floor(Date.now() / 1000),
      },
    };

    await handleBotUpdate(fakeUpdate as any);
    console.log('✅ handleBotUpdate completed successfully');
  } catch (err) {
    console.error('❌ handleBotUpdate FAILED:', err);
  }
}

async function main() {
  // Test 1: Direct send
  const directOk = await testSendMessage();
  console.log('\nDirect send result:', directOk ? '✅ OK' : '❌ FAILED');

  // Test 2: handleBotUpdate
  await testHandleBotUpdate();
}

main().catch(console.error);
