import { describe, expect, it } from "vitest";
import {
  resolveTelegramRuntimeMode,
  resolveZaloRuntimeMode,
  shouldAutoRegisterTelegramWebhook,
  shouldStartTelegramPolling,
} from "../runtime-mode";

describe("runtime-mode", () => {
  it("defaults telegram to polling in development", () => {
    const mode = resolveTelegramRuntimeMode({
      NODE_ENV: "development",
      TELEGRAM_BOT_TOKEN: "token",
    });

    expect(mode).toBe("polling");
    expect(shouldStartTelegramPolling({
      NODE_ENV: "development",
      TELEGRAM_BOT_TOKEN: "token",
    })).toBe(true);
  });

  it("defaults telegram to polling in production for backward compatibility", () => {
    const mode = resolveTelegramRuntimeMode({
      NODE_ENV: "production",
      TELEGRAM_BOT_TOKEN: "token",
    });

    expect(mode).toBe("polling");
    expect(shouldAutoRegisterTelegramWebhook({
      NODE_ENV: "production",
      TELEGRAM_BOT_TOKEN: "token",
    })).toBe(false);
  });

  it("respects explicit polling override", () => {
    const mode = resolveTelegramRuntimeMode({
      NODE_ENV: "production",
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_RUNTIME_MODE: "polling",
    });

    expect(mode).toBe("polling");
    expect(shouldAutoRegisterTelegramWebhook({
      NODE_ENV: "production",
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_RUNTIME_MODE: "polling",
    })).toBe(false);
  });

  it("defaults zalo to polling when token exists", () => {
    expect(resolveZaloRuntimeMode({
      NODE_ENV: "test",
      ZALO_BOT_TOKEN: "token",
    })).toBe("polling");
  });

  it("disables zalo when runtime mode is disabled", () => {
    expect(
      resolveZaloRuntimeMode({
        NODE_ENV: "test",
        ZALO_BOT_TOKEN: "token",
        ZALO_RUNTIME_MODE: "disabled",
      }),
    ).toBe("disabled");
  });
});
