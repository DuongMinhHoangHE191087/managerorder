# shutdown

This page describes the `shutdown()` function in `zalo-bot-js`, used to close internal transports that were initialized earlier.

This function is useful when the application is shutting down or when you want to release runtime resources explicitly.

## Function signature

```ts
shutdown(): Promise<void>
```

## When to use it

- the application is about to exit
- a worker or service needs to clean up connections
- you manage the bot lifecycle manually with `initialize()` and `shutdown()`

## Example

```ts
await bot.initialize();

process.on("SIGINT", async () => {
  await bot.shutdown();
  process.exit(0);
});
```

## Practical notes

- if the bot has not been initialized yet, `shutdown()` exits safely
- in the polling runtime, the SDK also calls `shutdown()` when polling stops

## Next

- See [initialize](./initialize.md) to set up the bot lifecycle correctly.
- See [startPolling](./start-polling.md) to understand when polling closes transports automatically.

Last updated: April 5, 2026
