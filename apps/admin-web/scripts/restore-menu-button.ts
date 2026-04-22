import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

async function run() {
  if (!BOT_TOKEN) return;
  // Set Chat Menu Button back to 'commands'
  const menuResult = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: { type: 'commands' }
    }),
  });
  console.log('Restored Menu Button:', await menuResult.json());
}
run();
