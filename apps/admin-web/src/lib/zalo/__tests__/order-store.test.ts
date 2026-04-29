import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZaloOrderWizardState } from "../types";

const redisMock = vi.hoisted(() => {
  const cache = new Map<string, unknown>();

  return {
    cache,
    getCache: vi.fn(async <T>(key: string) => {
      if (!cache.has(key)) return null;
      return cache.get(key) as T;
    }),
    setCache: vi.fn(async (key: string, value: unknown) => {
      cache.set(key, value);
    }),
    deleteCache: vi.fn(async (key: string) => {
      cache.delete(key);
    }),
  };
});

vi.mock("../../redis/client", () => redisMock);

import {
  clearZaloOrderWizardSession,
  getZaloOrderWizardSession,
  setZaloOrderWizardSession,
} from "../order-store";

function makeState(step: ZaloOrderWizardState["step"], label: string): ZaloOrderWizardState {
  return {
    step,
    startedAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:00.000Z",
    items: [
      {
        productId: `prod-${label}`,
        productName: `Product ${label}`,
        mode: "key",
        sellPriceVnd: 199000,
        buyPriceVnd: 100000,
        durationType: "months",
        durationValue: 1,
        quantity: 1,
      },
    ],
  };
}

describe("zalo order store", () => {
  beforeEach(() => {
    redisMock.cache.clear();
    redisMock.getCache.mockClear();
    redisMock.setCache.mockClear();
    redisMock.deleteCache.mockClear();
  });

  it("keeps sessions isolated by accountId and chatId", async () => {
    const accountA = "00000000-0000-4000-8000-0000000000a1";
    const accountB = "00000000-0000-4000-8000-0000000000b2";
    const chat1 = "chat-1";
    const chat2 = "chat-2";
    const sessionA1 = makeState("customer-query", "a1");
    const sessionA2 = makeState("product-query", "a2");
    const sessionB1 = makeState("confirm", "b1");

    await setZaloOrderWizardSession(accountA, chat1, sessionA1);
    await setZaloOrderWizardSession(accountA, chat2, sessionA2);
    await setZaloOrderWizardSession(accountB, chat1, sessionB1);

    expect(redisMock.setCache).toHaveBeenNthCalledWith(
      1,
      "zalo:order:00000000-0000-4000-8000-0000000000a1:chat-1",
      expect.objectContaining({
        state: sessionA1,
        updatedAt: expect.any(String),
      }),
      43200,
    );
    expect(redisMock.setCache).toHaveBeenNthCalledWith(
      2,
      "zalo:order:00000000-0000-4000-8000-0000000000a1:chat-2",
      expect.objectContaining({
        state: sessionA2,
        updatedAt: expect.any(String),
      }),
      43200,
    );
    expect(redisMock.setCache).toHaveBeenNthCalledWith(
      3,
      "zalo:order:00000000-0000-4000-8000-0000000000b2:chat-1",
      expect.objectContaining({
        state: sessionB1,
        updatedAt: expect.any(String),
      }),
      43200,
    );

    expect(await getZaloOrderWizardSession(accountA, chat1)).toEqual(sessionA1);
    expect(await getZaloOrderWizardSession(accountA, chat2)).toEqual(sessionA2);
    expect(await getZaloOrderWizardSession(accountB, chat1)).toEqual(sessionB1);
    expect(await getZaloOrderWizardSession(accountB, chat2)).toBeNull();

    await clearZaloOrderWizardSession(accountA, chat1);

    expect(redisMock.deleteCache).toHaveBeenCalledWith("zalo:order:00000000-0000-4000-8000-0000000000a1:chat-1");
    expect(await getZaloOrderWizardSession(accountA, chat1)).toBeNull();
    expect(await getZaloOrderWizardSession(accountA, chat2)).toEqual(sessionA2);
    expect(await getZaloOrderWizardSession(accountB, chat1)).toEqual(sessionB1);
  });
});
