import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

const BOT_COMMANDS = [
  // ── Dashboard & Overview ──
  { command: 'start', description: '🏠 Menu chính + Dashboard' },
  { command: 'stats', description: '📊 Thống kê + Doanh thu' },
  { command: 'summary', description: '📊 Báo cáo cuối ngày' },

  // ── Orders ──
  { command: 'orders', description: '📦 Menu đơn hàng' },
  { command: 'today', description: '📋 Đơn hôm nay' },
  { command: 'expiring', description: '⏰ Đơn sắp hết hạn' },
  { command: 'find', description: '🔍 Tìm kiếm thông minh' },
  { command: 'detail', description: '📄 Chi tiết đơn hàng' },

  // ── Inventory ──
  { command: 'kho', description: '📦 Kho hàng interactive' },
  { command: 'warehouse', description: '📊 Thống kê kho tổng hợp' },
  { command: 'creds', description: '🔐 Credentials kho' },
  { command: 'inventory', description: '📧 Tra kho theo email' },
  { command: 'products', description: '🏷 Danh sách sản phẩm' },

  // ── Customers & Finance ──
  { command: 'customer', description: '👤 Hồ sơ khách hàng' },
  { command: 'debt', description: '💳 Danh sách nợ / thu nợ' },

  // ── Create (Wizards) ──
  { command: 'neworder', description: '➕ Tạo đơn hàng mới' },
  { command: 'allocate', description: '🔗 Gán kho cho đơn' },
  { command: 'newtask', description: '📝 Tạo task / lịch hẹn' },
  { command: 'newproduct', description: '🏷 Tạo sản phẩm mới' },
  { command: 'newkho', description: '📦 Tạo kho hàng mới' },
  { command: 'newcustomer', description: '👤 Tạo khách hàng mới' },

  // ── Utilities ──
  { command: 'tasks', description: '📋 Danh sách tasks' },
  { command: 'search', description: '🔍 Tìm kiếm chuyên sâu đơn hàng' },
  { command: 'active_accounts', description: '🟢 Tài khoản kho còn hạn' },
  { command: 'duolingo', description: '🦉 Tra cứu Duolingo' },
  { command: 'fbid', description: '📘 Lấy Facebook ID' },
  { command: 'security', description: '🔒 Trạng thái bảo mật' },
  { command: 'shortlinks', description: '🔗 Quản lý short links' },
  { command: 'newlink', description: '🔗 Tạo short link mới' },
  { command: 'help', description: '❓ Hướng dẫn sử dụng' },
  { command: 'cancel', description: '❌ Hủy thao tác hiện tại' },
];

async function run() {
  if (!BOT_TOKEN) {
    console.log('No BOT_TOKEN');
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: BOT_COMMANDS }),
  });
  const data = await res.json();
  console.log(data);
}

run();
