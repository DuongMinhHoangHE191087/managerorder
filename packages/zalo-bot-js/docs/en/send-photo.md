# sendPhoto

This page describes the `sendPhoto()` function in `zalo-bot-js`, used to send a single photo with an optional caption to a user or chat.

## Function signature

```ts
sendPhoto(
  chatId: string,
  caption: string,
  photo: string,
  options?: { reply_to_message_id?: string },
): Promise<Message>
```

## When to use it

- send an illustration or reference image
- send product images or visual responses
- return image content from a bot flow

## Example

```ts
await bot.sendPhoto(
  process.env.ZALO_CHAT_ID!,
  "Sample image",
  "https://example.com/image.jpg",
);
```

## Relationship with `replyPhoto()`

If you already have a `Message`, you can use `message.replyPhoto()` for a shorter reply flow.

## Practical notes

- the SDK currently sends one photo at a time
- if you need multiple photos, call `sendPhoto()` multiple times

## Next

- See [sendMessage](./send-message.md) to send text.
- See [replyPhoto](./reply-photo.md) for the message helper version.

Last updated: April 5, 2026
