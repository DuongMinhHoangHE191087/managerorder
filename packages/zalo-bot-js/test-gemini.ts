/**
 * Test toàn diện GeminiAIService với retry logic
 * Chạy: npx tsx test-gemini.ts
 */
import "dotenv/config";
import { GeminiAIService } from "./src/ai/GeminiAIService";

async function testGemini() {
  const apiKey = (process.env.GEMINI_API_TOKEN || process.env.GEMINI_API_KEY)?.trim();
  
  if (!apiKey) {
    console.error("❌ Không tìm thấy GEMINI_API_TOKEN trong .env!");
    process.exit(1);
  }
  
  console.log("🔑 API Key:", apiKey.slice(0, 15) + "...[REDACTED]");
  console.log("🤖 Model: gemini-2.5-flash\n");

  const gemini = new GeminiAIService({
    apiKey,
    modelName: "gemini-2.5-flash",
    maxOutputTokens: 200,
  });

  // Test 1: Short-circuit
  console.log("=== Test 1: Short-circuit (< 3 ký tự) ===");
  const r1 = await gemini.ask("hi");
  console.log("Câu hỏi: 'hi'");
  console.log("Kết quả:", r1);
  console.log();

  // Test 2: Câu hỏi hợp lệ về sản phẩm
  console.log("=== Test 2: Câu hỏi về Duolingo ===");
  const r2 = await gemini.ask("Gói Duolingo Super 6 tháng giá bao nhiêu?");
  console.log("Câu hỏi: 'Gói Duolingo Super 6 tháng giá bao nhiêu?'");
  console.log("Kết quả:", r2.slice(0, 300));
  console.log();

  // Test 3: Câu hỏi ngoài lề  
  console.log("=== Test 3: Câu hỏi ngoài lề (code) ===");
  const r3 = await gemini.ask("Viết cho tôi hàm fibonacci bằng Python");
  console.log("Câu hỏi: 'Viết cho tôi hàm fibonacci bằng Python'");
  console.log("Kết quả:", r3.slice(0, 300));
  console.log();

  console.log("✅ Tests hoàn thành!");
}

testGemini().catch((err) => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
