# sendSticker

This page describes the `sendSticker()` function in `zalo-bot-js`, used to send a sticker to a user or chat.

## Function signature

```ts
sendSticker(
  chatId: string,
  sticker: string,
  options?: { reply_to_message_id?: string },
): Promise<Message>
```

## When to use it

- send short expressive bot responses
- reply with sticker-based interaction instead of text

## Example

```ts
await bot.sendSticker(process.env.ZALO_CHAT_ID!, "sticker_id_here");
```

## Relationship with `replySticker()`

If you already have a `Message`, you can use `message.replySticker()`.

## Next

- See [sendMessage](./send-message.md) to send text.
- See [replySticker](./reply-sticker.md) for the message helper version.

Last updated: April 5, 2026
