import { beforeEach, describe, expect, it, vi } from "vitest";
import { logShortLinkClick } from "./click-log";

function createMissingColumnError() {
  return {
    code: "PGRST204",
    message:
      'Could not find the "event_type" column of "short_link_clicks" in the schema cache',
  };
}

describe("logShortLinkClick", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries without event_type when schema cache is behind", async () => {
    const insert = vi.fn((payload: Record<string, unknown>) => {
      if ("event_type" in payload) {
        throw createMissingColumnError();
      }

      return Promise.resolve({ error: null });
    });

    const db = {
      from: vi.fn(() => ({
        insert,
      })),
    };

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await logShortLinkClick(
      db as Parameters<typeof logShortLinkClick>[0],
      {
        short_link_id: "link-1",
        ip_address: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        referer: null,
        device_type: "desktop",
        is_suspicious: false,
        suspicious_reason: null,
        ip_version: "IPv4",
        event_type: "redirect_click",
      },
    );

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0]?.[0]).toHaveProperty("event_type", "redirect_click");
    expect(insert.mock.calls[1]?.[0]).not.toHaveProperty("event_type");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs non-schema errors without retrying", async () => {
    const insert = vi.fn(() => {
      throw {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      };
    });

    const db = {
      from: vi.fn(() => ({
        insert,
      })),
    };

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await logShortLinkClick(
      db as Parameters<typeof logShortLinkClick>[0],
      {
        short_link_id: "link-1",
        ip_address: "127.0.0.1",
        user_agent: "Mozilla/5.0",
        referer: null,
        device_type: "desktop",
        is_suspicious: false,
        suspicious_reason: null,
        ip_version: "IPv4",
        event_type: "redirect_click",
      },
    );

    expect(insert).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
