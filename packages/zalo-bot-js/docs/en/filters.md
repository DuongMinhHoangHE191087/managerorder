# filters

This page describes `filters` in `zalo-bot-js`, the built-in filter set used with `MessageHandler` or any flow that needs to inspect an `Update`.

The SDK filters are composable functions that can be combined with `and`, `or`, and `not`.

## Built-in filters

- `filters.TEXT`
- `filters.COMMAND`
- `filters.PHOTO`
- `filters.STICKER`
- `filters.ALL`

## Basic example

```ts
app.addHandler(new MessageHandler(filters.TEXT, async (update) => {
  await update.message?.replyText("This is a text message.");
}));
```

## Combining filters

```ts
const textButNotCommand = filters.TEXT.and(filters.COMMAND.not());
```

```ts
const media = filters.PHOTO.or(filters.STICKER);
```

## Next

- See [MessageHandler](./message-handler.md) to use filters in handlers.
- See [Application](./application.md) to understand where filters fit in the runtime flow.

Last updated: April 5, 2026
