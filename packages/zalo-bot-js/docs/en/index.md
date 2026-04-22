---
layout: home

hero:
  name: "zalo-bot-js"
  text: "English documentation portal"
  tagline: "Build Zalo bots on Node.js with a practical SDK for polling, webhook handling, event listeners, message sending APIs, and workflow integrations."
  actions:
    - theme: brand
      text: Getting started
      link: /en/getting-started
    - theme: alt
      text: API Reference
      link: /en/api-reference
    - theme: alt
      text: Đọc tiếng Việt
      link: /vi/

features:
  - title: Bot setup
    details: Install the SDK, create `.env`, validate the token, and run the first bot flow.
    link: /en/getting-started
  - title: API pages
    details: Browse dedicated pages for `Bot` methods, `Message` helpers, webhook APIs, and polling runtime.
    link: /en/api-reference
  - title: Sending APIs
    details: Use `sendMessage`, `sendPhoto`, `sendSticker`, and `sendChatAction` in practical bot flows.
    link: /en/send-message
  - title: Event and update flow
    details: Understand how `on`, `onText`, `processUpdate`, and `startPolling` work inside the SDK.
    link: /en/on
  - title: Handler-based API
    details: Organize bot logic with `ApplicationBuilder`, `Application`, `CommandHandler`, `MessageHandler`, and `filters`.
    link: /en/application-builder
  - title: Practical integrations
    details: Connect the bot to webhook deployments, n8n workflows, and internal automation services.
    link: /en/n8n
---

## Introduction

This documentation is for developers who want to build bots on the Zalo platform with `zalo-bot-js`, a TypeScript SDK for Node.js with practical components such as polling, webhook helpers, event listeners, and core message-sending APIs.

Through this documentation set, you can configure a bot quickly, validate the token, run message receive and reply flows, and understand the current SDK structure before extending it further.

## Where to start

If you are opening the documentation for the first time, follow this order:

1. [Getting started](./getting-started.md) to configure the environment and run the first bot flow
2. [API Reference](./api-reference.md) to browse the main SDK methods
3. [Examples and tests](./examples.md) to choose between polling, webhook, and local verification scripts
4. [n8n Integration](./n8n.md) if you want to connect the bot to automation workflows

## Highlighted content groups

- Bot setup and validation: installation, `.env`, token checks, polling
- Runtime APIs: `getMe`, `getUpdates`, `processUpdate`, `startPolling`
- Sending APIs: `sendMessage`, `sendPhoto`, `sendSticker`, `sendChatAction`
- Practical integrations: webhook, n8n, automation workflows, and internal APIs

## Next

Start with [Getting started](./getting-started.md).

Last updated: April 5, 2026
