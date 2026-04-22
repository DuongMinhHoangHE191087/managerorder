# setWebhook

This page describes the `setWebhook()` function in `zalo-bot-js`, used to register a webhook URL so Zalo can send updates to your application.

If you are moving the bot to a production-style deployment or want push-based updates instead of polling, this is the function to use.

## Function signature

```ts
setWebhook(url: string, secretToken: string): Promise<boolean>
```

## When to use it

- deploy the bot with webhook delivery
- receive updates in real time
- protect the endpoint with a secret token

## Example

```ts
await bot.setWebhook(
  "https://your-domain.example/webhook",
  "your-secret-token",
);
```

## Compatibility alias

The SDK still keeps this alias:

```ts
await bot.setWebHook(url, { secret_token: secretToken });
```

If you are starting a new project, prefer `setWebhook()`.

## Next

- See [getWebhookInfo](./get-webhook-info.md) to inspect the current webhook config.
- See [deleteWebhook](./delete-webhook.md) to remove the current webhook.

Last updated: April 5, 2026
