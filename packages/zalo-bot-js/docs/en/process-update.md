# processUpdate

This page describes the `processUpdate()` function in `zalo-bot-js`, used to feed an update into the SDK event pipeline.

It is the core function for webhook-based flows: your HTTP server receives the payload, then passes it to `processUpdate()` so the SDK can parse it and emit the matching listeners.

## Function signature

```ts
processUpdate(update: Update | JsonObject): Promise<void>
```

## What this function does

When called, the SDK will:

1. parse the payload into `Update` if needed
2. ignore updates without `message`
3. update `nextUpdateOffset` when `updateId` exists
4. emit listeners for each derived `eventType`
5. run all listeners registered with `onText()`

## Example

```ts
await bot.processUpdate(payload);
```

## Webhook example

```ts
app.post("/webhook", async (req, res) => {
  await bot.processUpdate(req.body);
  res.sendStatus(200);
});
```

## Practical notes

- updates without `message` are ignored
- if you use `startPolling()`, the SDK calls `processUpdate()` internally

## Next

- See [setWebhook](./set-webhook.md) to configure webhook delivery.
- See [on](./on.md) and [onText](./on-text.md) to handle parsed updates.

Last updated: April 5, 2026
