# Hệ thống Telegram Notifications — ManagerOrder

> Phân tích hiện trạng + Đề xuất nâng cấp toàn diện

---

## Phần 1: Hiện trạng

### 1.1 Tổng quan kiến trúc

```
┌────────────────────────────────────────────────────┐
│              Vercel Cron Scheduler                  │
│  (vercel.json: schedule triggers)                   │
├──────┬──────────┬───────────┬──────────────────────┤
│  6AM │   8AM    │   9AM     │   11PM               │
│  9PM │          │           │                      │
│      │          │           │                      │
│  ▼   │    ▼     │     ▼     │     ▼                │
│ Tel  │ Order    │  Auto-    │  Revenue             │
│ Rem  │ Expiry   │  Escal.   │  Report              │
├──────┴──────────┴───────────┴──────────────────────┤
│           sendTelegramMessage()                     │
│        lib/utils/telegram.ts                        │
├────────────────────────────────────────────────────┤
│         Telegram Bot API (HTML parse)               │
│         → 1 chat_id (TELEGRAM_CHAT_ID)              │
└────────────────────────────────────────────────────┘
```

### 1.2 Các thành phần

| # | Thành phần | File | Schedule |
|---|------------|------|----------|
| 1 | **Telegram Util** | `src/lib/utils/telegram.ts` | — |
| 2 | **Calendar Reminder** | `src/app/api/cron/telegram-reminder/route.ts` | 6AM + 9PM |
| 3 | **Order Expiry Reminder** | `src/app/api/cron/order-expiry-reminder/route.ts` | 8AM daily |
| 4 | **Premium Renewal Reminder** | `src/app/api/cron/premium-renewal-reminder/route.ts` | 9AM daily |
| 5 | **Premium Health Check** | `src/app/api/cron/premium-health-checks/route.ts` → `premium-health-checks.service.ts` | 10:15AM daily |
| 6 | **Revenue Report** | `src/app/api/cron/revenue-report/route.ts` | 11PM daily |
| 7 | **Auto-Escalation** | `src/app/api/cron/auto-escalation/route.ts` → `escalation.service.ts` | 9AM daily |

### 1.3 Chi tiết từng thành phần

#### 🔧 Telegram Util (`telegram.ts`)

```typescript
// Chức năng:
// - escapeHtml(text) → escape HTML special chars
// - formatCurrency(amount) → "1.234.567₫"
// - formatDate(dateStr) → "DD/MM/YYYY"
// - sendTelegramMessage(message) → fetch Telegram Bot API

// Đặc điểm:
// - Timeout: 10 giây
// - Parse mode: HTML
// - 1 chat_id duy nhất từ env
// - Không retry, không queue
```

#### 📅 Calendar Reminder

```
Trigger: 6AM + 9PM hàng ngày
Flow:
  1. Query tất cả calendar_events ngày hôm nay (cross-account)
  2. Group events theo type (gia hạn, nợ, custom)
  3. Format HTML message với emojis + KH details
  4. Gửi 1 message tổng hợp → Telegram

Vấn đề:
  ❌ Copy code sendTelegramMessage riêng (không dùng shared util)
  ❌ Không timeout
  ❌ Cross-account (gộp tất cả accounts vào 1 message)
```

#### ⏰ Order Expiry Reminder

```
Trigger: 8AM hàng ngày
Flow:
  1. Query đơn hàng active sắp hết hạn
  2. Phân tier:
     - T-7: "Nhắc nhở" (🔵)
     - T-3: "Cảnh báo" (🟡)  
     - T-1: "Khẩn cấp" (🔴)
  3. Check idempotency → reminder_logs (tránh gửi trùng)
  4. Gửi tối đa 20 messages/lần
  5. Log sent/failed vào reminder_logs

Điểm mạnh:
  ✅ Idempotency check qua reminder_logs
  ✅ Tiered messaging (3 mức)
  ✅ Giới hạn 20 messages/run
  ✅ Dùng shared util telegram.ts
```

#### 💰 Revenue Report

```
Trigger: 11PM hàng ngày  
Flow:
  1. Query orders trong kỳ (daily/weekly)
  2. Tính: doanh thu, đơn mới, đơn paid, nợ
  3. So sánh với kỳ trước (% change)
  4. Format báo cáo HTML
  5. Gửi → Telegram
  6. Fallback: gửi error notification nếu lỗi critical

Điểm mạnh:
  ✅ Period comparison (vs previous)
  ✅ Error fallback notification
  ✅ Dùng shared util
```

#### 🚨 Auto-Escalation

```
Trigger: 9AM hàng ngày
Flow:
  1. Query đơn quá hạn thanh toán
  2. Evaluate rules:
     - Level 1: Reminder (quá 7 ngày)
     - Level 2: Warning (quá 14 ngày)
     - Level 3: Lock service (quá 30 ngày → status='expired')
     - Level 4: Admin notification (quá 60 ngày)
  3. Check idempotency → reminder_logs
  4. Execute actions (send telegram + update order status)
  5. Log results

Điểm mạnh:
  ✅ 4 mức escalation
  ✅ Tự động lock service (update DB)
  ✅ Idempotency check
  ✅ Configurable rules
```

---

## Phần 2: Hạn chế phát hiện

### 🔴 Critical

| # | Hạn chế | Impact |
|---|---------|--------|
| 1 | **1 chat_id duy nhất** | Mọi thông báo gửi vào 1 group → không phân quyền, noise cao |
| 2 | **Code trùng lặp** | `telegram-reminder/route.ts` copy `sendTelegramMessage` thay vì import shared util → maintain khó |
| 3 | **Không retry** | Shared util fail → message mất, không retry → miss critical alerts |

### 🟡 Important

| # | Hạn chế | Impact |
|---|---------|--------|
| 4 | **Không queue** | Gửi tuần tự → 1 fail chặn hết → partial delivery |
| 5 | **Không rate limit** | Telegram API limit 30 msg/s → nhiều đơn có thể bị block |
| 6 | **Cross-account mixing** | Calendar reminder gộp events tất cả accounts vào 1 message |

### 🟢 Nice-to-have

| # | Hạn chế | Impact |
|---|---------|--------|
| 7 | **Không interactive** | Chỉ text 1 chiều → admin không thể "mark as done" trực tiếp |
| 8 | **Không per-user config** | Không thể chọn nhận/không nhận loại thông báo nào |
| 9 | **Không multi-channel** | Chỉ Telegram, không fallback Email/Zalo khi Telegram down |
| 10 | **Không metrics** | Không tracking delivery rate, read rate |

---

## Phần 3: Đề xuất nâng cấp

### Upgrade 1: Refactor code trùng lặp ⭐

**Độ ưu tiên:** 🔴 Cao | **Phức tạp:** Thấp | **Estimate:** 1-2h

**Vấn đề:** `telegram-reminder/route.ts` define lại `sendTelegramMessage` riêng biệt với `lib/utils/telegram.ts`.

**Giải pháp:**
```typescript
// telegram-reminder/route.ts
// BEFORE: inline sendTelegramMessage
// AFTER:
import { sendTelegramMessage } from '@/lib/utils/telegram';
```

**Checklist:**
- [ ] Xóa local `sendTelegramMessage` trong `telegram-reminder/route.ts`
- [ ] Import từ shared util
- [ ] Verify gửi message thành công
- [ ] Thêm timeout 10s (đã có trong shared util)

---

### Upgrade 2: Retry queue + Error handling ⭐

**Độ ưu tiên:** 🔴 Cao | **Phức tạp:** Trung bình | **Estimate:** 4-6h

**Giải pháp:** Enhanced `sendTelegramMessage` với retry logic:

```typescript
// lib/utils/telegram.ts — enhanced
interface TelegramOptions {
  maxRetries?: number;     // default: 3
  retryDelay?: number;     // default: 1000ms (exponential)
  priority?: 'high' | 'normal' | 'low';
}

async function sendTelegramMessage(
  message: string, 
  chatId?: string,         // support multiple chat_ids
  options?: TelegramOptions
): Promise<TelegramResult> {
  const { maxRetries = 3, retryDelay = 1000 } = options ?? {};
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetch(/* ... */, {
        signal: AbortSignal.timeout(10_000),
      });
      
      if (result.ok) return { success: true, attempt };
      
      // Rate limit → wait and retry
      if (result.status === 429) {
        const retryAfter = result.headers.get('Retry-After');
        await sleep(Number(retryAfter) * 1000 || retryDelay * attempt);
        continue;
      }
      
      throw new Error(`Telegram API error: ${result.status}`);
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Telegram failed after ${maxRetries} attempts`, error);
        return { success: false, error, attempt };
      }
      await sleep(retryDelay * Math.pow(2, attempt - 1)); // Exponential backoff
    }
  }
}
```

**Checklist:**
- [ ] Thêm retry logic với exponential backoff
- [ ] Handle rate limit (HTTP 429)
- [ ] Return structured result (success/fail + attempt count)
- [ ] Support custom `chatId` parameter
- [ ] Log thất bại cuối cùng vào `reminder_logs`

---

### Upgrade 3: Multi-chat support 📢

**Độ ưu tiên:** 🟡 Trung bình | **Phức tạp:** Trung bình | **Estimate:** 6-8h

**Giải pháp:** Bảng `notification_channels` cho phép cấu hình nhiều Telegram group per account.

```sql
-- New table
CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  channel_type TEXT NOT NULL DEFAULT 'telegram', -- 'telegram', 'email', 'zalo'
  channel_config JSONB NOT NULL,
  -- telegram: { chat_id: "-100xxx", bot_token: "optional override" }
  -- email: { to: ["admin@company.com"], smtp_config: {...} }
  notification_types TEXT[] NOT NULL DEFAULT '{}',
  -- ['order_expiry', 'revenue_report', 'escalation', 'calendar']
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Example data
INSERT INTO notification_channels (account_id, channel_type, channel_config, notification_types)
VALUES
  ('acc-1', 'telegram', '{"chat_id": "-1001111"}', '{"order_expiry", "escalation"}'),
  ('acc-1', 'telegram', '{"chat_id": "-1002222"}', '{"revenue_report"}'),
  ('acc-2', 'telegram', '{"chat_id": "-1003333"}', '{"calendar", "order_expiry"}');
```

**Updated send logic:**
```typescript
async function sendNotification(
  accountId: string,
  notificationType: string,
  message: string
) {
  // 1. Query active channels for this account + type
  const channels = await getChannels(accountId, notificationType);
  
  // 2. Send to each channel
  const results = await Promise.allSettled(
    channels.map(ch => sendToChannel(ch, message))
  );
  
  return results;
}
```

---

### Upgrade 4: Inline keyboard buttons 🎮

**Độ ưu tiên:** 🟡 Trung bình | **Phức tạp:** Trung bình | **Estimate:** 8-12h

**Giải pháp:** Thêm inline buttons cho phép admin tương tác trực tiếp từ Telegram.

```typescript
// Enhanced sendTelegramMessage với inline keyboard
async function sendTelegramMessageWithButtons(
  message: string,
  buttons: InlineButton[][],
  chatId?: string
) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId || TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons
      }
    })
  });
}

// Usage — Order Expiry
sendTelegramMessageWithButtons(
  '🔴 Đơn #123 hết hạn trong 1 ngày!',
  [
    [
      { text: '✅ Đã xử lý', callback_data: 'handled:order:123' },
      { text: '👀 Xem đơn', url: 'https://app.example.com/orders/123' }
    ],
    [
      { text: '📞 Liên hệ KH', callback_data: 'contact:customer:456' }
    ]
  ]
);
```

**Cần thêm:**
- Webhook endpoint `/api/webhooks/telegram` để nhận callback
- Handler cho các callback actions
- Update order status khi admin bấm "Đã xử lý"

---

### Upgrade 5: Notification preferences ⚙️

**Độ ưu tiên:** 🟢 Thấp | **Phức tạp:** Cao | **Estimate:** 12-16h

**Giải pháp:** UI Settings cho phép mỗi admin user cấu hình nhận/tắt từng loại thông báo.

```sql
-- New table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES admin_users(id),
  account_id UUID REFERENCES accounts(id),
  preferences JSONB NOT NULL DEFAULT '{
    "order_expiry": true,
    "revenue_report": true,
    "escalation": true,
    "calendar_reminder": true,
    "system_alerts": true
  }',
  telegram_chat_id TEXT,  -- per-user chat_id (DM thay vì group)
  quiet_hours JSONB,      -- { start: "22:00", end: "07:00" }
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**UI Component:**
```
Settings → Notifications Tab
  ┌──────────────────────────────────────┐
  │ 🔔 Notification Preferences          │
  │                                      │
  │ ☑ Đơn hết hạn (Order Expiry)        │
  │ ☑ Báo cáo doanh thu (Revenue)       │
  │ ☑ Leo thang nợ (Escalation)         │
  │ ☑ Lịch nhắc nhở (Calendar)          │
  │ ☑ Cảnh báo hệ thống (System)       │
  │                                      │
  │ 🔇 Quiet Hours: 22:00 — 07:00       │
  │ 📱 Personal Telegram: @username      │
  └──────────────────────────────────────┘
```

---

### Upgrade 6: Multi-channel fallback 🌐

**Độ ưu tiên:** 🟢 Thấp | **Phức tạp:** Cao | **Estimate:** 16-24h

**Giải pháp:** Notification service hỗ trợ nhiều kênh với fallback cascading.

```typescript
// lib/services/notification.service.ts
class NotificationService {
  private channels: NotificationChannel[] = [
    new TelegramChannel(),     // Primary
    new EmailChannel(),        // Fallback 1
    new ZaloOAChannel(),       // Fallback 2
  ];

  async send(notification: Notification): Promise<DeliveryResult[]> {
    for (const channel of this.channels) {
      const result = await channel.send(notification);
      if (result.success) return [result];
      
      console.warn(`${channel.name} failed, trying next channel...`);
    }
    
    // All channels failed
    throw new NotificationDeliveryError('All channels exhausted');
  }
}

interface NotificationChannel {
  name: string;
  send(notification: Notification): Promise<DeliveryResult>;
}
```

**Các kênh hỗ trợ:**

| Kênh | Provider | Mô tả |
|------|----------|--------|
| Telegram | Telegram Bot API | Primary — đang dùng |
| Email | SMTP / SendGrid / Resend | Fallback — gửi email digest |
| Zalo OA | Zalo Official Account API | Fallback — cho KH Việt Nam |

---

## Phần 4: Roadmap đề xuất

```
Phase 1 (1 ngày):
  ✅ Upgrade 1: Refactor code trùng lặp
  ✅ Upgrade 2: Retry queue + Error handling

Phase 2 (3 ngày):  
  ✅ Upgrade 3: Multi-chat support
  ✅ Upgrade 4: Inline keyboard buttons

Phase 3 (1 tuần):
  ✅ Upgrade 5: Notification preferences
  ✅ Upgrade 6: Multi-channel fallback
```

### Tổng effort estimate: ~47-66h (~2-3 tuần)

---

## Phần 5: Quick Reference

### Tạo Telegram Bot

```
1. Chat @BotFather trên Telegram
2. /newbot → đặt tên bot
3. Copy token → TELEGRAM_BOT_TOKEN
4. Thêm bot vào group
5. Lấy chat_id: https://api.telegram.org/bot<TOKEN>/getUpdates
6. Copy chat_id → TELEGRAM_CHAT_ID
```

### Telegram API Limits

| Limit | Value |
|-------|-------|
| Messages per second (to same chat) | 1 msg/s |
| Messages per second (different chats) | 30 msg/s |
| Message length | 4096 characters |
| Inline keyboard buttons per row | 8 |
| Inline keyboard rows | 100 |

### Test gửi message thủ công

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "<CHAT_ID>", "text": "Test message", "parse_mode": "HTML"}'
```

---

*Cập nhật: 2026-03-14*
