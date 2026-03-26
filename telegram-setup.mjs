// Quick Telegram Bot setup script v9.5
// Registers commands, menu button, description directly via Telegram API

const BOT_TOKEN = '8626655358:AAE-IW_4XBbBClSdXRsdjvHm2nAUO0Cw12M';
const SITE_URL = 'https://duongminhhoang.id.vn';

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(`${method}:`, data.ok ? '✅' : '❌', data.description || '');
  return data;
}

async function main() {
  console.log('🚀 Setting up Telegram Bot v9.5...\n');

  // 1. Set commands (updated with /newcustomer + /search + /active_accounts)
  await api('setMyCommands', {
    commands: [
      { command: 'start', description: '🏠 Menu chính + Dashboard' },
      { command: 'stats', description: '📊 Thống kê + Doanh thu' },
      { command: 'summary', description: '📊 Báo cáo cuối ngày' },
      { command: 'orders', description: '📦 Menu đơn hàng' },
      { command: 'today', description: '📋 Đơn hôm nay' },
      { command: 'expiring', description: '⏰ Đơn sắp hết hạn' },
      { command: 'find', description: '🔍 Tìm kiếm thông minh' },
      { command: 'search', description: '🔍 Tìm kiếm chuyên sâu' },
      { command: 'detail', description: '📄 Chi tiết đơn hàng' },
      { command: 'kho', description: '📦 Kho hàng interactive' },
      { command: 'warehouse', description: '📊 Thống kê kho tổng hợp' },
      { command: 'creds', description: '🔐 Credentials kho' },
      { command: 'active_accounts', description: '🟢 Kho còn hạn' },
      { command: 'products', description: '🏷 Danh sách sản phẩm' },
      { command: 'customer', description: '👤 Hồ sơ khách hàng' },
      { command: 'newcustomer', description: '👤 Tạo khách hàng mới' },
      { command: 'debt', description: '💳 Danh sách nợ / thu nợ' },
      { command: 'neworder', description: '➕ Tạo đơn hàng mới' },
      { command: 'allocate', description: '🔗 Gán kho cho đơn' },
      { command: 'newtask', description: '📝 Tạo task / lịch hẹn' },
      { command: 'newproduct', description: '🏷 Tạo sản phẩm mới' },
      { command: 'newkho', description: '📦 Tạo kho hàng mới' },
      { command: 'tasks', description: '📋 Danh sách tasks' },
      { command: 'duolingo', description: '🦉 Tra cứu Duolingo' },
      { command: 'fbid', description: '📘 Lấy Facebook ID' },
      { command: 'security', description: '🔒 Trạng thái bảo mật' },
      { command: 'help', description: '❓ Hướng dẫn sử dụng' },
      { command: 'cancel', description: '❌ Hủy thao tác hiện tại' },
    ]
  });

  // 2. Set menu button (WebApp)
  await api('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🌐 Mở Web App',
      web_app: { url: SITE_URL },
    },
  });

  // 3. Set bot description
  await api('setMyDescription', {
    description: '🤖 ManagerOrder Bot v9.5 — Quản lý đơn hàng, kho hàng, khách hàng và tài chính. Truy cập nhanh mọi dữ liệu qua Telegram.',
  });

  // 4. Set short description
  await api('setMyShortDescription', {
    short_description: '📦 Quản lý đơn hàng & kho hàng thông minh v9.5',
  });

  // 5. Set webhook to production
  await api('setWebhook', {
    url: `${SITE_URL}/api/telegram/webhook`,
    max_connections: 40,
    allowed_updates: ['message', 'callback_query'],
    secret_token: '1654c93ec5d64b5b9817906b1cd35e95d6682280594c459a91d481e7706fbd83',
  });

  // 6. Check result
  const info = await api('getWebhookInfo', {});
  console.log('\n📋 Webhook Info:', JSON.stringify(info.result, null, 2));
  console.log('\n✅ Done! Bot v9.5 is configured for', SITE_URL);
}

main().catch(console.error);
