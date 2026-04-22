import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

async function run() {
  if (!BOT_TOKEN) {
    console.log('No BOT_TOKEN');
    return;
  }
  
  // Get default commands
  const res1 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMyCommands`);
  const data1 = await res1.json();
  console.log('Default Scope:', JSON.stringify(data1, null, 2));

  // Get all_private_chats commands
  const res2 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: { type: 'all_private_chats' } }),
  });
  const data2 = await res2.json();
  console.log('Private Chats Scope:', JSON.stringify(data2, null, 2));
}

run();
