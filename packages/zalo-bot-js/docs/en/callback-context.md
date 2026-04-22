# CallbackContext

This page describes `CallbackContext` in `zalo-bot-js`, the context object passed to the callbacks of `CommandHandler` and `MessageHandler`.

`CallbackContext` helps callbacks quickly access `application`, `bot` and the list of `args` already separated from the command.

## Key properties

- `application`
- `bot`
- `args`

## Example with `CommandHandler`

```ts
app.addHandler(new CommandHandler("start", async (update, ctx) => {
  console.log(ctx.args);
  await ctx.bot.sendMessage(update.message!.chat.id, "Xin chào!");
}));
```

## How `args` works

For example if the user submits:

```text
/start demo value
```

then `ctx.args` would be:

```ts
["demo", "value"]
```

## When should you use it?

- callback needs to be reused `bot`
- callback needs to access `application`
- The command callback needs to read the parameters after the command

## Next

- See [CommandHandler](./command-handler.md) to see when `CallbackContext` is transmitted.
- See [Application](./application.md) to understand the relationship between context and app.

Last updated: April 5, 2026
