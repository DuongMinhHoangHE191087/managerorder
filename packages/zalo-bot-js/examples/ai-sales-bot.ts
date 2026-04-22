/**
 * AI Sales Bot — Production-ready Zalo OA Bot
 * Tích hợp: Gemini AI + Supabase + ZNS + Human Handoff + Scheduler
 *
 * Chạy: npm run start:ai-bot
 */
import "dotenv/config";
import { Bot, ChatAction } from "../src";
import { GeminiAIService } from "../src/ai";
import { SupabaseCustomerTracker, ReminderScheduler } from "../src/services";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ==========================================
// CẤU HÌNH TỪ BIẾN MÔI TRƯỜNG
// ==========================================
const ZALO_TOKEN = process.env.ZALO_BOT_TOKEN?.trim();
const ZALO_APP_ID = process.env.ZALO_APP_ID?.trim();
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET?.trim();
const GEMINI_KEY = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_TOKEN)?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const ACCOUNT_ID = process.env.ACCOUNT_ID || "550e8400-e29b-41d4-a716-446655440000";

// 2 Zalo admin IDs để forward tin nhắn
const ADMIN_ZALO_IDS = (process.env.ADMIN_ZALO_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ZNS Template IDs (placeholder, thay khi có template thật)
const ZNS_TEMPLATES = {
  welcome: process.env.ZNS_TEMPLATE_WELCOME || "",
  expiryReminder: process.env.ZNS_TEMPLATE_EXPIRY_REMINDER || "",
  expired: process.env.ZNS_TEMPLATE_EXPIRED || "",
};

if (!ZALO_TOKEN) throw new Error("Thiếu ZALO_BOT_TOKEN trong .env");

// ==========================================
// TOKEN MANAGER (OAuth2 Auto-Refresh)
// ==========================================
class TokenManager {
  private static TOKEN_FILE = path.join(process.cwd(), "zalo-oa-tokens.json");
  private static config = {
    accessToken: process.env.ZALO_OA_TOKEN?.trim() || "",
    refreshToken: process.env.ZALO_OA_REFRESH_TOKEN?.trim() || "",
  };

  static init() {
    if (fs.existsSync(this.TOKEN_FILE)) {
      try {
        const data = fs.readFileSync(this.TOKEN_FILE, "utf-8");
        this.config = JSON.parse(data);
        console.log("[TokenManager] ✅ Nạp token từ cache file.");
      } catch {
        console.log("[TokenManager] ⚠️ Cache file lỗi, dùng .env token.");
      }
    }
  }

  static getAccessToken() {
    return this.config.accessToken;
  }

  static async refresh(): Promise<boolean> {
    if (!ZALO_APP_ID || !ZALO_APP_SECRET || !this.config.refreshToken) {
      console.error("[TokenManager] ❌ Thiếu APP_ID/SECRET/REFRESH_TOKEN");
      return false;
    }

    try {
      const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: ZALO_APP_SECRET,
        },
        body: new URLSearchParams({
          app_id: ZALO_APP_ID,
          grant_type: "refresh_token",
          refresh_token: this.config.refreshToken,
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        this.config.accessToken = data.access_token;
        this.config.refreshToken = data.refresh_token;
        fs.writeFileSync(this.TOKEN_FILE, JSON.stringify(this.config, null, 2), "utf-8");
        console.log("[TokenManager] ✅ Refresh thành công!");
        return true;
      }
      console.error("[TokenManager] ❌ Refresh thất bại:", data);
      return false;
    } catch (err) {
      console.error("[TokenManager] ❌ Lỗi mạng:", err);
      return false;
    }
  }
}

TokenManager.init();

// ==========================================
// KHỞI TẠO CÁC DỊCH VỤ
// ==========================================
const bot = new Bot({ token: ZALO_TOKEN });

// AI Service
const ai = GEMINI_KEY
  ? new GeminiAIService({
      apiKey: GEMINI_KEY,
      modelName: "gemini-2.5-flash",
      maxOutputTokens: 500,
      // System prompt sẽ được setup chi tiết sau
      systemPrompt: `Bạn là trợ lý bán hàng AI chuyên nghiệp của cửa hàng bán tài khoản premium (ChatGPT, Netflix, Spotify, YouTube, Duolingo...).
- Trả lời ngắn gọn, thân thiện bằng tiếng Việt.
- Hỗ trợ khách hàng về: giá gói, cách sử dụng, báo lỗi, gia hạn.
- Nếu khách báo lỗi, hướng dẫn mô tả chi tiết và trấn an rằng đội kỹ thuật sẽ xử lý sớm.
- Tuân thủ pháp luật Việt Nam. Không tạo thông tin sai lệch.
- Nếu không biết câu trả lời, hãy nhắc khách nhắn 'gặp nhân viên' để được hỗ trợ trực tiếp.`,
    })
  : null;

// Supabase Tracker
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const tracker = supabase
  ? new SupabaseCustomerTracker({ supabase, accountId: ACCOUNT_ID })
  : null;

// ==========================================
// ZNS MODULE VỚI AUTO-RETRY
// ==========================================
async function sendZNS(
  phone: string,
  templateId: string,
  templateData: Record<string, string>,
  isRetry = false,
): Promise<boolean> {
  const token = TokenManager.getAccessToken();
  if (!token || !templateId) return false;

  try {
    const response = await fetch("https://business.openapi.zalo.me/message/template", {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: token },
      body: JSON.stringify({ phone, template_id: templateId, template_data: templateData }),
    });

    const result = await response.json();
    if (result.error === -124 && !isRetry) {
      const ok = await TokenManager.refresh();
      if (ok) return sendZNS(phone, templateId, templateData, true);
    }
    return result.error === 0;
  } catch {
    return false;
  }
}



// ==========================================
// SCHEDULER (Nhắc hẹn + Gia hạn)
// ==========================================
let scheduler: ReminderScheduler | null = null;
if (tracker) {
  scheduler = new ReminderScheduler({
    bot,
    tracker,
    intervalMs: 5 * 60 * 1000, // 5 phút
    adminZaloIds: ADMIN_ZALO_IDS,
    sendZNS: (phone, templateId, data) => sendZNS(phone, templateId, data),
    znsTemplates: {
      expiryReminder: ZNS_TEMPLATES.expiryReminder,
      expired: ZNS_TEMPLATES.expired,
    },
  });
}

// ==========================================
// AI KEYWORDS (Từ khoá trigger AI tự động)
// ==========================================
const AI_KEYWORD_PATTERNS: { pattern: RegExp; context?: string; logType?: string }[] = [
  { pattern: /giá|bảng giá|báo giá|bao nhiêu/i, context: "Khách hỏi về giá" },
  {
    pattern: /lỗi|bug|sự cố|không hoạt động|không vào được|die|lỗi đăng nhập/i,
    context: "Khách báo lỗi kỹ thuật",
    logType: "bug",
  },
  { pattern: /gia hạn|renew|hết hạn|còn hạn/i, context: "Khách hỏi về gia hạn", logType: "renewal_inquiry" },
  { pattern: /hướng dẫn|cách dùng|cách sử dụng|help|trợ giúp/i, context: "Khách cần hướng dẫn" },
  { pattern: /mua|đăng ký|order|đặt/i, context: "Khách muốn mua/đăng ký gói" },
];

// ==========================================
// GLOBAL AI TOGGLE
// ==========================================
let globalAiEnabled = true;

// ==========================================
// HELPER: Forward tin nhắn cho admin
// ==========================================
async function forwardToAdmins(fromUserId: string, originalText: string) {
  if (ADMIN_ZALO_IDS.length === 0) return;

  const forwardMsg = `📨 **TIN NHẮN TỪ KHÁCH** (Human Mode)\n👤 Zalo ID: ${fromUserId}\n💬 Nội dung: ${originalText}`;

  for (const adminId of ADMIN_ZALO_IDS) {
    try {
      await bot.sendMessage(adminId, forwardMsg);
    } catch (err) {
      console.error(`[Forward] Failed to send to admin ${adminId}:`, err);
    }
  }
}

// ==========================================
// BOT EVENT HANDLERS
// ==========================================

// /start — Menu chính
bot.onText(/\/start/, async (message) => {
  const chatId = message.chat.id;
  await bot.sendMessage(
    chatId,
    `Chào bạn! 👋\n\n📌 **Lệnh hỗ trợ:**\n• Nhắn \`/help\` để xem chi tiết\n• Nhắn \`/testqr\` để xem luồng thanh toán\n• Nhắn \`gặp nhân viên\` để chat trực tiếp`,
  );
});

// /help — Hỗ trợ
bot.onText(/\/help/, async (message) => {
  const chatId = message.chat.id;
  await bot.sendMessage(
    chatId,
    `📚 **Danh sách lệnh:**\n\n/start - Menu chính\n/testqr - Thử luồng thanh toán\n/ai - Bật lại AI\n/nguoi - Dừng AI, gặp nhân viên\n\n💬 Mẹo: Ở bản Zalo Cá Nhân, các thao tác xác nhận nên dùng bằng chữ (VD: gõ XONG, HUY). Bots sẽ tự nhận diện nhanh nhất!`,
  );
});

// /testqr — Test luồng gửi ảnh QR và menu nút bấm kiểu Zalo Cá Nhân (Text-based)
bot.onText(/\/testqr/, async (message) => {
  const chatId = message.chat.id;
  
  const amount = 50000;
  const orderCode = `TEST_${Date.now().toString().slice(-6)}`;
  const qrUrl = `https://img.vietqr.io/image/MB-0394497949-compact2.png?amount=${amount}&addInfo=${orderCode}&accountName=Test%20Website`;

  await bot.sendChatAction(chatId, ChatAction.TYPING);
  
  await bot.sendPhoto(chatId, `💰 **Yêu Cầu Thanh Toán**\n\nMã đơn: ${orderCode}\nSố tiền: ${amount.toLocaleString('vi-VN')} đ\n\n📌 Vui lòng quét mã trên bằng ứng dụng ngân hàng.\n\nSau khi chuyển khoản thành công, hãy gõ:\n👉 **XONG** (để xác nhận)\n👉 **HUY** (để huỷ đơn)`, qrUrl);
});

// ==========================================
// ADMIN COMMANDS (Dành cho admin chat vào OA)
// ==========================================
bot.onText(/^\/pause\s+(.+)$/i, async (message, match) => {
  if (!ADMIN_ZALO_IDS.includes(message.chat.id)) return;
  const targetUserId = match[1].trim();
  if (tracker) await tracker.setSessionMode(targetUserId, "human", message.chat.id);
  await bot.sendMessage(message.chat.id, `✅ Đã tạm dừng AI cho user: ${targetUserId}`);
});

bot.onText(/^\/resume\s+(.+)$/i, async (message, match) => {
  if (!ADMIN_ZALO_IDS.includes(message.chat.id)) return;
  const targetUserId = match[1].trim();
  if (tracker) await tracker.setSessionMode(targetUserId, "ai");
  await bot.sendMessage(message.chat.id, `✅ Đã bật lại AI cho user: ${targetUserId}`);
});

bot.onText(/^\/pauseall$/i, async (message) => {
  if (!ADMIN_ZALO_IDS.includes(message.chat.id)) return;
  globalAiEnabled = false;
  const count = tracker ? await tracker.setAllSessionsMode("human", message.chat.id) : 0;
  await bot.sendMessage(
    message.chat.id,
    `🛑 AI đã TẮT toàn bộ. ${count} phiên đã chuyển sang Human Mode.\nNhắn \`/resumeall\` để bật lại.`,
  );
});

bot.onText(/^\/resumeall$/i, async (message) => {
  if (!ADMIN_ZALO_IDS.includes(message.chat.id)) return;
  globalAiEnabled = true;
  const count = tracker ? await tracker.setAllSessionsMode("ai") : 0;
  await bot.sendMessage(message.chat.id, `✅ AI đã BẬT lại. ${count} phiên đã khôi phục AI Mode.`);
});

bot.onText(/^\/status$/i, async (message) => {
  if (!ADMIN_ZALO_IDS.includes(message.chat.id)) return;
  const status = [
    `🤖 **Trạng thái Bot**`,
    `• AI Global: ${globalAiEnabled ? "✅ BẬT" : "🛑 TẮT"}`,
    `• Gemini: ${ai ? "✅ OK" : "❌ Chưa cấu hình"}`,
    `• Supabase: ${supabase ? "✅ OK" : "❌ Chưa cấu hình"}`,
    `• Scheduler: ${scheduler?.["running"] ? "✅ Đang chạy" : "⏸️ Dừng"}`,
    `• Admin IDs: ${ADMIN_ZALO_IDS.length} tài khoản`,
    `• ZNS Token: ${TokenManager.getAccessToken() ? "✅ Có" : "❌ Thiếu"}`,
  ].join("\n");
  await bot.sendMessage(message.chat.id, status);
});

// ==========================================
// MAIN MESSAGE HANDLER
// ==========================================
bot.on("message", async (message) => {
  const text = message.text;
  if (!text) return;

  const chatId = message.chat.id;

  // Skip admin commands (đã xử lý bên trên)
  if (
    text.startsWith("/pause") ||
    text.startsWith("/resume") ||
    text.startsWith("/status") ||
    text.startsWith("/start") ||
    text.startsWith("/help") ||
    text.startsWith("/testqr")
  ) {
    return;
  }

  // === HANDLE TEXT-BASED BUTTONS CHO ZALO CÁ NHÂN ===
  const upText = text.trim().toUpperCase();
  if (upText === "XONG" || text.startsWith("cmd_check_payment|")) {
    await bot.sendMessage(chatId, `🕒 Đang kiểm tra hệ thống SePay cho lệnh chuyển khoản của bạn...\n\n*(Chỗ này Bot Zalo sẽ gọi API sang Next.js check status. Nếu Paid thì báo Success!)*`);
    return;
  }
  
  if (upText === "HUY" || upText === "HUỶ" || text === "cmd_cancel_order") {
    await bot.sendMessage(chatId, `❌ Bạn đã hủy đơn hàng! Nhắn /testqr để thử lại.`);
    return;
  }

  // Auto-capture Zalo User ID + match customer
  const customerId = tracker ? await tracker.captureZaloUser(chatId) : null;

  // === CHECK: Human Mode ===
  const sessionMode = tracker ? await tracker.getSessionMode(chatId) : "ai";
  const isHumanMode = sessionMode === "human" || !globalAiEnabled;

  // Khách nhắn "gặp nhân viên" / "/nguoi"
  if (/gặp nhân viên|nguoi|nhan vien|chat trực tiếp/i.test(text) || text === "/nguoi") {
    if (tracker) await tracker.setSessionMode(chatId, "human", "customer_request");
    await bot.sendMessage(
      chatId,
      `👋 Đã chuyển sang chế độ **chat trực tiếp** với nhân viên.\nTin nhắn của bạn sẽ được chuyển đến nhân viên CSKH.\nNhắn \`/ai\` để quay lại sử dụng trợ lý AI.`,
    );
    await forwardToAdmins(chatId, `[Khách yêu cầu gặp nhân viên]`);
    return;
  }

  // Khách nhắn "/ai" → bật lại AI
  if (text === "/ai") {
    if (tracker) await tracker.setSessionMode(chatId, "ai");
    await bot.sendMessage(chatId, `🤖 Đã bật lại trợ lý AI. Bạn có thể hỏi bất cứ điều gì!`);
    return;
  }

  // === HUMAN MODE: Forward cho admin ===
  if (isHumanMode) {
    await forwardToAdmins(chatId, text);
    // Không trả lời tự động khi ở human mode
    return;
  }

  // === AI MODE ===

  // 1) Trigger bằng prefix @hoiAI
  if (text.toLowerCase().startsWith("@hoiai")) {
    const question = text.replace(/^@hoiai\s*/i, "").trim();
    if (!question) {
      await bot.sendMessage(chatId, `Vui lòng nhập câu hỏi sau @hoiAI. Ví dụ: \`@hoiAI giá gói ChatGPT?\``);
      return;
    }

    await bot.sendChatAction(chatId, ChatAction.TYPING);
    const answer = ai ? await ai.ask(question) : "Tính năng AI chưa được cấu hình.";
    await bot.sendMessage(chatId, answer);
    return;
  }

  // 2) Trigger bằng keyword
  for (const kw of AI_KEYWORD_PATTERNS) {
    if (kw.pattern.test(text)) {
      await bot.sendChatAction(chatId, ChatAction.TYPING);

      // Log vào Supabase nếu là lỗi/gia hạn
      if (kw.logType && tracker) {
        if (kw.logType === "bug") {
          await tracker.logError(chatId, "bug", text, customerId || undefined);
        } else {
          await tracker.logActivity(kw.logType, { zalo_user_id: chatId, message: text }, customerId || undefined);
        }
      }

      const answer = ai
        ? await ai.ask(text, kw.context)
        : "Cảm ơn bạn đã liên hệ. Nhân viên sẽ hỗ trợ bạn sớm nhất!";
      await bot.sendMessage(chatId, answer);
      return;
    }
  }

  // 3) Tin nhắn không match gì → im lặng, chỉ capture user (đã làm ở trên)
  // Không spam người dùng với tin nhắn không cần thiết
});

// ==========================================
// KHỞI CHẠY
// ==========================================
console.log("═══════════════════════════════════════════");
console.log("🚀 AI Sales Bot — Zalo OA");
console.log("═══════════════════════════════════════════");
console.log(`  AI Gemini    : ${ai ? "✅" : "❌ (thiếu GEMINI_API_KEY)"}`);
console.log(`  Supabase     : ${supabase ? "✅" : "❌ (thiếu SUPABASE_URL/KEY)"}`);
console.log(`  Admin IDs    : ${ADMIN_ZALO_IDS.length} tài khoản`);
console.log(`  ZNS Token    : ${TokenManager.getAccessToken() ? "✅" : "❌"}`);
console.log("═══════════════════════════════════════════");

// Start scheduler
scheduler?.start();

// Start bot polling
void bot.startPolling();
