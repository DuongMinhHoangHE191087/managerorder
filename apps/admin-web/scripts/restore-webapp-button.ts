import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || process.env.NEXT_PUBLIC_APP_URL
  || 'https://duongminhhoang.id.vn';

async function run() {
  if (!BOT_TOKEN) return;
  // Set Chat Menu Button back to 'web_app'
  const menuResult = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: '🌐 Mở Web App',
        web_app: { url: SITE_URL },
      }
    }),
  });
  console.log('Restored Web App Button:', await menuResult.json());
}
run();
