import { describe, expect, it } from "vitest";
import { sanitizeBotRuntimeMetadata } from "../runtime-health";

describe("runtime-health security", () => {
  it("redacts sensitive runtime metadata before persistence", () => {
    const metadata = sanitizeBotRuntimeMetadata({
      apiHost: "https://bot-api.zapps.me",
      baseUrl: "https://bot-api.zapps.me/bot1234567890",
      note: "fetch https://api.telegram.org/botABCDEF123456/getUpdates",
      nested: {
        token: "secret-value",
        description: "callback via https://example.com/webhook",
      },
    });

    expect(metadata).toEqual({
      apiHost: "https://bot-api.zapps.me",
      baseUrl: "[redacted]",
      note: "fetch https://api.telegram.org/bot[redacted]/getUpdates",
      nested: {
        token: "[redacted]",
        description: "callback via https://example.com/webhook",
      },
    });
  });
});
