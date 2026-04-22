import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

export interface GeminiAIConfig {
  apiKey: string;
  modelName?: string;
  maxOutputTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

const FALLBACK_MESSAGE = `Xin lỗi, hệ thống AI đang tạm thời quá tải. Vui lòng thử lại sau hoặc nhắn 'gặp nhân viên' để được hỗ trợ trực tiếp.

Em Dương Minh Hoàng hiện đang không online nếu mọi người có vấn đề cần hỗ trợ gấp cứ gọi em qua hotline 0394497949 với ạ. Còn nếu cần đăng kí Duolingo Super gói 6 tháng 68k hoặc 123k cho 12 tháng thì chỉ việc cho em xin tên đăng nhập duolingo + gói đăng kí để khi online em hỗ trợ mọi người đăng kí nhanh nhất ạ. Ngoài ra em còn có các gói Capcut Pro, ChatGPT, Gemini AI, Grok, Canva Pro, ... nhiều dịch vụ khác nữa có ai cần gì cứ báo em hỗ trợ cho ạ. (Nếu mọi người đang dùng mà gặp lỗi Duolingo thì cho em xin lại tên đăng nhập + link bữa trước em gửi để em kiểm tra và hỗ trợ mình nhanh nhất ạ). Em xin chân thành cảm ơn ạ
Facebook : https://web.facebook.com/Duong.Minh.Hoang.edu.vn

Dạ đây là STK ngân hàng của em ạ🥰
STK: 0394497949
Ngân Hàng: MB Bank, Vietin Bank, TP bank, Timo Hoặc MOMO
Chủ Tài Khoản: Dương Minh Hoàng`;

const DEFAULT_SYSTEM_PROMPT = `Bạn là trợ lý bán hàng AI chuyên nghiệp của cửa hàng.
- NGUYÊN TẮC TỐI THƯỢNG: BẠN CHỈ TƯ VẤN VỀ SẢN PHẨM/GÓI ĐĂNG KÝ MÀ BẠN ĐƯỢC CUNG CẤP TRONG NGỮ CẢNH.
- KHÔNG trả lời các câu hỏi về kiến thức chung, code, toán học, chính trị, hay bất cứ gì ngoài lề. Nếu khách hỏi ngoài lề, từ chối một cách khéo léo và lái câu chuyện về các gói dịch vụ/sản phẩm mà cửa hàng đang bán.
- Trả lời ngắn gọn, thân thiện, chính xác và hướng tới việc chốt sale.
- Nếu khách hỏi về giá/gói dịch vụ, hãy tư vấn nhiệt tình dựa trên thông tin bạn được cung cấp.
- Nếu khách báo lỗi/sự cố, hướng dẫn họ nhắn chữ 'gặp nhân viên' để được hỗ trợ trực tiếp.
- Tuân thủ pháp luật Việt Nam trong mọi tư vấn. Không hứa hẹn những gì không có trong thông tin sản phẩm.
[NGỮ CẢNH CỬA HÀNG VÀ THÔNG TIN LIÊN HỆ CỦA BẠN]:
Em Dương Minh Hoàng hiện đang không online nếu mọi người có vấn đề cần hỗ trợ gấp cứ gọi em qua hotline 0394497949 với ạ. Còn nếu cần đăng kí Duolingo Super gói 6 tháng 68k hoặc 123k cho 12 tháng thì chỉ việc cho em xin tên đăng nhập duolingo + gói đăng kí để khi online em hỗ trợ mọi người đăng kí nhanh nhất ạ. Ngoài ra em còn có các gói Capcut Pro, ChatGPT, Gemini AI, Grok, Canva Pro, ... nhiều dịch vụ khác nữa có ai cần gì cứ báo em hỗ trợ cho ạ. (Nếu mọi người đang dùng mà gặp lỗi Duolingo thì cho em xin lại tên đăng nhập + link bữa trước em gửi để em kiểm tra và hỗ trợ mình nhanh nhất ạ). Em xin chân thành cảm ơn ạ
Facebook : https://web.facebook.com/Duong.Minh.Hoang.edu.vn

Dạ đây là STK ngân hàng của em ạ🥰
STK: 0394497949
Ngân Hàng: MB Bank, Vietin Bank, TP bank, Timo Hoặc MOMO
Chủ Tài Khoản: Dương Minh Hoàng`;

export class GeminiAIService {
  private model: GenerativeModel;
  private readonly systemPrompt: string;

  constructor(config: GeminiAIConfig) {
    if (!config.apiKey) {
      throw new Error("GEMINI_API_KEY is required for GeminiAIService");
    }

    const genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = genAI.getGenerativeModel({
      model: config.modelName ?? "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: config.maxOutputTokens ?? 500,
        temperature: config.temperature ?? 0.7,
      },
    });
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Stateless AI call với retry tự động (tối đa 2 lần).
   * Short-circuit cho tin nhắn quá ngắn để tiết kiệm quota.
   */
  async ask(question: string, extraContext?: string): Promise<string> {
    const trimmed = question.trim();

    // Short-circuit: câu < 3 ký tự không cần gọi AI
    if (trimmed.length < 3) {
      return "Bạn có thể mô tả chi tiết hơn để em hỗ trợ tốt nhất không ạ? 😊";
    }

    const prompt = [
      `[System Instructions]\n${this.systemPrompt}`,
      extraContext ? `\n[Ngữ cảnh bổ sung]\n${extraContext}` : "",
      `\n[Câu hỏi khách hàng]\n${trimmed}`,
    ].join("");

    const MAX_RETRIES = 2;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const result = await this.model.generateContent(prompt);
        const text = result.response.text();
        return text || "Xin lỗi, tôi không thể xử lý yêu cầu này lúc này.";
      } catch (error: unknown) {
        lastError = error;
        const errMsg = error instanceof Error ? error.message : String(error);
        const isRetryable =
          errMsg.includes("429") ||
          errMsg.includes("503") ||
          errMsg.includes("overloaded") ||
          errMsg.includes("RESOURCE_EXHAUSTED");

        console.error(`[GeminiAI] Error (attempt ${attempt}/${MAX_RETRIES + 1}):`, errMsg.slice(0, 200));

        if (isRetryable && attempt <= MAX_RETRIES) {
          const delayMs = attempt * 2000; // 2s, 4s
          console.log(`[GeminiAI] Rate-limited, retrying in ${delayMs}ms...`);
          await new Promise<void>((r) => setTimeout(r, delayMs));
          continue;
        }
        break;
      }
    }

    console.error("[GeminiAI] All retries exhausted. Returning fallback.");
    return FALLBACK_MESSAGE;
  }

  /**
   * Phân tích ảnh để trích xuất Duolingo username
   */
  async analyzeImageForDuolingoUsername(imageUrl: string): Promise<string | null> {
    try {
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.warn(`[GeminiAI] Failed to fetch image: HTTP ${response.status} - ${response.statusText}`, imageUrl);
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      const prompt = [
        "Phân tích hình ảnh này và tìm tên đăng nhập (username) của tài khoản Duolingo.",
        "Lưu ý quan trọng để lấy ĐÚNG username trong trang profile:",
        "- Là dòng chữ nhỏ nằm BÊN DƯỚI khung Avatar chung và tên hiển thị (tên to).",
        "- Nằm bên cạnh (hoặc gần) dòng chữ ghi năm tham gia (ví dụ: Joined 2020).",
        "- Thường CÓ CHỮ @ ở đầu, hoặc là định dạng viết liền KHÔNG CÓ KHOẢNG CÁCH.",
        "- TRÁNH tuyệt đối lấy nhầm các dòng chữ vô nghĩa, tên hiển thị có khoảng trắng, hoặc tên các achievement.",
        "",
        "Trả về CHÍNH XÁC một trong hai dạng JSON sau:",
        '1. JSON: {"username": "tên_username"} - nếu tìm thấy username',
        '2. JSON: {"username": null} - nếu không tìm thấy',
        "",
        "KHÔNG giải thích thêm. Chỉ trả JSON thuần túy.",
      ].join("\n");

      const result = await this.model.generateContent([
        {
          inlineData: {
            data: base64,
            mimeType: contentType as "image/jpeg" | "image/png" | "image/webp",
          },
        },
        prompt,
      ]);

      const text = result.response.text().trim();

      const jsonMatch = text.match(/\{[^}]+\}/);
      if (!jsonMatch) {
        console.warn("[GeminiAI] No JSON in response:", text.slice(0, 100));
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]) as { username?: string | null };
      const username = parsed.username;

      if (!username || typeof username !== "string") {
        return null;
      }

      return username.startsWith("@") ? username.slice(1).trim() : username.trim();
    } catch (error) {
      console.error("[GeminiAI] analyzeImageForDuolingoUsername error:", error);
      return null;
    }
  }

  /**
   * Cập nhật system prompt (runtime hot-swap).
   */
  updateSystemPrompt(newPrompt: string): void {
    (this as unknown as { systemPrompt: string }).systemPrompt = newPrompt;
  }
}
