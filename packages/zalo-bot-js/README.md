# zalo-bot-js

![zalo-bot-js](image/zalo-bot-js.png)

`zalo-bot-js` is a TypeScript SDK for the Zalo Bot API, designed for Node.js developers who want a practical bot runtime with polling, webhook handling, event listeners, message sending APIs, and a TypeScript-friendly structure.

[Docs public](https://kaiyodev.github.io/zalo-bot-js) | [Tiếng Việt](https://kaiyodev.github.io/zalo-bot-js/vi/) | [English docs](https://kaiyodev.github.io/zalo-bot-js/en/)

## What You Get

- A `Bot` client for the Zalo Bot API
- Event-based message handling with `on()` and `onText()`
- Built-in polling runtime with `startPolling()`
- Webhook integration through `processUpdate()` and `setWebhook()`
- Message sending APIs such as `sendMessage()`, `sendPhoto()`, `sendSticker()`, and `sendChatAction()`
- Sequential multi-photo helper `sendPhotos()` with indexed captions
- Handler-based APIs with `Application`, `ApplicationBuilder`, `CommandHandler`, `MessageHandler`, and `filters`

## Who This Is For

This SDK is for developers who want to:

- build a Zalo bot in Node.js or TypeScript
- start quickly with polling before moving to webhook
- organize bot logic with either event listeners or handler-based APIs
- choose event API as default or handler API when command/filter routing is preferred
- integrate bot flows with internal services, workflow engines, or external systems

## Documentation Path

If you are new to the project, the recommended reading order is:

1. [Getting started](https://kaiyodev.github.io/zalo-bot-js/vi/getting-started) to install dependencies, configure `.env`, and run the first bot flow
2. [API Reference](https://kaiyodev.github.io/zalo-bot-js/vi/api-reference) to navigate each method and helper page
3. [Examples and tests](https://kaiyodev.github.io/zalo-bot-js/vi/examples) to choose between polling, webhook, and local verification scripts
4. [Architecture](https://kaiyodev.github.io/zalo-bot-js/vi/architecture) to understand the SDK layers
5. [n8n integration](https://kaiyodev.github.io/zalo-bot-js/vi/n8n) if you want to connect the bot to automation workflows

## Installation

```bash
npm i zalo-bot-js
```

## Environment

```env
ZALO_BOT_TOKEN=your_zalo_bot_token_here
ZALO_BOT_LANG=vi
```

`ZALO_BOT_LANG` currently supports `vi` and `en`.

## Quick Start

```ts
import "dotenv/config";
import { Bot } from "zalo-bot-js";

const bot = new Bot({ token: process.env.ZALO_BOT_TOKEN! });

bot.on("text", async (message) => {
  if (message.text && !message.text.startsWith("/")) {
    await bot.sendMessage(message.chat.id, `Ban vua noi: ${message.text}`);
  }
});

bot.onText(/\/start(?:\s+(.+))?/, async (message, match) => {
  const payload = match[1]?.trim() ?? "ban";
  await bot.sendMessage(message.chat.id, `Xin chao ${payload}!`);
});

void bot.startPolling();
```

This is the fastest path to a working bot:

- create a bot and get its token
- create `.env`
- verify the token
- run polling
- respond to text or commands

Detailed guide: [Getting started](https://kaiyodev.github.io/zalo-bot-js/vi/getting-started)

## Main API Surface

### Bot lifecycle and identity

- `initialize()`
- `shutdown()`
- `cachedUser`
- `getMe()`

### Updates and runtime

- `getUpdate()`
- `getUpdates()`
- `processUpdate()`
- `startPolling()`
- `stopPolling()`
- `isPolling()`

### Sending

- `sendMessage()`
- `sendPhoto()`
- `sendPhotos()`
- `sendSticker()`
- `sendChatAction()`
- `editMessageText()`, `deleteMessage()`, `pinMessage()`, `unpinMessage()`
- `banChatMember()`, `unbanChatMember()`, `promoteChatAdmin()`, `demoteChatAdmin()`
- `setChatKeyboard()`, `deleteChatKeyboard()`
- `uploadFile()`, `getFileInfo()`, `getFileDownloadUrl()`

### Webhook

- `setWebhook()`
- `deleteWebhook()`
- `getWebhookInfo()`

### Event listeners

- `on("message" | "text" | "photo" | "sticker" | "command", callback)`
- `onText(regexp, callback)`
- `command(name, callback)`

### Message helpers

- `message.replyText()`
- `message.replyPhoto()`
- `message.replySticker()`
- `message.replyAction()`

### Handler-based API

- `ApplicationBuilder`
- `Application`
- `CommandHandler`
- `MessageHandler`
- `filters`
- `CallbackContext`

The handler/filter API remains a long-term compatibility layer. Command parsing semantics are shared with event-style `bot.command(...)`, so trimming, case-insensitive matching, and argument parsing behave consistently across both styles.

## Event Shape In This SDK

This project does not expose raw Bot API payloads as the main developer interface. Event callbacks receive SDK models such as `Message` and `Update` metadata.

Example:

```ts
import { Bot } from "zalo-bot-js";

bot.on("message", async (message, metadata) => {
  console.log("[message]", {
    updateId: metadata.update.updateId,
    chatId: message.chat.id,
    messageId: message.messageId,
    fromUserId: message.fromUser?.id,
    messageType: message.messageType,
    eventTypes: metadata.update.eventTypes,
    text: message.text ?? null,
    sticker: message.sticker ?? null,
    photoUrl: message.photoUrl ?? null,
  });
});

bot.on("text", async (message) => {
  console.log("[text]", {
    chatId: message.chat.id,
    text: message.text,
  });
});

bot.onText(/.*/, async (message, match) => {
  console.log("[onText]", {
    chatId: message.chat.id,
    match: match[0],
  });
});
```

## Webhook Flow

For production-style deployments, the webhook flow is:

1. register the webhook with `setWebhook()`
2. expose a public HTTP endpoint
3. validate the webhook secret header
4. pass the request body to `processUpdate()`
5. handle the resulting SDK events

See:

- [setWebhook](https://kaiyodev.github.io/zalo-bot-js/vi/set-webhook)
- [processUpdate](https://kaiyodev.github.io/zalo-bot-js/vi/process-update)
- [Examples and tests](https://kaiyodev.github.io/zalo-bot-js/vi/examples)

## Project Structure

- `src/request`: HTTP transport and API error mapping
- `src/models`: parsed models such as `User`, `Chat`, `Message`, `Update`, `WebhookInfo`
- `src/core`: `Bot`, `Application`, `ApplicationBuilder`, `CallbackContext`
- `src/handlers`: handler-based APIs such as `CommandHandler` and `MessageHandler`
- `src/filters`: composable filters
- `examples`: example integrations
- `test`: local verification scripts
- `docs`: VitePress documentation site

## Local Development

Core commands:

```bash
npm run check
npm run build
npm test
```

Useful scripts:

- `npm run test:token`
- `npm run test:hello-bot`
- `npm run test:event-debug`
- `npm run test:bot-api`
- `npm run docs:dev`
- `npm run docs:build`

## Current Scope

The SDK currently focuses on the practical bot core and the most common message flows first.

Current limitations:

- multipart media upload is still incomplete
- native single-call album send is not implemented; use `sendPhotos()` fallback for now
- framework-specific webhook adapters are not split into separate packages

## Read Next

- [Getting started](https://kaiyodev.github.io/zalo-bot-js/vi/getting-started)
- [API Reference](https://kaiyodev.github.io/zalo-bot-js/vi/api-reference)
- [sendMessage](https://kaiyodev.github.io/zalo-bot-js/vi/send-message)
- [Examples and tests](https://kaiyodev.github.io/zalo-bot-js/vi/examples)
- [Architecture](https://kaiyodev.github.io/zalo-bot-js/vi/architecture)

## License

MIT License. See [LICENSE](./LICENSE) for details.