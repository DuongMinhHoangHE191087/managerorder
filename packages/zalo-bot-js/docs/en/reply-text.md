# replyText

This page describes the `replyText()` helper on `Message`, used to reply with text in the same chat as the current message.

## Function signature

```ts
replyText(text: string): Promise<Message>
```

## Example

```ts
bot.on("text", async (message) => {
  await message.replyText("I received your message.");
});
```

## Relationship with `sendMessage()`

`replyText()` internally calls `sendMessage()` with the current `message.chat.id`.

## Next

- See [sendMessage](./send-message.md) for the bot-level API.
- See [replyPhoto](./reply-photo.md) if you want to reply with an image.

Last updated: April 5, 2026
