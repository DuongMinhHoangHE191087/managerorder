# n8n Integration

This page explains how to connect `zalo-bot-js` with n8n in practical ways, from webhook-based update delivery to polling-based local development and outbound calls from automation workflows.

If you are building a bot that needs to connect to CRM systems, Google Sheets, AI services, internal HTTP APIs, or multi-step workflows, n8n can act as the orchestration layer while `zalo-bot-js` handles the bot runtime and Zalo API integration.

## Common integration models

### 1. `zalo-bot-js` receives the webhook, then calls n8n

This is the recommended production model.

Flow:

1. Zalo sends updates to your Node.js webhook endpoint
2. your app validates the webhook secret and parses the update
3. your app sends the normalized payload to an n8n webhook
4. n8n runs the business workflow
5. your app sends the final message back through `zalo-bot-js`

### 2. n8n calls your internal bot API

In this model, n8n is triggered by another system, then calls your internal Node.js service, and your service uses `zalo-bot-js` to send messages.

This is useful for:

- scheduled notifications
- CRM-driven outbound messages
- workflow-based alerts and confirmations

### 3. Polling for local testing, n8n behind the bot

This is useful during local development or proof-of-concept phases when you do not have a public webhook URL yet.

## Recommended architecture

```text
Zalo Bot API
  -> Node.js webhook app
  -> `zalo-bot-js`
  -> normalized bot payload
  -> HTTP request to n8n
  -> workflow logic
  -> reply result
  -> `zalo-bot-js` sends a message back to Zalo
```

## Practical notes

- keep bot token handling inside your Node.js app when possible
- let n8n focus on workflow orchestration rather than raw Zalo payload parsing
- use timeout, retry, and logging between the bot runtime and n8n

## Next

- See [Examples and tests](./examples.md) for webhook and polling examples.
- See [sendMessage](./send-message.md) if your workflow needs to send responses back to users.

Last updated: April 5, 2026
