import dotenv from "dotenv";
dotenv.config();

const projectRef = process.env.SUPABASE_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

async function run() {
  const query = `
    ALTER TABLE public.reminder_config ADD COLUMN IF NOT EXISTS telegram_notifications_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.reminder_config ADD COLUMN IF NOT EXISTS webhook_notifications_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.reminder_config ADD COLUMN IF NOT EXISTS template_share_link TEXT DEFAULT 'Xin chào {customer_name}, đây là liên kết nhận tài khoản {product_name} của bạn: {share_link}';
    ALTER TABLE public.reminder_config ADD COLUMN IF NOT EXISTS template_share_account TEXT DEFAULT 'Thông tin tài khoản {product_name} của bạn:\nEmail: {email}\nMật khẩu: {password}\n2FA: {totp_code}';
  `;

  console.log("Adding notification toggle columns to reminder_config...");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      read_only: false
    })
  });

  if (!res.ok) {
    console.error("Error status:", res.status);
    const text = await res.text();
    console.error("Error body:", text);
    return;
  }

  const data = await res.json();
  console.log("Success! Result:", data);
}

run().catch(console.error);
