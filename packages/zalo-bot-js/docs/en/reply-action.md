# replyAction

This page describes the `replyAction()` helper on `Message`, used to send a chat action back to the same chat as the current message.

## Function signature

```ts
replyAction(action: string): Promise<boolean>
```

## Example

```ts
bot.on("text", async (message) => {
  await message.replyAction("typing");
});
```

## Relationship with `sendChatAction()`

`replyAction()` internally calls `sendChatAction()` with the current `message.chat.id`.

## Next

- See [sendChatAction](./send-chat-action.md) for the bot-level API.
- See [replyText](./reply-text.md) to send content after the action.

Last updated: April 5, 2026
