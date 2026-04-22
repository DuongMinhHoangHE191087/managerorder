# cachedUser

This page describes the `cachedUser` attribute in `zalo-bot-js`, which is used to read back cached bot information after `getMe()` or `initialize()` runs successfully.

This is a convenient way to get bot information without calling the API again.

## Attribute signature

```ts
get cachedUser(): User | undefined
```

## When should you use it?

- Quickly read bot information after initialization
- display bot profile in log or internal dashboard
- avoid calling `getMe()` repeatedly when not needed

## For example

```ts
await bot.initialize();
console.log(bot.cachedUser);
```

## Practical note

- if you haven't called `getMe()` or `initialize()`, the value might be `undefined`
- this is cached data in memory, not a new API call

## Next

- See [getMe](./get-me.md) to see where this data is loaded from.
- See [initialize](./initialize.md) if you want to make sure the cache is there before using it.

Last updated: April 5, 2026
