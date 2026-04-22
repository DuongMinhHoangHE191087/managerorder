/**
 * BotFeatureHandler - Đăng ký toàn bộ commands và handlers cho Zalo Bot
 *
 * Lệnh hỗ trợ:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ /layDuolingoID [input]  → Tra cứu Duolingo (any format)     │
 * │ /tracuu [keyword]       → Tra cứu đơn hàng (3 lượt/ngày)   │
 * │ /help                   → Xem danh sách lệnh                │
 * │ Gửi ảnh                 → AI phân tích → tra cứu Duolingo   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Interactive mode:
 * - Khi /layDuolingoID không có args → bot hỏi lại username
 * - Người dùng gửi "huỷ"/"cancel" để thoát session
 */

import type { Bot } from "../core/Bot";
import type { Message } from "../models/Message";
import { GeminiAIService } from "../ai/GeminiAIService";
import { DuolingoService } from "../services/DuolingoService";
import { RateLimitService } from "../services/RateLimitService";
import { OrderLookupService } from "../services/OrderLookupService";
import { ProductLookupService } from "../services/ProductLookupService";
import { SupabaseCustomerTracker } from "../services/SupabaseCustomerTracker";
import { ZaloUserTracker } from "../services/ZaloUserTracker";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Constants ───────────────────────────────────────────────────

/** Timeout session hỏi username: 3 phút */
const SESSION_TIMEOUT_MS = 3 * 60 * 1000;

const CANCEL_KEYWORDS = ["huỷ", "huy", "cancel", "thoát", "thoat", "bỏ qua", "bo qua"];

/** Các lệnh đã đăng ký (lowercase, không có /) */
const KNOWN_COMMANDS = new Set(["help", "layduolingoid", "tracuu", "nhanvien", "human", "ai", "product", "sanpham"]);

/**
 * Gợi ý ngắn cho từng lệnh khi người dùng dùng sai cú pháp
 * Key là lệnh lowercase (không có /)
 */
const COMMAND_HINTS: Record<string, string> = {
  layduolingoid: [
    `📚 Cách dùng /layDuolingoID:`,
    ``,
    `  /layDuolingoID suanxon`,
    `  /layDuolingoID @suanxon`,
    `  /layDuolingoID duolingo.com/profile/suanxon`,
    `  /layDuolingoID          ← Bot sẽ hỏi lại username`,
    ``,
    `💡 Tự động trích xuất từ URL profile Duolingo.`,
  ].join("\n"),

  tracuu: [
    `📦 Cách dùng /tracuu:`,
    ``,
    `  /tracuu 0987654321       ← số điện thoại`,
    `  /tracuu ORD-12345        ← mã đơn hàng`,
    `  /tracuu @suanxon         ← Duolingo username`,
    ``,
    `⚠️  Giới hạn: 3 lượt tra cứu / ngày / tài khoản.`,
  ].join("\n"),

  help: [
    `💬 Cách dùng /help:`,
    `  /help   ← Hiển thị toàn bộ danh sách lệnh hỗ trợ`,
  ].join("\n"),

  product: [
    `🛍️ Cách dùng /product hoặc /sanpham:`,
    `  Chỉ cần gõ /product hoặc /sanpham để xem danh sách món đồ/khoá học đang bán.`,
  ].join("\n"),
  
  nhanvien: [
    `👤 Cách dùng /nhanvien hoặc /human:`,
    `  Để dừng bot AI và chờ nhân viên thật hỗ trợ.`,
  ].join("\n"),
};

const HELP_MESSAGE = `🤖 ━━━━ DANH SÁCH LỆNH BOT ━━━━

📚 TRA CỨU DUOLINGO:
  /layDuolingoID [username]
  /layDuolingoID @username
  /layDuolingoID duolingo.com/profile/xxx
  (Hoặc gõ /layDuolingoID rồi bot hỏi lại)
  ➥ Trả về ID, Streak, Plus, XP đầy đủ

📦 TRA CỨU ĐƠN HÀNG (3 lượt/ngày):
  /tracuu [số điện thoại]
  /tracuu [mã đơn hàng]
  /tracuu [username duolingo]
  VD: /tracuu 0987654321
  VD: /tracuu ORD-12345
  VD: /tracuu @suanxon

🖼️ GỬI ẢNH:
  Gửi ảnh chụp màn hình Duolingo
  ➥ AI tự đọc username và tra cứu ngay

💬 KHÁC:
  /product hoặc /sanpham — Xem danh sách sản phẩm
  /nhanvien hoặc /human — Kết nối nhân viên CSKH thật
  /ai — Quay lại trợ lý AI
  /help — Xem lại menu này
  "gặp nhân viên" — Tương tự /nhanvien

🦉 ━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// ── Types ───────────────────────────────────────────────────────

type PendingSession = {
  type: "await_duolingo_username";
  timerId: ReturnType<typeof setTimeout>;
};

// ── Main Class ──────────────────────────────────────────────────

export interface BotFeatureConfig {
  bot: Bot;
  supabase: SupabaseClient;
  accountId: string;
  geminiApiKey: string;
  geminiModelName?: string;
  rateLimitPerDay?: number;
}

export class BotFeatureHandler {
  private readonly bot: Bot;
  private readonly gemini: GeminiAIService;
  private readonly duolingo: DuolingoService;
  private readonly rateLimit: RateLimitService;
  private readonly orderLookup: OrderLookupService;
  private readonly productLookup: ProductLookupService;
  private readonly tracker: SupabaseCustomerTracker | null = null;
  private readonly userTracker: ZaloUserTracker | null = null;

  /**
   * Map lưu session đang chờ input từ user
   * Key: zaloUserId, Value: PendingSession
   */
  private readonly pendingSessions = new Map<string, PendingSession>();

  constructor(config: BotFeatureConfig) {
    this.bot = config.bot;

    this.gemini = new GeminiAIService({
      apiKey: config.geminiApiKey,
      modelName: config.geminiModelName ?? "gemini-2.5-flash",
      maxOutputTokens: 1000,
    });

    this.duolingo = new DuolingoService();

    this.rateLimit = new RateLimitService({
      supabase: config.supabase,
      accountId: config.accountId,
      maxQueriesPerDay: config.rateLimitPerDay ?? 3,
    });

    this.orderLookup = new OrderLookupService({
      supabase: config.supabase,
      accountId: config.accountId,
    });

    this.productLookup = new ProductLookupService({
      supabase: config.supabase,
      accountId: config.accountId,
    });

    if (config.supabase) {
      this.tracker = new SupabaseCustomerTracker({
        supabase: config.supabase,
        accountId: config.accountId,
      });
      this.userTracker = new ZaloUserTracker({
        supabase: config.supabase,
        accountId: config.accountId,
      });
    }
  }

  // ──────────────────────────────────────────────────────
  // REGISTER
  // ──────────────────────────────────────────────────────

  register(): void {
    // 1. /help
    this.bot.command("help", (message) => this.handleHelp(message));

    // Lệnh gửi ảnh thử nghiệm
    this.bot.command("testphoto", async (message) => {
      try {
        await message.replyPhoto("https://picsum.photos/400/300", "🖼️ Đây là ảnh test hệ thống gửi cho bạn!");
      } catch (err) {
        console.error("Lỗi gửi ảnh", err);
        await message.replyText("❌ Lỗi gửi ảnh: " + String(err));
      }
    });

    // 2. /layDuolingoID [input?]
    this.bot.command("layDuolingoID", (message, ctx) =>
      this.handleLayDuolingoID(message, ctx.command.argsRaw),
    );

    // 3. /tracuu [keyword]
    this.bot.command("tracuu", (message, ctx) =>
      this.handleTracuu(message, ctx.command.argsRaw),
    );

    // 4. Các lệnh mở rộng (nhân viên, sản phẩm)
    this.bot.command("nhanvien", (message) => this.handleModeSwitch(message, "human"));
    this.bot.command("human", (message) => this.handleModeSwitch(message, "human"));
    this.bot.command("ai", (message) => this.handleModeSwitch(message, "ai"));
    this.bot.command("product", (message) => this.handleProduct(message));
    this.bot.command("sanpham", (message) => this.handleProduct(message));

    // 5. Ảnh tự động → AI phân tích
    this.bot.on("photo", (message) => this.handlePhotoMessage(message));

    // 6. Text thường → kiểm tra pending session trước, sau đó fallback
    this.bot.on("text", (message) => this.handleTextMessage(message));

    console.log("[BotFeature] ✅ All handlers registered");
  }

  // ──────────────────────────────────────────────────────
  // COMMAND HANDLERS
  // ──────────────────────────────────────────────────────

  private async handleHelp(message: Message): Promise<void> {
    await message.replyText(HELP_MESSAGE);
  }

  /**
   * /layDuolingoID [input]
   *
   * Luồng:
   * 1. Có arg → parse ngay → lookup → trả kết quả
   * 2. Không có arg → gửi câu hỏi → lưu pendingSession
   *    → user reply text → bắt ở handleTextMessage → lookup → trả kết quả
   *    → user reply "huỷ" → xoá session
   *    → timeout 3 phút → tự xoá session
   */
  private async handleLayDuolingoID(message: Message, rawArgs: string): Promise<void> {
    const input = rawArgs.trim();

    if (input) {
      // Có input ngay → thực hiện luôn
      // Lưu duolingo username tra cứu (async, không block)
      if (this.userTracker && message.fromUser?.id) {
        void this.userTracker.recordDuolingoQuery(message.fromUser.id.toString(), input);
      }
      await this.executeDuolingoLookup(message, input);
      return;
    }

    // Không có input → hỏi lại (interactive mode)
    const userId = message.fromUser?.id;
    if (!userId) {
      await message.replyText("❌ Không xác định được người dùng.");
      return;
    }

    // Huỷ session cũ nếu đang có
    this.clearSession(userId);

    // Gửi câu hỏi
    await message.replyText(this.duolingo.formatAskUsernameMessage());

    // Tạo session với timeout tự hủy
    const timerId = setTimeout(() => {
      if (this.pendingSessions.has(userId)) {
        this.pendingSessions.delete(userId);
        // Không thể reply vì không có message ref → chỉ log
        console.log(`[Session] Timeout: session of ${userId} expired`);
      }
    }, SESSION_TIMEOUT_MS);

    this.pendingSessions.set(userId, {
      type: "await_duolingo_username",
      timerId,
    });
  }

  /**
   * /tracuu [keyword]
   * Rate Limit 3 lượt/ngày per Zalo ID
   */
  private async handleTracuu(message: Message, rawArgs: string): Promise<void> {
    const keyword = rawArgs.trim();
    const zaloUserId = message.fromUser?.id ?? "";

    if (!keyword) {
      await message.replyText(
        [
          `❌ Vui lòng cung cấp thông tin tra cứu.`,
          ``,
          `Cách dùng:`,
          `  /tracuu 0987654321       → số điện thoại`,
          `  /tracuu ORD-12345        → mã đơn hàng`,
          `  /tracuu @suanxon         → Duolingo username`,
        ].join("\n"),
      );
      return;
    }

    if (!zaloUserId) {
      await message.replyText("❌ Không xác định được người dùng. Vui lòng thử lại.");
      return;
    }

    // Kiểm tra Rate Limit TRƯỚC khi query
    const rateResult = await this.rateLimit.checkAndRecord(zaloUserId, keyword);

    if (!rateResult.allowed) {
      await message.replyText(this.rateLimit.formatBlockMessage(rateResult));
      return;
    }

    await message.replyText(`🔍 Đang tra cứu: "${keyword}"...`);

    const orders = await this.orderLookup.lookup(keyword);
    const reply = this.orderLookup.formatOrdersMessage(orders, keyword);

    // Lưu keyword tra cứu của khách (async, không block)
    if (this.userTracker) {
      void this.userTracker.recordOrderQuery(zaloUserId.toString(), keyword);
    }

    const warning = this.rateLimit.formatWarningMessage(rateResult);
    await message.replyText(warning ? `${reply}\n\n${warning}` : reply);
  }

  /**
   * Lệnh /product hoặc /sanpham
   */
  private async handleProduct(message: Message): Promise<void> {
    await message.replyText("🔍 Đang tải danh sách sản phẩm...");
    const products = await this.productLookup.getActiveProducts(10);
    await message.replyText(this.productLookup.formatProductsMessage(products));
  }

  /**
   * Lệnh /nhanvien, /human, /ai
   */
  private async handleModeSwitch(message: Message, mode: "human" | "ai"): Promise<void> {
    const userId = message.fromUser?.id;
    if (!userId || !this.tracker) return;

    if (mode === "human") {
      await this.tracker.setSessionMode(userId.toString(), "human", "customer_request");
      await message.replyText("👋 Đã chuyển sang chế độ chat trực tiếp với nhân viên.\nBộ phận CSKH sẽ phản hồi bạn trong thời gian sớm nhất.\nNhắn /ai để quay lại sử dụng trợ lý AI.");
    } else {
      await this.tracker.setSessionMode(userId.toString(), "ai");
      await message.replyText("🤖 Đã bật lại trợ lý AI. Bạn có thể hỏi tôi bất cứ điều gì!");
    }
  }

  // ──────────────────────────────────────────────────────
  // MESSAGE HANDLERS
  // ──────────────────────────────────────────────────────

  /**
   * Handler cho event "text":
   * 1. Nếu là lệnh /xxx đã biết   → clear session, để command handler xử lý
   * 2. Nếu là lệnh /xxx không biết → clear session + gợi ý lệnh gần nhất / toàn bộ help
   * 3. Nếu là text thường + có session → xử lý session
   * 4. Text thường, không session → ignore
   */
  private async handleTextMessage(message: Message): Promise<void> {
    const text = message.text?.trim() ?? "";
    const userId = message.fromUser?.id;

    if (!userId || !text) return;

    // ── Lưu thông tin khách hàng Zalo (async, không block) ────────────────────
    if (this.userTracker) {
      const userObj = message.fromUser as unknown as Record<string, unknown>;
      const displayName = typeof userObj?.displayName === "string" ? userObj.displayName : undefined;
      void this.userTracker.upsertUser(userId.toString(), displayName);
    }

    // ── Xử lý chuyển đổi chế độ CSKH / AI ───────────────────
    let isHumanMode = false;
    if (this.tracker) {
      if (/gặp nhân viên|nguoi|nhan vien|chat trực tiếp/i.test(text)) {
        await this.handleModeSwitch(message, "human");
        return;
      }

      const sessionMode = await this.tracker.getSessionMode(userId.toString());
      isHumanMode = sessionMode === "human";
    }

    if (isHumanMode) {
      // Đang ở chế độ CSKH, bỏ qua các thao tác tự động
      return; 
    }

    // ── Xử lý lệnh /xxx ─────────────────────────────────────
    if (text.startsWith("/")) {
      // Tách tên lệnh (lowercase, không /)
      const cmdToken = text.slice(1).split(/\s+/)[0]?.toLowerCase() ?? "";
      const isKnown = KNOWN_COMMANDS.has(cmdToken);

      // Nếu đang có session → luôn huỷ session khi user gõ lệnh
      if (this.pendingSessions.has(userId)) {
        this.clearSession(userId);
      }

      if (isKnown) {
        // Lệnh đã đăng ký → để bot.command() xử lý, không làm gì thêm
        return;
      }

      // Lệnh KHÔNG tồn tại → gợi ý
      const suggestion = this.suggestForUnknownCommand(cmdToken);
      await message.replyText(suggestion);
      return;
    }

    const session = this.pendingSessions.get(userId);
    if (session) {
      // Có session đang chờ
      if (session.type === "await_duolingo_username") {
        // Kiểm tra cancel
        if (CANCEL_KEYWORDS.some((kw) => text.toLowerCase().includes(kw))) {
          this.clearSession(userId);
          await message.replyText(
            `✅ Đã huỷ tra cứu Duolingo.\n\nGõ /help để xem các lệnh hỗ trợ.`,
          );
          return;
        }

        // Nhận username → thực hiện lookup
        this.clearSession(userId);
        await this.executeDuolingoLookup(message, text);
        return;
      }
    }

    // Nếu không thuộc lệnh /xxx và không có session nào đang chờ
    // → Chuyển câu hỏi cho AI trả lời tự do (General Chat) như một trợ lý
    try {
      const products = await this.productLookup.getActiveProducts(20);
      let extraContext = "";
      if (products && products.length > 0) {
        extraContext = "Danh sách sản phẩm/gói cước bạn đang bán (Dùng để tư vấn nếu khách hỏi giá hoặc chức năng):\n";
        products.forEach((p, index) => {
          extraContext += `${index + 1}. Gói: ${p.name} | Giá: ${p.price} ${p.currency || "VNĐ"}\n   Mô tả chi tiết: ${p.description || "Không có"}\n`;
        });
      }

      this.gemini.ask(text, extraContext).then((aiResponse) => {
        message.replyText(aiResponse).catch((err) => console.error("[Reply AI Error]", err));
      });
    } catch (err) {
      console.error("[Product Fetch Error before AI]", err);
      // Fallback
      this.gemini.ask(text).then((aiResponse) => {
        message.replyText(aiResponse).catch((err) => console.error("[Reply AI Error]", err));
      });
    }
  }

  /**
   * Handler tự động khi nhận ảnh: AI Vision → username → Duolingo lookup
   *
   * Luồng:
   * 1. Nhận photoUrl từ message
   * 2. Gửi thông báo đang xử lý
   * 3. Gọi Gemini Vision trích xuất username
   * 4a. Tìm thấy username → gọi Duolingo API → trả kết quả đầy đủ
   * 4b. Không tìm thấy → hướng dẫn gõ thủ công
   */
  private async handlePhotoMessage(message: Message): Promise<void> {
    const photoUrl = message.photoUrl;
    console.log("[BotFeature] Nhận được ảnh từ user:", photoUrl);
    
    if (!photoUrl) return;

    await message.replyText(
      `🖼️ Đang phân tích ảnh bằng AI...\nVui lòng chờ vài giây! URL: ${photoUrl.substring(0, 30)}...`,
    );

    // Trích xuất username từ ảnh
    const extractedUsername = await this.gemini.analyzeImageForDuolingoUsername(photoUrl);

    if (!extractedUsername) {
      await message.replyText(
        [
          `❌ Không nhận diện được username Duolingo trong ảnh này.`,
          ``,
          `💡 Để kết quả tốt hơn, thử:`,
          `  • Chụp rõ màn hình profile Duolingo`,
          `  • Đảm bảo username hiện rõ (không bị mờ/cắt)`,
          `  • Chụp từ trang "Friends" có username bên dưới avatar`,
          ``,
          `Hoặc gõ thủ công: /layDuolingoID [username]`,
        ].join("\n"),
      );
      return;
    }

    // Thông báo đã phát hiện username
    await message.replyText(
      `✅ AI nhận diện được username: @${extractedUsername}\n🔍 Đang tra cứu thông tin...`,
    );

    // Thực hiện tra cứu
    await this.executeDuolingoLookup(message, extractedUsername);
  }

  // ──────────────────────────────────────────────────────
  // CORE: DUOLINGO LOOKUP
  // ──────────────────────────────────────────────────────

  /**
   * Hàm cốt lõi: nhận bất kỳ định dạng input → parse → fetch → format → reply
   *
   * Hỗ trợ:
   *   - "username"
   *   - "@username"
   *   - "duolingo.com/profile/xxx"
   *   - "https://www.duolingo.com/profile/xxx"
   */
  private async executeDuolingoLookup(message: Message, rawInput: string): Promise<void> {
    // Parse input để hiểu loại định dạng
    const parsed = this.duolingo.parseInput(rawInput);

    if (!parsed) {
      await message.replyText(
        [
          `❌ Input không hợp lệ: "${rawInput}"`,
          ``,
          `💡 Định dạng hỗ trợ:`,
          `  • suanxon`,
          `  • @suanxon`,
          `  • duolingo.com/profile/suanxon`,
        ].join("\n"),
      );
      return;
    }

    // Phản hồi loại input để user biết hệ thống đang làm gì
    const lookupDesc = this.describeInput(parsed.inputType, parsed.username);
    await message.replyText(`🔍 ${lookupDesc}...`);

    // Gọi API Duolingo
    const profile = await this.duolingo.getUserProfile(rawInput);

    if (!profile) {
      await message.replyText(
        [
          `❌ Không tìm thấy tài khoản Duolingo: "${parsed.username}"`,
          ``,
          `💡 Kiểm tra lại:`,
          `  • Đúng username (không phải email hoặc tên hiển thị)`,
          `  • Tài khoản chưa bị xóa hoặc để riêng tư`,
          `  • Thử copy trực tiếp từ URL: duolingo.com/profile/[username]`,
        ].join("\n"),
      );
      return;
    }

    // Trả kết quả đầy đủ
    await message.replyText(this.duolingo.formatProfileMessage(profile));
  }

  // ──────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────

  private describeInput(
    type: "username" | "at_username" | "profile_url",
    username: string,
  ): string {
    switch (type) {
      case "at_username":
        return `Tra cứu @${username} (đã bỏ @)`;
      case "profile_url":
        return `Tra cứu từ URL profile: ${username}`;
      default:
        return `Tra cứu username: ${username}`;
    }
  }

  private clearSession(userId: string): void {
    const session = this.pendingSessions.get(userId);
    if (session) {
      clearTimeout(session.timerId);
      this.pendingSessions.delete(userId);
    }
  }

  /**
   * Gợi ý khi user gõ lệnh không tồn tại:
   * 1. Nếu trùng khớp gần (fuzzy) với lệnh đã biết → show hint của lệnh đó
   * 2. Không khớp gì → show toàn bộ HELP_MESSAGE
   */
  private suggestForUnknownCommand(cmdToken: string): string {
    // Tìm lệnh khớp gần nhất (startsWith hoặc includes)
    const matchedCmd = [...KNOWN_COMMANDS].find(
      (cmd) => cmd.startsWith(cmdToken) || cmdToken.startsWith(cmd) || cmd.includes(cmdToken),
    );

    if (matchedCmd && COMMAND_HINTS[matchedCmd]) {
      return [
        `❓ Lệnh "/${cmdToken}" không đúng. Ý bạn là:`,
        ``,
        COMMAND_HINTS[matchedCmd],
      ].join("\n");
    }

    // Không khớp gì → trả full help
    return [
      `❓ Lệnh "/${cmdToken}" không tồn tại.`,
      ``,
      HELP_MESSAGE,
    ].join("\n");
  }
}

