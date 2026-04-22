# Tích hợp với n8n

Trang này hướng dẫn bạn kết nối `zalo-bot-js` với n8n theo nhiều cách khác nhau, từ mô hình webhook để nhận update theo thời gian thực đến mô hình polling hoặc gọi chủ động từ workflow.

Nếu bạn đang xây bot cần kết nối CRM, Google Sheets, AI, HTTP API nội bộ hoặc các quy trình tự động hóa đa bước, n8n là lớp orchestration phù hợp để điều phối dữ liệu, còn `zalo-bot-js` đảm nhiệm phần giao tiếp ổn định với Zalo Bot API.

## Khi nào nên dùng n8n cùng `zalo-bot-js`

Bạn nên kết hợp hai thành phần này khi muốn:

- gửi dữ liệu người dùng sang hệ thống khác ngay khi bot nhận được tin nhắn
- thiết kế workflow bằng giao diện kéo thả thay vì viết toàn bộ logic bằng code
- nối bot Zalo với email, Google Sheets, Notion, Slack, Telegram, database hoặc AI services
- tách phần bot runtime và phần business workflow để dễ bảo trì
- xây các flow nhiều bước như xác minh, phân loại, gán trạng thái, thông báo nội bộ và phản hồi lại cho người dùng

## Tổng quan các kiểu kết nối

Hiện tại có bốn mô hình tích hợp thực tế nhất:

### 1. `zalo-bot-js` nhận webhook, sau đó gọi sang n8n

Đây là mô hình nên ưu tiên trong đa số hệ thống production.

Luồng hoạt động:

1. Zalo gửi update đến endpoint webhook của ứng dụng Node.js dùng `zalo-bot-js`.
2. Ứng dụng xác thực `secret_token`, parse update và chuẩn hóa dữ liệu.
3. Ứng dụng gọi HTTP Webhook của n8n, truyền phần dữ liệu cần xử lý.
4. n8n thực hiện workflow: ghi log, gọi API, phân nhánh, dùng AI hoặc lưu dữ liệu.
5. n8n trả kết quả về cho ứng dụng hoặc ứng dụng tự gửi phản hồi về Zalo.

Mô hình này phù hợp khi bạn cần:

- kiểm soát hoàn toàn việc xác thực webhook từ Zalo
- giữ logic xử lý update thô ở Node.js
- giảm rủi ro do n8n phải tự xử lý toàn bộ payload đặc thù của Zalo
- chủ động retry, logging, validation và mapping lỗi

### 2. `zalo-bot-js` làm gateway, n8n chỉ xử lý nghiệp vụ

Đây là biến thể của mô hình webhook nhưng tách vai trò rõ hơn:

- `zalo-bot-js` chịu trách nhiệm nhận update, lọc event, xác minh bảo mật, gửi tin nhắn
- n8n chỉ nhận dữ liệu đã được làm sạch để xử lý nghiệp vụ

Mô hình này phù hợp khi:

- bạn có nhiều workflow và muốn n8n chỉ tập trung vào automation
- bạn muốn giữ API token và logic gửi tin nhắn trong code backend
- bạn cần một lớp điều phối trung gian để tránh khóa chặt hệ thống vào n8n

### 3. n8n chủ động gọi ứng dụng dùng `zalo-bot-js`

Trong mô hình này, n8n không nhận update trực tiếp từ Zalo mà đóng vai trò bộ điều khiển:

1. Workflow n8n được kích hoạt bởi lịch, form, database, CRM hoặc trigger khác.
2. n8n gọi HTTP endpoint nội bộ của ứng dụng Node.js.
3. Ứng dụng Node.js dùng `zalo-bot-js` để gửi tin nhắn, sticker hoặc chat action tới Zalo.

Mô hình này phù hợp cho các tác vụ:

- gửi thông báo chủ động từ workflow
- gửi tin nhắn hàng loạt theo điều kiện từ hệ thống nội bộ
- gửi nhắc lịch, xác nhận đơn, thông báo trạng thái hoặc cảnh báo vận hành

### 4. Polling cục bộ để thử nghiệm, n8n xử lý phía sau

Bạn có thể dùng polling trong giai đoạn local hoặc proof of concept:

1. Bot chạy `startPolling()`.
2. Khi nhận message, ứng dụng gọi webhook của n8n.
3. n8n xử lý dữ liệu và trả kết quả.

Mô hình này phù hợp khi:

- bạn chưa có URL public để nhận webhook
- bạn đang phát triển local
- bạn muốn test nhanh flow bot trước khi triển khai thật

Tuy nhiên, đây không phải lựa chọn tốt nhất cho production dài hạn vì polling tốn tài nguyên hơn và khó đồng bộ vận hành hơn webhook.

## Kiến trúc đề xuất

Với repo hiện tại, kiến trúc dễ bảo trì nhất là:

```text
Zalo Bot API
  -> webhook của ứng dụng Node.js
  -> `zalo-bot-js`
  -> lớp chuẩn hóa dữ liệu bot
  -> HTTP request sang n8n
  -> workflow nghiệp vụ
  -> phản hồi về ứng dụng hoặc ghi trạng thái
  -> `zalo-bot-js` gửi tin nhắn về Zalo
```

Điểm mạnh của kiến trúc này:

- lớp giao tiếp Zalo và lớp tự động hóa được tách rõ
- n8n không phải hiểu toàn bộ logic đặc thù của bot
- dễ thêm logging, rate-limit, retry, xác thực và cache ở phía Node.js
- thuận tiện mở rộng sang nhiều workflow theo từng loại sự kiện

## Dữ liệu nên truyền từ bot sang n8n

Không nên đẩy toàn bộ payload thô nếu workflow chỉ cần vài trường chính. Thay vào đó, nên truyền một object đã được chuẩn hóa như:

```json
{
  "event": "message",
  "chatId": "123456789",
  "userId": "123456789",
  "text": "Xin chào",
  "messageId": "mid_001",
  "timestamp": 1712300000,
  "source": "zalo",
  "locale": "vi"
}
```

Bạn cũng có thể bổ sung:

- thông tin phân loại intent sơ bộ
- metadata của tenant hoặc workspace nội bộ
- trạng thái debug
- correlation id để đối soát log giữa Node.js và n8n

## Cách triển khai khuyến nghị

### Bước 1. Tạo webhook workflow trong n8n

Trong n8n, bạn có thể tạo workflow với node `Webhook` làm điểm vào. Workflow này sẽ nhận dữ liệu từ ứng dụng bot của bạn, ví dụ:

- message text
- chat id
- user id
- event type
- timestamp

Sau đó nối tiếp tới các node như:

- `IF` để phân nhánh theo nội dung
- `HTTP Request` để gọi API nội bộ
- `Code` để xử lý dữ liệu
- `Google Sheets`, `Notion`, `Postgres`, `MySQL`, `Slack`, `OpenAI` hoặc các node tích hợp khác

### Bước 2. Gọi webhook n8n từ ứng dụng bot

Bạn có thể thêm một đoạn gọi HTTP tới webhook n8n ngay sau khi nhận message. Ví dụ sau dùng `fetch` có sẵn của Node.js hiện đại:

```ts
import { Bot } from "zalo-bot-js";

const bot = new Bot({ token: process.env.ZALO_BOT_TOKEN! });

bot.on("message", async (message) => {
  const payload = {
    event: "message",
    chatId: message.chat.id,
    userId: message.from?.id,
    text: message.text ?? null,
    messageId: message.messageId,
    timestamp: message.date ?? null,
    source: "zalo",
  };

  const response = await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await bot.sendMessage(message.chat.id, "Hệ thống đang bận, vui lòng thử lại sau.");
    return;
  }

  const result = await response.json() as { reply?: string };
  if (result.reply) {
    await bot.sendMessage(message.chat.id, result.reply);
  }
});

void bot.startPolling();
```

Nếu bạn dùng webhook thay vì polling, ý tưởng vẫn giữ nguyên: chỉ khác ở chỗ update đi vào qua `processUpdate()` thay vì `startPolling()`.

### Bước 3. Chuẩn hóa định dạng phản hồi từ n8n

Để phía bot dễ xử lý, nên thống nhất đầu ra của n8n theo một format đơn giản như:

```json
{
  "reply": "Chào bạn, mình đã nhận thông tin.",
  "tags": ["lead", "new-user"],
  "handoff": false
}
```

Lợi ích của việc chuẩn hóa:

- bot không phải đoán cấu trúc dữ liệu trả về
- dễ thêm kiểm thử và logging
- dễ mở rộng sang nhiều workflow mà không phải sửa quá nhiều code phía bot

## Tích hợp theo mô hình webhook

Nếu bạn đã có server public, nên dùng webhook. Repo hiện tại đã có ví dụ gần đúng trong `examples/webhook.ts`.

Các thành phần chính của flow này:

1. cấu hình `ZALO_WEBHOOK_URL`
2. tạo `secret_token`
3. gọi `bot.setWebHook()`
4. tạo HTTP server nhận `POST /webhook`
5. kiểm tra header `x-bot-api-secret-token`
6. parse JSON body
7. gọi `bot.processUpdate(payload)`
8. từ callback event, gọi sang n8n hoặc phản hồi trực tiếp

Ví dụ khung xử lý:

```ts
import { createServer } from "node:http";
import { Bot } from "zalo-bot-js";

const bot = new Bot({ token: process.env.ZALO_BOT_TOKEN! });
const secretToken = process.env.ZALO_WEBHOOK_SECRET!;

bot.on("message", async (message) => {
  const workflowResponse = await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "message",
      chatId: message.chat.id,
      text: message.text ?? null,
    }),
  });

  const data = await workflowResponse.json() as { reply?: string };
  if (data.reply) {
    await bot.sendMessage(message.chat.id, data.reply);
  }
});

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.statusCode = 404;
    res.end("not found");
    return;
  }

  if (req.headers["x-bot-api-secret-token"] !== secretToken) {
    res.statusCode = 403;
    res.end("unauthorized");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  await bot.processUpdate(payload);

  res.statusCode = 200;
  res.end("ok");
});

await bot.setWebHook(process.env.ZALO_WEBHOOK_URL!, {
  secret_token: secretToken,
});

server.listen(3000);
```

## Tích hợp theo mô hình polling

Polling phù hợp cho giai đoạn phát triển nhanh hoặc môi trường chưa có public URL.

Ưu điểm:

- khởi động nhanh
- không cần cấu hình reverse proxy hoặc domain public
- dễ debug bằng console

Hạn chế:

- không tối ưu cho production dài hạn
- có độ trễ phụ thuộc chu kỳ polling
- khó scale tốt hơn webhook trong các hệ thống nghiêm túc

Ví dụ:

```ts
import { Bot } from "zalo-bot-js";

const bot = new Bot({ token: process.env.ZALO_BOT_TOKEN! });

bot.on("text", async (message) => {
  const response = await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      event: "text",
      chatId: message.chat.id,
      text: message.text,
    }),
  });

  const data = await response.json() as { reply?: string };
  if (data.reply) {
    await bot.sendMessage(message.chat.id, data.reply);
  }
});

void bot.startPolling();
```

## Để n8n chủ động gửi tin nhắn qua `zalo-bot-js`

Đây là trường hợp workflow n8n được kích hoạt từ nguồn khác, ví dụ:

- cron
- đơn hàng mới
- biểu mẫu đăng ký
- thay đổi trạng thái trong CRM
- cảnh báo từ hệ thống vận hành

Lúc này, bạn nên tạo một API nội bộ trong ứng dụng Node.js để nhận lệnh gửi tin nhắn từ n8n. Ví dụ:

```ts
import { createServer } from "node:http";
import { Bot } from "zalo-bot-js";

const bot = new Bot({ token: process.env.ZALO_BOT_TOKEN! });
const internalSecret = process.env.INTERNAL_API_SECRET!;

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/internal/send-message") {
    res.statusCode = 404;
    res.end("not found");
    return;
  }

  if (req.headers.authorization !== `Bearer ${internalSecret}`) {
    res.statusCode = 401;
    res.end("unauthorized");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    chatId: string;
    text: string;
  };

  await bot.sendMessage(body.chatId, body.text);

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true }));
});

server.listen(3001);
```

Trong n8n, bạn chỉ cần dùng node `HTTP Request` để gọi endpoint này với `Bearer token` tương ứng.

## Thiết kế workflow n8n theo use case

### Use case 1. Trả lời tự động theo từ khóa

Luồng gợi ý:

1. `Webhook`
2. `IF` kiểm tra `text`
3. `Set` hoặc `Code` để tạo câu trả lời
4. trả JSON về ứng dụng bot

Phù hợp khi:

- cần FAQ đơn giản
- cần phân nhánh theo menu cơ bản
- chưa cần AI hoặc database

### Use case 2. Ghi lead từ tin nhắn vào Google Sheets hoặc database

Luồng gợi ý:

1. `Webhook`
2. `Code` hoặc `IF` để bóc tách thông tin
3. `Google Sheets` hoặc `Postgres`
4. `Respond to Webhook`

Phản hồi nên gồm:

- trạng thái đã ghi nhận
- nội dung trả lời ngắn gọn cho người dùng

### Use case 3. Dùng AI để soạn phản hồi

Luồng gợi ý:

1. `Webhook`
2. node AI hoặc `HTTP Request` đến dịch vụ AI
3. `Code` để chuẩn hóa kết quả
4. trả JSON chứa `reply`

Khuyến nghị:

- đặt timeout rõ ràng
- giới hạn độ dài phản hồi
- có câu trả lời fallback nếu AI lỗi hoặc quá chậm

### Use case 4. Handoff sang người thật

Luồng gợi ý:

1. `Webhook`
2. `IF` kiểm tra ý định hoặc từ khóa nhạy cảm
3. gửi thông báo sang Slack, email hoặc CRM
4. trả về cờ `handoff: true`

Phía bot có thể phản hồi:

- đã tiếp nhận yêu cầu
- sẽ có nhân viên liên hệ

## Bảo mật khi kết nối với n8n

Khi triển khai thực tế, nên áp dụng tối thiểu các lớp bảo vệ sau:

- dùng `secret_token` cho webhook Zalo
- không public endpoint nội bộ để n8n gọi nếu không có xác thực
- dùng `Bearer token`, HMAC hoặc IP allowlist cho endpoint nội bộ
- không ghi log toàn bộ token, secret hoặc payload nhạy cảm
- giới hạn dữ liệu người dùng gửi sang n8n theo nguyên tắc tối thiểu cần dùng
- thêm timeout và retry có kiểm soát cho các lệnh gọi giữa bot và n8n

Nếu workflow chứa dữ liệu nhạy cảm, bạn nên:

- mã hóa biến môi trường
- tách môi trường dev và production
- gắn correlation id để audit
- ghi log theo cấp độ, tránh log thô toàn bộ nội dung hội thoại

## Xử lý lỗi và retry

Khi n8n lỗi, đừng để bot im lặng hoàn toàn. Một chiến lược thực tế là:

1. ứng dụng bot gọi n8n với timeout ngắn
2. nếu n8n trả lỗi hoặc quá hạn, bot trả lời câu fallback thân thiện
3. ghi log lỗi cùng correlation id
4. nếu cần, đưa sự kiện vào hàng đợi nội bộ để xử lý lại

Ví dụ fallback:

```ts
try {
  const response = await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`n8n returned ${response.status}`);
  }

  const result = await response.json() as { reply?: string };
  await bot.sendMessage(chatId, result.reply ?? "Mình đã nhận yêu cầu.");
} catch (error) {
  console.error("n8n workflow failed:", error);
  await bot.sendMessage(chatId, "Hệ thống đang bận, vui lòng thử lại sau.");
}
```

## Biến môi trường gợi ý

Bạn có thể mở rộng `.env` với các biến sau:

```dotenv
ZALO_BOT_TOKEN=your_zalo_bot_token_here
ZALO_BOT_LANG=vi
ZALO_WEBHOOK_URL=https://your-domain.example/webhook
ZALO_WEBHOOK_SECRET=replace-with-long-random-string
N8N_WEBHOOK_URL=https://n8n.example/webhook/zalo-inbound
INTERNAL_API_SECRET=replace-with-another-long-random-string
```

Ý nghĩa:

- `ZALO_BOT_TOKEN`: token bot
- `ZALO_BOT_LANG`: ngôn ngữ log runtime
- `ZALO_WEBHOOK_URL`: URL công khai để Zalo gửi update
- `ZALO_WEBHOOK_SECRET`: secret xác minh webhook
- `N8N_WEBHOOK_URL`: endpoint workflow inbound trong n8n
- `INTERNAL_API_SECRET`: secret cho các API nội bộ mà n8n gọi vào

## Cách chọn giữa webhook và polling khi dùng với n8n

Chọn webhook nếu:

- bạn triển khai production
- bạn có domain hoặc URL public ổn định
- bạn cần phản hồi nhanh, rõ ràng, ít độ trễ
- bạn muốn kiến trúc chuẩn để mở rộng lâu dài

Chọn polling nếu:

- bạn đang làm local
- bạn muốn proof of concept nhanh
- bạn chưa có hạ tầng public

## Giới hạn hiện tại cần lưu ý

Khi xây tích hợp với n8n trên repo hiện tại, bạn nên lưu ý:

- SDK hiện tập trung vào bot core và các API chính trước
- multipart media upload vẫn chưa hoàn chỉnh
- chưa có lớp queue worker riêng cho các workflow cần retry phức tạp
- chưa có adapter n8n chuyên biệt, nên cách phù hợp nhất hiện tại là kết nối qua HTTP webhook/API nội bộ

Điều đó có nghĩa là tích hợp với n8n hoàn toàn khả thi, nhưng bạn nên xem n8n là workflow engine ở bên ngoài chứ không phải phần thay thế runtime bot.

## Mẫu chiến lược triển khai thực tế

Nếu bạn muốn triển khai ổn định, có thể đi theo lộ trình sau:

1. bắt đầu bằng polling để xác thực token và luồng xử lý
2. tạo workflow `Webhook` trong n8n để thử phản hồi cơ bản
3. chuyển bot sang webhook khi có URL public
4. chuẩn hóa payload gửi sang n8n và response trả về
5. thêm timeout, retry, audit log và cảnh báo lỗi
6. tách các workflow theo từng use case như lead, support, notification, AI assistant

## Kế tiếp

- Quay lại [Ví dụ và test](./examples.md) để xem các mẫu polling và webhook hiện có trong repo.
- Đọc [Kiến trúc](./architecture.md) nếu bạn muốn đặt phần tích hợp n8n vào đúng lớp trong SDK.

Cập nhật lần cuối: 05/04/2026
