# replySticker

This page describes the `replySticker()` helper on `Message`, used to send a sticker back to the same chat as the current message.

## Function signature

```ts
replySticker(sticker: string): Promise<Message>
```

## Example

```ts
bot.on("text", async (message) => {
  await message.replySticker("sticker_id_here");
});
```

## Relationship with `sendSticker()`

`replySticker()` internally calls `sendSticker()` with the current `message.chat.id`.

## Next

- See [sendSticker](./send-sticker.md) for the bot-level API.
- See [replyAction](./reply-action.md) if you want to send a temporary action instead.

Last updated: April 5, 2026
