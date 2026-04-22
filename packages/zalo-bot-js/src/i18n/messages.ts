export type SupportedLanguage = "vi" | "en";

export type MessageKey =
  | "env.missingToken"
  | "app.pollingStarted"
  | "app.pollingHint"
  | "app.pollingFetchError"
  | "test.tokenValid"
  | "test.botId"
  | "test.displayName"
  | "test.accountName"
  | "test.accountType"
  | "test.unknown"
  | "test.tokenCheckFailed"
  | "test.helloBotFailed"
  | "reply.start"
  | "reply.hello"
  | "error.invalidTokenInput"
  | "error.rejectedToken"
  | "error.invalidGetMePayload"
  | "error.invalidMessagePayload"
  | "error.invalidMessageWithoutChatContext";

type MessageDictionary = Record<MessageKey, string>;

export const messages: Record<SupportedLanguage, MessageDictionary> = {
  vi: {
    "env.missingToken": "Thiếu ZALO_BOT_TOKEN trong file .env.",
    "app.pollingStarted": "Bot đang chạy ở chế độ polling.",
    "app.pollingHint": 'Hãy gửi "/start" hoặc "hello" để kiểm tra bot.',
    "app.pollingFetchError": "Lỗi khi lấy update:",
    "test.tokenValid": "Token hợp lệ.",
    "test.botId": "Bot ID: {value}",
    "test.displayName": "Tên hiển thị: {value}",
    "test.accountName": "Tên tài khoản: {value}",
    "test.accountType": "Loại tài khoản: {value}",
    "test.unknown": "(không rõ)",
    "test.tokenCheckFailed": "Kiểm tra token thất bại.",
    "test.helloBotFailed": "Bot test hello gặp lỗi.",
    "reply.start": "Xin chào! Bot đã nhận lệnh /start.",
    "reply.hello": "Xin chào! Bot đang hoạt động bình thường.",
    "error.invalidTokenInput":
      "Bạn phải truyền token bot lấy từ https://bot.zapps.vn/docs/create-bot/.",
    "error.rejectedToken": "Token bot đã bị máy chủ từ chối.",
    "error.invalidGetMePayload": "Bot API trả về payload getMe không hợp lệ.",
    "error.invalidMessagePayload": "Bot API trả về payload tin nhắn không hợp lệ.",
    "error.invalidMessageWithoutChatContext":
      "Bot API trả về payload tin nhắn không hợp lệ và không có chat_id để suy ra ngữ cảnh.",
  },
  en: {
    "env.missingToken": "Missing ZALO_BOT_TOKEN in .env.",
    "app.pollingStarted": "Bot is running in polling mode.",
    "app.pollingHint": 'Send "/start" or "hello" to test the bot.',
    "app.pollingFetchError": "Error while fetching updates:",
    "test.tokenValid": "Token is valid.",
    "test.botId": "Bot ID: {value}",
    "test.displayName": "Display name: {value}",
    "test.accountName": "Account name: {value}",
    "test.accountType": "Account type: {value}",
    "test.unknown": "(unknown)",
    "test.tokenCheckFailed": "Token check failed.",
    "test.helloBotFailed": "Hello bot test failed.",
    "reply.start": "Hello! The bot received the /start command.",
    "reply.hello": "Hello! The bot is running correctly.",
    "error.invalidTokenInput":
      "You must pass the bot token from https://bot.zapps.vn/docs/create-bot/.",
    "error.rejectedToken": "The bot token was rejected by the server.",
    "error.invalidGetMePayload": "Bot API returned an invalid getMe payload.",
    "error.invalidMessagePayload": "Bot API returned an invalid message payload.",
    "error.invalidMessageWithoutChatContext":
      "Bot API returned an invalid message payload without chat_id context.",
  },
};
