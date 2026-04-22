# Tài Liệu Tích Hợp Zalo Bot - Tính Năng & Luồng Hệ Thống
> Tài liệu kỹ thuật mô tả toàn bộ chức năng, luồng giao tiếp và các dịch vụ tích hợp của hệ thống Zalo Bot JS, phục vụ cho đội ngũ tích hợp cấu hình và vận hành.

---

## 1. Tổng Quan Hệ Thống

Zalo Bot JS là một hệ thống chatbot đa nhiệm được xây dựng theo kiến trúc hướng module (Modular Architecture). Hệ thống tích hợp LLM (Google Gemini V2) và cơ sở dữ liệu Supabase để cung cấp đồng thời tự động hoá tra cứu (Duolingo, Đơn hàng), tư vấn bán hàng bằng AI, và hỗ trợ bàn giao giao tiếp cho nhân viên chăm sóc khách hàng (CSKH).

### 1.1 Khả năng cốt lõi
- **AI-Powered**: Xử lý ngôn ngữ tự nhiên (NLP) và Xử lý Ảnh (Vision AI) để nhận diện yêu cầu và hình ảnh gửi tới.
- **Tương tác Đa luồng**: Hỗ trợ lệnh trực tiếp (Commands) và phiên trò chuyện tương tác (Interactive Sessions) duy trì trạng thái ngữ cảnh.
- **Data-Driven**: Quản trị dữ liệu khách hàng, tra cứu tự động và tích hợp rate-limit thông qua hệ sinh thái Supabase.
- **Zero-downtime Handoff**: Chuyển đổi mượt mà giữa Bot AI và Nhân viên thật.

---

## 2. Danh Sách Tính Năng & Câu Lệnh Phục Vụ Tích Hợp

Hệ thống cung cấp một bộ định tuyến các lệnh (Commands) và bộ bắt sự kiện (Event Listeners) để tự động phản hồi cho người dùng qua Zalo.

| Tính năng | Lệnh điều khiển | Tham số / Xử lý |
|-----------|-----------------|-----------------|
| **Xem menu tính năng** | `/help` | Trả về message hướng dẫn tương tác toàn diện. |
| **Tra cứu ID Duolingo** | `/layDuolingoID [input]` | Hỗ trợ input là `username`, `@username`, hoặc `profile_link`. Nếu không cấp *input*, Bot sẽ mở phiên hỏi, chờ người dùng phản hồi. |
| **Tra cứu đơn hàng** | `/tracuu [keyword]` | Tra cứu thông tin bằng `số điện thoại`, `mã đơn hàng` hoặc `username`. Tích hợp rate-limit: **3 lượt/ngày/user**. |
| **Xem sản phẩm** | `/product` hoặc `/sanpham` | Kéo tức thời danh sách gói cước/sản phẩm đang active từ Database và trình bày cho khách hàng. |
| **Gặp nhân viên CSKH** | `/nhanvien` hoặc `/human` | (Hoặc gõ chữ "gặp nhân viên"). Vô hiệu hóa phân tích bằng AI cho khách hàng này. Đổi trạng thái thành *Human Mode*. |
| **Bật lại AI** | `/ai` | Kết thúc phiên CSKH nhân công, mở lại giao tiếp tự động bằng Gemini AI cho khách hàng. |

---

## 3. Luồng Sự Kiện Tự Động (Auto-Event Workflows)

Bên cạnh các cú pháp Slash Commands, hệ thống tích hợp các luồng bắt sự kiện thông minh không cần cú pháp cố định:

### 3.1. Luồng phân tích hình ảnh thông minh (AI Vision)
- **Kích hoạt**: Khi người dùng gửi một bức ảnh chụp màn hình (ví dụ: ảnh Profile Duolingo).
- **Quy trình xử lý**:
  1. Zalo Bot tiếp nhận sự kiện `photo` có chứa URL hình ảnh.
  2. Báo cáo trạng thái đang xử lý tới User.
  3. Gọi mô hình **Gemini Vision** để đọc trích xuất văn bản (OCR) và filter ra `username` Duolingo trong hình ảnh.
  4. Query Duolingo API bằng username vừa lấy được và trả kết quả hồ sơ đầy đủ (ID gốc, Streak, gói siêu cấp XP) cho User trong vài giây.

### 3.2. Luồng Trợ lý Bán Hàng & Tư vấn Tự do (General AI Chat)
- **Kích hoạt**: Bắt sự kiện `text` từ người dùng nhưng nội dung không phải là một Command.
- **Quy trình xử lý**:
  1. Kiểm tra session hiện tại (Human Mode hay AI Mode).
  2. Nếu là AI Mode: Gọi API tải tất cả các Danh sách khóa học/Sản phẩm đang được kinh doanh trong CSDL.
  3. Gắn thông tin sản phẩm và ngữ cảnh bán hàng (System Prompt) vào cùng tin nhắn của người dùng như một dạng Context Enrichment.
  4. Gemini AI phân tích câu trúc, tạo ra một phản hồi chuyên nghiệp, tự giác tư vấn giá hoặc hướng dẫn khách dựa trên bảng quy tắc có sẵn.

---

## 4. Các Backend Dịch Vụ (Service Dependencies)

Để hệ thống hoạt động đầy đủ tại môi trường thực tế, Zalo Bot JS quy hoạch các services dưới đây mà bên Tích hợp cần đặc biệt lưu ý và đảm bảo:

1. **Bot Engine Core**: Nền tảng xử lý Polling/Webhook được tuỳ biến riêng từ các Zalo Official Account API.
2. **GeminiAIService**: Khởi tạo API với model `gemini-2.0-flash`. Xử lý tạo phản hồi tư vấn và trích xuất ảnh.
3. **DuolingoService**: Xử lý việc Fetch và Parse cấu trúc Profile từ API công khai/nội bộ của hạ tầng giáo dục.
4. **OrderLookupService** & **ProductLookupService**: Module giao diện với Table Orders/Products trong Supabase.
5. **RateLimitService**: Theo dõi lượt gọi (Track usage queries) lưu trực tiếp tại Supabase để hạn chế SPAM request từ một người dùng (`maxQueriesPerDay`).
6. **ZaloUserTracker & SupabaseCustomerTracker**: Hệ thống Customer Data (CDP) tự động upsert mỗi khi user nhắn tới (Lưu ID Zalo, Tên, Mode hiện tại, và log lại lịch sử tìm kiếm các ID/Đơn hàng).

---

## 5. Dành cho Bên Triển Khai Integration

Để bên thứ 3 (hoặc đội triển khai) liên kết dễ dàng:

### Cấu hình biến môi trường (`.env`)
```env
# Xác thực OA Bot
ZALO_BOT_TOKEN="Token kết nối ZALO (chính thức hoặc test)"
ADMIN_ZALO_USER_IDS="Các Zalo UserID có quyền admin theo dõi status"

# Kết nối CSDL Khách hàng, Đơn hàng, SP
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="your-service-role-key"

# AI Inference
GEMINI_API_KEY="AI API Key để chat & vision"

# Phân vùng Data Tenant 
ACCOUNT_ID="default"
```

### Triển khai Webhook
- Hiện tại Bot đang chạy `Polling Mode` để phục vụ Test/Dev. Khi deploy lên Production Server, cần tích hợp gọi lệnh `setWebHook(URL)` ở khối `Bot.ts` thông qua việc expose một Express route (`POST /webhook/zalo`).
- Data Model `Update` và `Message` đã được ánh xạ Map thành class, bên tích hợp hoàn toàn truyền raw webhook body vào `bot.processUpdate(req.body)` để routing tiếp đến các Handler một cách ổn định.

---
Văn bản kiến trúc được tổng hợp từ Mã Nguồn Zalo Bot JS (04/2026). Sẵn sàng phục vụ trao đổi tích hợp.
