# Architecture

## Overview

The current SDK is divided into clear layers:

- `src/request`: handle HTTP transport and map API errors
- `src/models`: parse payload into `User`, `Chat`, `Message`, `Update`, `WebhookInfo`
- `src/core`: `Bot`, `Application`, `ApplicationBuilder`, `CallbackContext`
- `src/handlers`: handle commands and messages
- `src/filters`: filters can be combined
- `src/i18n`: runtime message system for `vi/en`

## Basic run flow

![Bot runtime flow](../../image/usecase-bot.png)

## Mapping from Python to TypeScript

This project is referenced from `python_zalo_bot`, but not mechanically copied.Some parts have been simplified:

- remove Python-only patterns like `__slots__`, sentinel defaults, freeze object
- keep lifecycle clear via `initialize()` and `shutdown()`
- Prioritize objects and more compact TypeScript parsers
- fallback parse for message sending response if the API returns a thin payload

## Role of each main block

### `src/request`

This is the bottom layer of the SDK.It is responsible for:

- HTTP call to Zalo Bot API
- handle timeouts
- map HTTP status to custom error

### `src/models`

Models receive the raw payload and convert it into an object that is easier to use in code, for example:

- `Update`
- `Message`
- `User`
- `Chat`

### `src/core`

Here is the main dispatcher:

- `Bot`: client calls API
- `Application`: polling round and dispatch update
- `ApplicationBuilder`: clearer way to initialize the app

### `src/handlers` and `src/filters`

These two parts create event-driven programming:

- `CommandHandler` is used for commands like `/start`
- `MessageHandler` is used for text, photos or other filters
- `filters` allows combining conditions in an easy-to-read fashion

### `src/i18n`

This section reads `ZALO_BOT_LANG` and decides whether log/runtime messages should be displayed in Vietnamese or English.

## Current limit

- There is no full media upload abstraction yet
- There is no worker queue layer yet
- webhook framework adapters have not been separated into separate packages

## Thread runs when polling

1. App is created from `ApplicationBuilder`
2. `Application.runPolling()` calls `Bot.initialize()`
3. `Bot.initialize()` checks the token via `getMe()`
4. `Application` repeats `getUpdate()`
5. `Update` is parsed into a model
6. The first Handler to match will handle the update
7. Your callback can call `replyText()` or other message sending methods
