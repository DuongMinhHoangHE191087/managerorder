/**
 * ============================================================
 * ZALO BOT - COMPREHENSIVE TEST SERVER
 * ============================================================
 * Kết hợp tất cả tính năng trong 1 server duy nhất:
 *
 * BOT (Polling + Auto-Reply):
 *   - /start         → Màn hình chào + Menu keyboard
 *   - /help          → Danh sách lệnh
 *   - /ping          → Trả về "pong"
 *   - /info          → Lấy profile người dùng (SocialClient)
 *   - /friends       → Đếm số bạn bè (SocialClient)
 *   - /echo <text>   → Lặp lại tin nhắn
 *   - hello          → Chào hỏi
 *   - Tin khác       → Echo lại + typing indicator
 *
 * REST API (PORT 3001):
 *   - GET  /health              → Kiểm tra server
 *   - GET  /profile             → SocialClient: lấy profile
 *   - GET  /friends             → SocialClient: lấy bạn bè
 *   - POST /send-message        → Bot: gửi tin đến chatId bất kỳ
 *   - POST /zns                 → ZnsClient: gửi ZNS template
 *   - POST /zns/phone           → ZnsClient: gửi qua SĐT
 *   - POST /zns/userid          → ZnsClient: gửi qua User ID
 *   - POST /webhook             → Nhận Webhook từ Zalo (nếu có)
 *   - GET  /bot/status          → Trạng thái bot polling
 * ============================================================
 */

import "dotenv/config";
import express from "express";
import { Bot, ChatAction, SocialClient, ZnsClient } from "../src";
import * as fs from "fs";
import * as path from "path";

// ── Biến môi trường ───────────────────────────────────────────
const BOT_TOKEN     = process.env.ZALO_BOT_TOKEN?.trim();
const OA_TOKEN      = (process.env.ZALO_OA_TOKEN || process.env.OA_ACCESS_TOKEN || "")?.trim().replace(/^=\s*/, "");
const USER_TOKEN    = (process.env.USER_ACCESS_TOKEN || "")?.trim().replace(/^=\s*/, "");
const APP_ID        = process.env.ZALO_APP_ID?.trim();
const APP_SECRET    = process.env.ZALO_APP_SECRET?.trim();
const API_PORT      = Number(process.env.API_PORT) || 3001;

if (!BOT_TOKEN) {
  console.error("❌ Thiếu ZALO_BOT_TOKEN trong .env");
  process.exit(1);
}

// ── Token Cache (cho OA Token auto-refresh) ───────────────────
const TOKEN_CACHE_FILE = path.join(process.cwd(), "zalo-oa-tokens.json");

class TokenStore {
  private accessToken: string  = OA_TOKEN;
  private refreshToken: string = process.env.ZALO_OA_REFRESH_TOKEN?.trim().replace(/^=\s*/, "") || "";

  constructor() {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      try {
        const cached = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf-8"));
        this.accessToken  = cached.accessToken  || this.accessToken;
        this.refreshToken = cached.refreshToken || this.refreshToken;
        console.log("✅ [TokenStore] Nạp token từ file cache thành công.");
      } catch { /* bỏ qua lỗi đọc file */ }
    }
  }

  get(): string { return this.accessToken; }

  async refresh(): Promise<boolean> {
    if (!APP_ID || !APP_SECRET || !this.refreshToken) {
      console.warn("⚠️  [TokenStore] Thiếu APP_ID/APP_SECRET/RefreshToken → không thể refresh.");
      return false;
    }
    try {
      const res  = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: APP_SECRET },
        body:    new URLSearchParams({ app_id: APP_ID, grant_type: "refresh_token", refresh_token: this.refreshToken }),
      });
      const data = await res.json() as any;
      if (data.access_token) {
        this.accessToken  = data.access_token;
        this.refreshToken = data.refresh_token || this.refreshToken;
        fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify({ accessToken: this.accessToken, refreshToken: this.refreshToken }, null, 2));
        console.log("✅ [TokenStore] Refresh OA Token thành công.");
        return true;
      }
      console.error("❌ [TokenStore] Refresh thất bại:", data);
      return false;
    } catch (e) {
      console.error("❌ [TokenStore] Lỗi mạng khi refresh:", e);
      return false;
    }
  }
}

const tokenStore  = new TokenStore();
const bot         = new Bot({ token: BOT_TOKEN });
const socialClient = USER_TOKEN ? new SocialClient(USER_TOKEN) : null;

// ZnsClient dùng dynamic token (luôn lấy qua tokenStore.get())
const makeZns = () => new ZnsClient(tokenStore.get());

// ── Thống kê bot ─────────────────────────────────────────────
const stats = {
  messagesReceived: 0,
  messagesSent:     0,
  errors:           0,
  startedAt:        new Date().toISOString(),
};

// ============================================================
// BOT AUTO-REPLY HANDLERS
// ============================================================

bot.onError((error, ctx) => {
  stats.errors++;
  console.error(`[Bot Error] ${ctx.kind}:${ctx.source}`, error);
});

// /start → menu chào mừng
bot.onText(/\/start/, async (msg) => {
  stats.messagesReceived++;
  const name = msg.fromUser?.displayName ?? "bạn";
  await bot.sendMessage(
    msg.chat.id,
    `🎉 Xin chào **${name}**!\n\nTôi là Bot Test tổng hợp. Thử các lệnh sau:\n\n/help - Danh sách lệnh\n/ping - Kiểm tra kết nối\n/info - Xem Profile của bạn\n/friends - Xem bạn bè\n/echo <nội dung> - Lặp lại tin nhắn`
  );
  stats.messagesSent++;
  console.log(`[Bot] Đã gửi welcome message đến ${msg.chat.id}`);
});

// /ping → pong
bot.onText(/\/ping/, async (msg) => {
  stats.messagesReceived++;
  await bot.sendMessage(msg.chat.id, "🏓 pong!");
  stats.messagesSent++;
});

// /help → danh sách lệnh
bot.onText(/\/help/, async (msg) => {
  stats.messagesReceived++;
  await bot.sendMessage(
    msg.chat.id,
    "📋 **Danh sách lệnh:**\n\n" +
    "/start → Màn hình chào\n" +
    "/ping → Kiểm tra kết nối\n" +
    "/info → Thông tin Profile Zalo của bạn\n" +
    "/friends → Số lượng bạn bè\n" +
    "/echo <text> → Lặp lại tin nhắn\n" +
    "/help → Danh sách lệnh này\n\n" +
    "Hoặc nhắn bất kỳ nội dung nào để nhận phản hồi tự động."
  );
  stats.messagesSent++;
});

// /info → lấy profile từ SocialClient
bot.onText(/\/info/, async (msg) => {
  stats.messagesReceived++;
  try {
    await bot.sendChatAction(msg.chat.id, ChatAction.TYPING);
    if (!socialClient) {
      await bot.sendMessage(msg.chat.id, "⚠️ Chưa cấu hình USER_ACCESS_TOKEN để lấy thông tin profile.");
      return;
    }
    const profile = await socialClient.getProfile(["id", "name", "picture", "birthday"]);
    const reply = `👤 **Thông tin Profile Zalo của bạn:**\n\nID: ${profile.id}\nTên: ${profile.name}\nNgày sinh: ${profile.birthday ?? "N/A"}`;
    await bot.sendMessage(msg.chat.id, reply);
    stats.messagesSent++;
  } catch (e: any) {
    await bot.sendMessage(msg.chat.id, `❌ Không thể lấy profile: ${e.message}`);
    stats.errors++;
  }
});

// /friends → đếm bạn bè
bot.onText(/\/friends/, async (msg) => {
  stats.messagesReceived++;
  try {
    await bot.sendChatAction(msg.chat.id, ChatAction.TYPING);
    if (!socialClient) {
      await bot.sendMessage(msg.chat.id, "⚠️ Chưa cấu hình USER_ACCESS_TOKEN.");
      return;
    }
    const data = await socialClient.getFriends(0, 50, ["id", "name"]);
    const count = data.data?.length ?? 0;
    await bot.sendMessage(msg.chat.id, `👥 Bạn có **${count}** người bạn dùng App trên Zalo.`);
    stats.messagesSent++;
  } catch (e: any) {
    await bot.sendMessage(msg.chat.id, `❌ Không thể lấy danh sách bạn bè: ${e.message}`);
    stats.errors++;
  }
});

// /echo <text>
bot.onText(/\/echo (.+)/, async (msg, match) => {
  stats.messagesReceived++;
  const content = match[1]?.trim();
  await bot.sendMessage(msg.chat.id, `🔁 Echo: ${content}`);
  stats.messagesSent++;
});

// "hello" → phản hồi chào
bot.on("text", async (msg) => {
  stats.messagesReceived++;
  const text = msg.text?.toLowerCase().trim() ?? "";

  if (text === "hello" || text === "xin chào" || text === "chào") {
    await bot.sendMessage(msg.chat.id, "👋 Xin chào! Gõ /help để xem danh sách lệnh nhé!");
    stats.messagesSent++;
    return;
  }

  // Với tin nhắn bình thường khác (không phải lệnh)
  if (!text.startsWith("/") && text.length > 0) {
    await bot.sendChatAction(msg.chat.id, ChatAction.TYPING);
    await bot.sendMessage(
      msg.chat.id,
      `💬 Bạn vừa nhắn: "${msg.text}"\n\nGõ /help để xem các lệnh hỗ trợ.`
    );
    stats.messagesSent++;
  }
});

// ============================================================
// REST API SERVER (PORT 3001)
// ============================================================

const app = express();
app.use(express.json());

// Middleware log
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// GET /health
app.get("/health", (_req, res) => {
  res.json({
    status:   "ok",
    server:   "Zalo Bot Comprehensive Test",
    uptime:   process.uptime().toFixed(1) + "s",
    stats,
    services: {
      bot:          "polling",
      socialClient: socialClient ? "configured" : "missing USER_ACCESS_TOKEN",
      znsClient:    tokenStore.get() ? "configured" : "missing OA_ACCESS_TOKEN",
    },
  });
});

// GET /bot/status
app.get("/bot/status", (_req, res) => {
  res.json({
    isPolling:    bot.isPolling(),
    pollingState: bot.getPollingState(),
    stats,
  });
});

// GET /profile  (SocialClient)
app.get("/profile", async (_req, res) => {
  if (!socialClient) {
    res.status(503).json({ success: false, error: "USER_ACCESS_TOKEN chưa được cấu hình trong .env" });
    return;
  }
  try {
    const data = await socialClient.getProfile(["id", "name", "picture", "gender", "birthday"]);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /friends  (SocialClient)
app.get("/friends", async (req, res) => {
  if (!socialClient) {
    res.status(503).json({ success: false, error: "USER_ACCESS_TOKEN chưa được cấu hình trong .env" });
    return;
  }
  try {
    const limit  = Number(req.query.limit)  || 20;
    const offset = Number(req.query.offset) || 0;
    const data   = await socialClient.getFriends(offset, limit, ["id", "name", "picture"]);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /send-message  (Bot gửi tin trực tiếp)
app.post("/send-message", async (req, res) => {
  const { chat_id, text } = req.body as { chat_id?: string; text?: string };
  if (!chat_id || !text) {
    res.status(400).json({ success: false, error: "Cần 'chat_id' và 'text' trong body" });
    return;
  }
  try {
    const msg = await bot.sendMessage(chat_id, text);
    stats.messagesSent++;
    res.json({ success: true, message_id: msg.messageId });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /zns/phone  (ZnsClient gửi qua SĐT)
app.post("/zns/phone", async (req, res) => {
  const { phone, template_id, template_data, tracking_id } = req.body;
  if (!phone || !template_id || !template_data) {
    res.status(400).json({ success: false, error: "Cần phone, template_id, template_data" });
    return;
  }
  try {
    const result = await makeZns().sendTemplateMessageByPhone(phone, template_id, template_data, tracking_id);
    res.json({ success: true, api_response: result });
  } catch (e: any) {
    // Nếu token expired, thử tự refresh rồi gửi lại
    if (e.message?.includes("-124") || e.message?.includes("token")) {
      const refreshed = await tokenStore.refresh();
      if (refreshed) {
        try {
          const result = await makeZns().sendTemplateMessageByPhone(phone, template_id, template_data, tracking_id);
          res.json({ success: true, api_response: result, note: "Auto-refreshed token" });
          return;
        } catch (e2: any) {
          res.status(500).json({ success: false, error: e2.message });
          return;
        }
      }
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /zns/userid  (ZnsClient gửi qua User ID)
app.post("/zns/userid", async (req, res) => {
  const { user_id, template_id, template_data, tracking_id } = req.body;
  if (!user_id || !template_id || !template_data) {
    res.status(400).json({ success: false, error: "Cần user_id, template_id, template_data" });
    return;
  }
  try {
    const result = await makeZns().sendTemplateMessageByUserId(user_id, template_id, template_data, tracking_id);
    res.json({ success: true, api_response: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /zns  (alias gộp, dùng phone hoặc user_id)
app.post("/zns", async (req, res) => {
  const { phone, user_id, template_id, template_data, tracking_id } = req.body;
  if (!template_id || !template_data) {
    res.status(400).json({ success: false, error: "Cần template_id và template_data" });
    return;
  }
  if (!phone && !user_id) {
    res.status(400).json({ success: false, error: "Cần cung cấp 'phone' hoặc 'user_id'" });
    return;
  }
  try {
    const zns    = makeZns();
    const result = phone
      ? await zns.sendTemplateMessageByPhone(phone, template_id, template_data, tracking_id)
      : await zns.sendTemplateMessageByUserId(user_id, template_id, template_data, tracking_id);
    res.json({ success: true, api_response: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /webhook  (nhận update từ Zalo webhook nếu cần)
app.post("/webhook", async (req, res) => {
  try {
    await bot.processUpdate(req.body);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============================================================
// KHỞI CHẠY
// ============================================================

async function start() {
  await bot.initialize();

  // Bắt Ctrl+C dừng sạch
  process.on("SIGINT", async () => {
    console.log("\n⏹️  Đang dừng bot...");
    bot.stopPolling();
    await bot.shutdown();
    process.exit(0);
  });

  // Chạy REST API server
  app.listen(API_PORT, () => {
    console.log("\n" + "═".repeat(60));
    console.log("🚀 ZALO BOT - COMPREHENSIVE TEST SERVER");
    console.log("═".repeat(60));
    console.log(`\n📡 Bot đang POLLING để nhận tin nhắn từ Zalo...`);
    console.log(`🌐 REST API chạy tại: http://localhost:${API_PORT}`);
    console.log("\n── Trạng thái Services ──────────────────────────────────");
    console.log(`  Bot Token:    ${BOT_TOKEN ? "✅ có" : "❌ thiếu"}`);
    console.log(`  OA Token:     ${tokenStore.get() ? "✅ có" : "⚠️  thiếu (ZNS sẽ lỗi)"}`);
    console.log(`  User Token:   ${socialClient ? "✅ có" : "⚠️  thiếu (Social API sẽ lỗi)"}`);
    console.log("\n── REST Endpoints ───────────────────────────────────────");
    console.log(`  GET  http://localhost:${API_PORT}/health`);
    console.log(`  GET  http://localhost:${API_PORT}/bot/status`);
    console.log(`  GET  http://localhost:${API_PORT}/profile`);
    console.log(`  GET  http://localhost:${API_PORT}/friends?limit=20&offset=0`);
    console.log(`  POST http://localhost:${API_PORT}/send-message`);
    console.log(`       body: { "chat_id": "...", "text": "Xin chào!" }`);
    console.log(`  POST http://localhost:${API_PORT}/zns/phone`);
    console.log(`       body: { "phone":"849xxx", "template_id":"123", "template_data":{...} }`);
    console.log(`  POST http://localhost:${API_PORT}/zns/userid`);
    console.log(`       body: { "user_id":"xxx", "template_id":"123", "template_data":{...} }`);
    console.log(`  POST http://localhost:${API_PORT}/webhook`);
    console.log("─".repeat(60));
    console.log("\n💬 Bot đang sẵn sàng nhận tin nhắn. Thử nhắn:");
    console.log("   /start, /ping, /help, /info, /friends, /echo xin chào");
    console.log("═".repeat(60) + "\n");
  });

  // Bắt đầu polling
  void bot.startPolling({
    timeoutSeconds: 30,
    retryDelayMs:   2000,
  });
}

void start().catch((err) => {
  console.error("❌ Khởi động thất bại:", err);
  process.exit(1);
});
