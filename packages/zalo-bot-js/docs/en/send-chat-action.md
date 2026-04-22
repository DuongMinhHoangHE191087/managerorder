# sendChatAction

This page describes the `sendChatAction()` function in `zalo-bot-js`, used to send a temporary action state such as typing or processing to a chat.

## Function signature

```ts
sendChatAction(
  chatId: string,
  action: string,
  options?: RequestOptions,
): Promise<boolean>
```

## When to use it

- show the user that the bot is still working
- improve responsiveness before sending the final message
- use before AI calls, external webhooks, or slow backend operations

## Example

```ts
await bot.sendChatAction("abc.xyz", "typing");
```

## Relationship with `replyAction()`

If you already have a `Message`, you can use `message.replyAction()`.

## Next

- See [sendMessage](./send-message.md) to send the actual text after the action.
- See [replyAction](./reply-action.md) for the message helper version.

Last updated: April 5, 2026
