import { formatZaloProductCatalog } from "./messages";
import type { ZaloAssistantRequest, ZaloProductRecord } from "./types";
import { formatNumber } from "@/lib/utils";

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scoreProduct(query: string, product: ZaloProductRecord): number {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(product.name);
  if (!normalizedQuery) return 0;
  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.includes(normalizedQuery)) return 80;
  if (normalizedQuery.includes(normalizedName)) return 60;
  return 0;
}

function sortProductsForFallback(query: string, products: ZaloProductRecord[]): ZaloProductRecord[] {
  return [...products]
    .map((product) => ({ product, score: scoreProduct(query, product) }))
    .sort((left, right) => right.score - left.score || (right.product.sellPriceVnd ?? 0) - (left.product.sellPriceVnd ?? 0))
    .map((item) => item.product);
}

function buildFallbackSalesReply(input: ZaloAssistantRequest): string {
  const matchedProducts = sortProductsForFallback(input.query, input.products).slice(0, 3);
  const intro = input.query
    ? `Mình đã nhận yêu cầu: "${input.query}".`
    : `Mình là trợ lý bán hàng của ${input.config.appName}.`;

  const lines = [intro, ""];

  if (matchedProducts.length > 0) {
    lines.push(formatZaloProductCatalog(matchedProducts));
  } else if (input.config.accountBound) {
    lines.push(
      "Hiện mình chưa thấy sản phẩm phù hợp trong catalog đang cấu hình.",
      "Bạn có thể nhắn /product để xem danh mục hoặc /human để gặp nhân viên.",
    );
  } else {
    lines.push(
      "Bot đang chạy nhưng chưa bind account_id nên catalog và tra cứu đơn chưa bật.",
      "Nhắn /human để gặp nhân viên hoặc cấu hình ZALO_BOT_ACCOUNT_ID để mở đầy đủ tính năng.",
    );
  }

  return lines.join("\n");
}

async function askGemini(input: ZaloAssistantRequest): Promise<string | null> {
  if (!input.config.geminiApiKey) return null;

  const catalogText = input.products.length > 0
    ? input.products
        .slice(0, 8)
        .map((product, index) => {
          const price = formatNumber(Math.round(Number(product.sellPriceVnd) || 0));
          const duration = product.durationType && product.durationValue
            ? `, ${product.durationValue} ${product.durationType === "days" ? "ngày" : product.durationType === "months" ? "tháng" : "năm"}`
            : "";
          return `${index + 1}. ${product.name} - ${price}đ${duration}`;
        })
        .join("\n")
    : "Không có sản phẩm nào trong catalog.";

  const systemPrompt = [
    "Bạn là trợ lý bán hàng Zalo chuyên bán hàng cho ManagerOrder.",
    "Trả lời ngắn gọn, thân thiện, bằng tiếng Việt.",
    "Chỉ dùng dữ liệu catalog được cung cấp.",
    "Không được bịa giá hoặc bịa sản phẩm mới.",
    "Nếu khách cần người thật, hướng dẫn dùng /human hoặc /nhanvien.",
    "Nếu cần xem danh mục, hướng dẫn dùng /product.",
    "Nếu cần tra cứu đơn, hướng dẫn dùng /tracuu <mã đơn|SĐT>.",
  ].join(" ");

  const userPrompt = [
    `App: ${input.config.appName}`,
    `Câu hỏi: ${input.query || "khách đang cần tư vấn bán hàng"}`,
    "",
    "Catalog:",
    catalogText,
  ].join("\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.config.geminiModel)}:generateContent?key=${encodeURIComponent(input.config.geminiApiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 350,
        topP: 0.9,
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) return null;

  type GeminiPart = { text?: unknown };
  type GeminiResponse = {
    candidates?: Array<{
      content?: {
        parts?: GeminiPart[];
      };
    }>;
  };

  const payload = (await response.json()) as GeminiResponse;
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;

  const text = parts
    .map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim();

  return text || null;
}

export async function buildSalesReply(input: ZaloAssistantRequest): Promise<string> {
  try {
    const geminiReply = await askGemini(input);
    if (geminiReply) {
      return geminiReply;
    }
  } catch {
    // Fall back to deterministic response when Gemini is unavailable.
  }

  return buildFallbackSalesReply(input);
}
