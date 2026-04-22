# on

This page describes the `on()` function in `zalo-bot-js`, used to register listeners for SDK-normalized event types.

This is one of the main ways to write a bot with the event-listener API.

## Function signature

```ts
on(event: BotEvent, callback: BotEventCallback): this
```

## Supported events

- `message`
- `text`
- `photo`
- `sticker`
- `command`

## Callback shape

The callback receives:

- `message: Message`
- `metadata: { update: Update }`

## Example

```ts
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
```

## Practical notes

- `on("message")` is the broadest listener
- `on("text")` runs only when the message has text
- if you need regex matching, use [onText](./on-text.md)

## Next

- See [onText](./on-text.md) for regex-based matching.
- See [processUpdate](./process-update.md) to understand how SDK events are emitted.

Last updated: April 5, 2026
