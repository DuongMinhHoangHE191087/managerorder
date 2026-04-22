import "dotenv/config";
import { Bot, ChatAction } from "../src";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

// ==========================================
// CẤU HÌNH API & BIẾN MÔI TRƯỜNG
// ==========================================
const ZALO_TOKEN = process.env.ZALO_BOT_TOKEN?.trim();
const ZALO_APP_ID = process.env.ZALO_APP_ID?.trim();
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL || "https://your-project.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "your-supabase-key";
const GEMINI_KEY = (process.env.GEMINI_API_KEY || process.env.GEMINI_API_TOKEN)?.trim();

if (!ZALO_TOKEN) throw new Error("Thiếu ZALO_BOT_TOKEN trong .env");

// ==========================================
// THIẾT LẬP AUTO-REFRESH TOKEN (OAUTH2)
// ==========================================
class TokenManager {
  private static TOKEN_FILE = path.join(process.cwd(), "zalo-oa-tokens.json");
  private static config = {
    accessToken: process.env.ZALO_OA_TOKEN?.trim() || "",
    refreshToken: process.env.ZALO_OA_REFRESH_TOKEN?.trim() || "",
  };

  static init() {
    // Nếu file cache tồn tại, ưu tiên nạp từ file để không ghi đè cấu hình mới nhất
    if (fs.existsSync(this.TOKEN_FILE)) {
      try {
        const data = fs.readFileSync(this.TOKEN_FILE, "utf-8");
        this.config = JSON.parse(data);
        console.log("[TokenManager] Nạp thành công bộ Access/Refresh Token từ tệp nội bộ.");
      } catch (err) {
        console.error("[TokenManager] Lỗi đọc tệp bộ đệm, sẽ dùng các biến trong .env.", err);
      }
    } else {
      console.log("[TokenManager] Không tìm thấy file cache, sẽ sử dụng Token từ thiết lập .env làm mốc.");
    }
  }

  static getAccessToken() {
    return this.config.accessToken;
  }

  static async refreshZaloOAToken(): Promise<boolean> {
    if (!ZALO_APP_ID || !ZALO_APP_SECRET) {
      console.error("❌ Lỗi [TokenManager]: HỆ THỐNG CẦN `ZALO_APP_ID` và `ZALO_APP_SECRET` trong file `.env` để làm mới Token.");
      return false;
    }

    if (!this.config.refreshToken) {
      console.error("❌ Lỗi [TokenManager]: Hệ thống không tìm thấy Refresh Token (ZALO_OA_REFRESH_TOKEN).");
      return false;
    }

    console.log("🔄 [Zalo API] Đang yêu cầu cung cấp lại Access Token mới (Grant Type = refresh_token)...");
    
    try {
      const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "secret_key": ZALO_APP_SECRET,
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

        // Lưu trữ bộ token vào file json gốc nhằm sống sót qua các lần restart Bot Node.js
        fs.writeFileSync(this.TOKEN_FILE, JSON.stringify(this.config, null, 2), "utf-8");
        console.log("✅ [Zalo API] Auto-Refresh thành công! Đã tự đồng bộ lưu vào `zalo-oa-tokens.json`.");
        return true;
      } else {
        console.error("❌ [Zalo API] Không mượn được mã, lỗi trả về: ", data);
        return false;
      }
    } catch (err) {
      console.error("❌ Lỗi mạng truyền dẫn với API Zalo:", err);
      return false;
    }
  }
}

// Bắt đầu nạp đệm
TokenManager.init();

// ==========================================
// KHỞI TẠO CLIENTS
// ==========================================
const bot = new Bot({ token: ZALO_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

// ==========================================
// MÔ PHỎNG DATABASE TICKET (MOCK)
// ==========================================
const userSessions: Record<string, { step: string; temp_data?: any }> = {};

const getCustomerState = async (userId: string) => {
  return userSessions[userId] || { step: "idle" };
};

const updateCustomerState = async (userId: string, step: string, tempData?: any) => {
  userSessions[userId] = { step, temp_data: tempData };
};

const createTicket = async (userId: string, issueType: string, description: string) => {
  const ticketId = Math.floor(Math.random() * 1000000);
  console.log(`[Database] Đã tạo Ticket #${ticketId} (Khách ${userId}) - Vấn đề: ${issueType}`);
  return ticketId;
};

// ==========================================
// ZNS MODULE CÓ TÍNH NĂNG RETRY AUTO REFRESH
// ==========================================
export const sendZNSMessage = async (phone: string, templateId: string, templateData: Record<string, string>, isRetry = false): Promise<boolean> => {
  const token = TokenManager.getAccessToken();
  if (!token) {
    console.error("Lỗi: Không tìm thấy Access Token. ZNS thất bại.");
    return false;
  }
  
  try {
    const response = await fetch("https://business.openapi.zalo.me/message/template", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": token,
      },
      body: JSON.stringify({
        phone: phone,
        template_id: templateId,
        template_data: templateData,
      }),
    });
    
    const result = await response.json();
    console.log("[ZNS Trace Log]", result);
    
    // **AUTO RETRY INTERCEPTOR**
    if (result.error === -124) {
      console.log(`[Auto-Retry] Intercept Lỗi mã -124: Token của chúng ta có vẻ đã Expired.`);
      if (!isRetry) {
         // Chạy cơ chế refresh token của bản đệm gốc lập tức
         const success = await TokenManager.refreshZaloOAToken();
         if (success) {
           console.log(`[Auto-Retry] Access Token đã tái tạo thành công. Bắn lại API cuối cùng...`);
           return sendZNSMessage(phone, templateId, templateData, true); 
         }
      }
    }

    return result.error === 0;
  } catch (error) {
    console.error("[ZNS Error]", error);
    return false;
  }
};

export const notifyExpiryReminderZNS = async (phone: string, customerName: string, serviceName: string) => {
  console.log(`[Notification] Auto gửi thông báo nhắc nhở Service ZNS đến > ${phone}`);
  return sendZNSMessage(phone, "MÃ_GIẢ_VÍ_DỤ", {
    "name": customerName,
    "service": serviceName,
    "status": "Sắp hết hạn"
  });
};

// ==========================================
// MODULE TRỢ LÝ AI (GEMINI)
// ==========================================
async function askAI(question: string) {
  if (!genAI) return "Tính năng AI chưa được cấu hình API Key.";
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); 
  const prompt = `Bạn là trợ lý Chăm sóc khách hàng tự động của chúng tôi. 
  Hệ thống của chúng tôi có quy trình "Tạo Ticket Hỗ Trợ".
  Hãy trả lời ngắn gọn, thân thiện và chính xác câu hỏi sau của khách hàng: '${question}'.
  Nếu khách hàng báo lỗi sự cố, hãy nhắc họ nhấn vào "Tạo Ticket Hỗ Trợ" trong menu để kỹ thuật viên xử lý.`;
  
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("[AI Error]", error);
    return "Xin lỗi, tổng đài tự động đang quá tải. Bạn vui lòng tạo Ticket Hỗ Trợ để được xử lý nhé.";
  }
}

// ==========================================
// TICKET SUPPORT WIZARD LOGIC (INTERACTIVE KEYBOARD)
// ==========================================
const sendMainMenu = async (chatId: string) => {
  const text = "Chào mừng bạn đến với Trung Tâm Hỗ Trợ! Bạn cần giúp gì?";
  const keyboard = {
    rows: [
      [{ text: "Tạo Ticket Hỗ Trợ", payload: "cmd_create_ticket" }],
      [{ text: "Kiểm tra Dịch Vụ", payload: "cmd_check_service" }]
    ]
  };
  await bot.sendMessage(chatId, text);
  await bot.setChatKeyboard(chatId, keyboard);
  await updateCustomerState(chatId, "idle");
};

bot.onText(/\/start/, async (message) => {
  await sendMainMenu(message.chat.id);
});

bot.on("message", async (message) => {
  const text = message.text;
  if (!text) return;

  const chatId = message.chat.id;
  const state = await getCustomerState(chatId);

  // LUỒNG THEO STATE MACHINE
  if (text === "cmd_create_ticket" || text === "Tạo Ticket Hỗ Trợ") {
    const msg = "Vui lòng chọn loại vấn đề bạn đang gặp phải:";
    const kb = {
      rows: [
        [{ text: "Lỗi Kỹ Thuật", payload: "Vấn đề kỹ thuật" }],
        [{ text: "Thanh Toán & Gia Hạn", payload: "Thanh toán" }],
        [{ text: "Hủy Ticket (Quay lại)", payload: "cmd_cancel" }]
      ]
    };
    await bot.sendMessage(chatId, msg);
    await bot.setChatKeyboard(chatId, kb);
    await updateCustomerState(chatId, "choosing_issue");
    return;
  }

  if (text === "cmd_cancel" || text === "Hủy Ticket (Quay lại)") {
    await sendMainMenu(chatId);
    return;
  }

  switch (state.step) {
    case "choosing_issue":
      await updateCustomerState(chatId, "typing_details", { issueType: text });
      await bot.sendMessage(chatId, `Bạn đã chọn: **${text}**.\n\nVui lòng nhắn tin mô tả chi tiết lỗi bạn gặp phải để kỹ thuật viên kiểm tra:`);
      await bot.deleteChatKeyboard(chatId);
      return;

    case "typing_details":
      if (text.toLowerCase().includes("hủy")) {
        await sendMainMenu(chatId);
        return;
      }
      
      const issueType = state.temp_data?.issueType || "Khác";
      const ticketId = await createTicket(chatId, issueType, text);
      
      await bot.sendMessage(chatId, `✅ Đã tạo Ticket thành công!\n- Mã Ticket: **#${ticketId}**\n- Phân loại: ${issueType}\n\nKỹ thuật viên sẽ sớm kiểm tra và gửi kết quả.`);
      await sendMainMenu(chatId);
      return;

    case "idle":
    default:
      if (!text.startsWith("/")) { 
        await bot.sendChatAction(chatId, ChatAction.TYPING);
        const aiResponse = await askAI(text);
        await bot.sendMessage(chatId, aiResponse);
      }
      return;
  }
});

// Khởi chạy
console.log("🚀 Lõi Máy chủ Support Ticket Bot đang hoạt động...");
void bot.startPolling();
