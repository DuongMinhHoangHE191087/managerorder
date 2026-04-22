# onText

This page describes the `onText()` function in `zalo-bot-js`, used to register a callback based on a regular expression applied to `message.text`.

This is the right choice when you want to match commands, keywords, or structured text patterns.

## Function signature

```ts
onText(
  pattern: RegExp,
  callback: (message: Message, match: RegExpExecArray) => Promise<void> | void,
): this
```

## Callback shape

The callback receives:

- `message: Message`
- `match: RegExpExecArray`

## Example

```ts
bot.onText(/.*/, async (message, match) => {
  console.log("[onText]", {
    chatId: message.chat.id,
    match: match[0],
  });
});
```

## Example with a command

```ts
bot.onText(/\/start(?:\s+(.+))?/, async (message, match) => {
  const payload = match[1]?.trim() ?? "there";
  await bot.sendMessage(message.chat.id, `Hello ${payload}!`);
});
```

## Difference between `on("text")` and `onText()`

- `on("text")` runs for every text message
- `onText()` runs only when the regex matches

## Next

- See [on](./on.md) for event-based listeners.
- See [sendMessage](./send-message.md) to respond from the callback.

Last updated: April 5, 2026
