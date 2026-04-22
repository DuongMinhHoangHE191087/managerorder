# replyPhoto

This page describes the `replyPhoto()` helper on `Message`, used to send a photo back to the same chat as the current message.

## Function signature

```ts
replyPhoto(photo: string, caption = ""): Promise<Message>
```

## Example

```ts
bot.on("text", async (message) => {
  await message.replyPhoto("https://example.com/image.jpg", "Sample image");
});
```

## Relationship with `sendPhoto()`

`replyPhoto()` internally calls `sendPhoto()` with the current `message.chat.id`.

## Next

- See [sendPhoto](./send-photo.md) for the bot-level API.
- See [replyText](./reply-text.md) if you only need text.

Last updated: April 5, 2026
