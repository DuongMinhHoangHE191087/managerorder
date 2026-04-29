import { describe, expect, it } from "vitest";
import {
  createShortLinkRelayCookieValue,
  isShortLinkRelayEnabled,
  verifyShortLinkRelayCookieValue,
} from "./public-relay";

const env = {
  SHORT_LINK_RELAY_SECRET: "test-short-link-relay-secret",
};

describe("short-link public relay", () => {
  it("reports relay enabled when a secret exists", () => {
    expect(isShortLinkRelayEnabled(env)).toBe(true);
    expect(isShortLinkRelayEnabled({})).toBe(false);
  });

  it("creates and verifies a signed relay cookie", async () => {
    const cookieValue = await createShortLinkRelayCookieValue(
      {
        slug: "relay123",
        token: "access-token",
        userAgent: "Mozilla/5.0 test",
      },
      env,
    );

    const payload = await verifyShortLinkRelayCookieValue(
      cookieValue,
      { userAgent: "Mozilla/5.0 test" },
      env,
    );

    expect(payload).toEqual(
      expect.objectContaining({
        slug: "relay123",
        token: "access-token",
      }),
    );
  });

  it("rejects the relay cookie when the user-agent hash changes", async () => {
    const cookieValue = await createShortLinkRelayCookieValue(
      {
        slug: "relay123",
        userAgent: "Mozilla/5.0 test",
      },
      env,
    );

    const payload = await verifyShortLinkRelayCookieValue(
      cookieValue,
      { userAgent: "Different UA" },
      env,
    );

    expect(payload).toBeNull();
  });
});
