# getWebhookInfo

This page describes the `getWebhookInfo()` function in `zalo-bot-js`, used to retrieve the current webhook configuration for the bot.

It is useful for checking whether the bot is currently configured for webhook delivery and for debugging deployment state.

## Function signature

```ts
getWebhookInfo(): Promise<WebhookInfo | undefined>
```

## Example

```ts
const info = await bot.getWebhookInfo();
console.log(info);
```

## Compatibility alias

The SDK still keeps this alias:

```ts
const info = await bot.getWebHookInfo();
```

If you are starting a new project, prefer `getWebhookInfo()`.

## Next

- See [setWebhook](./set-webhook.md) to register a webhook.
- See [deleteWebhook](./delete-webhook.md) to remove the current one.

Last updated: April 5, 2026
