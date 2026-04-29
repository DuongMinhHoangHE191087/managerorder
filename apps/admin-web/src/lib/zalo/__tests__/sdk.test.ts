import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/bot-manager/runtime-health", () => ({
  markBotRuntimeError: vi.fn(),
  markBotRuntimeHeartbeat: vi.fn(),
  markBotRuntimeInbound: vi.fn(),
  markBotRuntimeReply: vi.fn(),
  markBotRuntimeStarted: vi.fn(),
}));

import { createZaloBot, describeZaloApiHost } from "../sdk";

describe("zalo sdk", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("redacts the bot token from the api host description", () => {
    expect(describeZaloApiHost("https://bot-api.zapps.me/bot1234567890")).toBe("https://bot-api.zapps.me");
  });

  it("serializes allowedUpdates as a JSON array when polling", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body).toMatchObject({
        timeout: 30,
        allowed_updates: ["message", "edited_message"],
      });
      return new Response(JSON.stringify({ ok: true, result: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const bot = createZaloBot("token");
    const updates = await (bot as any).getUpdates({
      timeoutSeconds: 30,
      allowedUpdates: ["message", "edited_message"],
    });

    expect(updates).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
