# Kế hoạch Tích hợp Trợ lý AI Gemini vào Zalo Bot (PLAN)

## 1. Mục tiêu Dự án
- Nâng cấp Zalo Bot JS hiện tại bằng cách tích hợp trí tuệ nhân tạo (Google Gemini 3.1 Pro).
- Xây dựng cơ chế hỏi đáp tự động thông minh (Chatbot AI) để tiếp nhận và trả lời khách hàng qua Zalo OA.
- Tối ưu luồng dữ liệu (Context Flow) giúp AI hiểu ngữ cảnh chat và phản hồi chính xác.

## 2. Socratic Gate (Các câu hỏi cần làm rõ trước khi triển khai CODE)
> **THÔNG TIN CẦN XÁC NHẬN TỪ BẠN:**
1. **Lưu trữ Ngữ cảnh (Context):** Bạn có muốn lưu lịch sử chat vào Database (vd: Supabase/Redis) để AI có thể nhớ những câu chat trước đó của người dùng không, hay chỉ cần hỏi-đáp cơ bản (stateless)?
2. **Quyền xử lý:** AI sẽ tự động trả lời MỌI tin nhắn hay chỉ trả lời khi có prefix nhất định (VD: `!ai` hoặc `hỏi bot:`)? 
3. **Chỉ dẫn (System Prompt):** Bạn muốn tính cách của bot (Persona) như thế nào? (VD: Lịch sự ân cần, hay tập trung chốt sale, chuyên gia kỹ thuật).
4. **Giới hạn Lọc:** Có cần cơ chế Human-handoff (cho phép người dùng gõ "gặp nhân viên" để bot ngưng AI và chuyển cho sale/CSKH không)?

## 3. Kiến trúc Đề xuất (Phase Breakdown)
Dưới đây là các giai đoạn triển khai sau khi chốt được thông số:

### Phase 1: Preparation & Setup
- Bổ sung cấu hình API Key cho Google Gemini vào `.env` (`GEMINI_API_KEY`).
- Khởi tạo service `GeminiAIService` trong hệ thống (thư mục `src/services/` hoặc `src/ai/`).
- Import `@google/generative-ai` và cấu hình hệ thống Model (Gemini 1.5 Pro hoặc Gemini 1.5 Flash tùy theo tối ưu chi phí).

### Phase 2: Context & Memory Management
- Xây dựng module quản lý lịch sử trò chuyện (Conversation Memory).
- Tạo cơ chế lưu History theo Zalo User ID (tối thiểu lưu 10-20 tương tác gần nhất).

### Phase 3: Bot Handler Integration
- Đăng ký sự kiện vào Zalo Bot SDK:
  `bot.on('message', handleAIMessage)`
- Viết Logic:
  - Nhận tin nhắn từ Zalo -> Phân loại -> Đẩy qua `GeminiAIService`.
  - Lấy kết quả từ Gemini -> Gửi trả lại bằng API Zalo OA (`client.sendTextMessage()`).

### Phase 4: Tính năng Human-handoff (Nếu có)
- Cơ chế pause AI nếu người dùng muốn "Gặp nhân viên hỗ trợ".
- Reset trạng thái AI sau thời gian timeout.

## 4. Phân công Nguồn lực (Agent Assignments)
- **Antigravity (AI)**: Đóng vai trò Backend Engineer, Code integration Zalo Bot và Gemini AI.
- **Bot QA Tester**: Sẽ dùng `test/bot-api.js` hoặc file example mới để kiểm thử độ trễ, khả năng xử lý của Bot.

## 5. Verification Checklist (Kiểm định)
- [ ] Bot phản hồi tin nhắn tự động có logic AI của Gemini.
- [ ] Bảo mật: Không expose API key ra logs (Tuân thủ `security.md`).
- [ ] Maintainability: Service tách rời, có thể dễ dàng thay đổi config system prompt của AI sau này.
- [ ] Token Limits: Cấu hình giới hạn Token an toàn để không bị dùng quá tay.

---
Vui lòng xem qua phần **Socratic Gate** (Câu hỏi số 2) và cho tôi biết lựa chọn của bạn, tôi sẽ tiến hành triển khai Code khi bạn sẵn sàng!
