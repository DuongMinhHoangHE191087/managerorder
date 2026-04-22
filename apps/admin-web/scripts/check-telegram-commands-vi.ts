import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

async function run() {
  if (!BOT_TOKEN) return;
  
  const res3 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language_code: 'vi' }),
  });
  const data3 = await res3.json();
  console.log('VI Language Scope:', JSON.stringify(data3, null, 2));

  // Let's also just try to DELETE all commands for 'vi' language entirely to force default
  const resDel = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language_code: 'vi' }),
  });
  console.log('Delete VI commands:', await resDel.json());
}

run();
