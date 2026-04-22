import { beforeEach, describe, expect, it, vi } from "vitest";

function createQueryChain(result: { data?: unknown; count?: number; error?: { code?: string; message: string } | null }) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (value: { data?: unknown; count?: number; error?: { code?: string; message: string } | null }) => unknown) =>
    resolve(result);
  return chain;
}

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const { getClickAnalytics } = await import("../fraud-detector");

describe("getClickAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts only redirect clicks in totals while preserving preview logs", async () => {
    const allTimeCountChain = createQueryChain({ count: 3, error: null });
    const redirectCountChain = createQueryChain({ count: 1, error: null });
    const dataChain = createQueryChain({
      data: [
        {
          id: "click-1",
          short_link_id: "link-1",
          ip_address: "10.0.0.1",
          user_agent: "Mozilla/5.0 Chrome/120.0",
          referer: "https://example.com",
          device_type: "desktop",
          is_suspicious: false,
          suspicious_reason: null,
          country: "VN",
          city: "HCMC",
          ip_version: "IPv4",
          event_type: "redirect_click",
          clicked_at: "2026-04-15T01:00:00.000Z",
          created_at: "2026-04-15T01:00:00.000Z",
        },
        {
          id: "click-2",
          short_link_id: "link-1",
          ip_address: "10.0.0.2",
          user_agent: "TelegramBot/1.0",
          referer: null,
          device_type: "bot",
          is_suspicious: false,
          suspicious_reason: null,
          country: null,
          city: null,
          ip_version: "IPv4",
          event_type: "landing_view",
          clicked_at: "2026-04-15T01:01:00.000Z",
          created_at: "2026-04-15T01:01:00.000Z",
        },
        {
          id: "click-3",
          short_link_id: "link-1",
          ip_address: "10.0.0.3",
          user_agent: "Mozilla/5.0",
          referer: null,
          device_type: "bot",
          is_suspicious: false,
          suspicious_reason: null,
          country: null,
          city: null,
          ip_version: "IPv4",
          event_type: "bot_preview",
          clicked_at: "2026-04-15T01:02:00.000Z",
          created_at: "2026-04-15T01:02:00.000Z",
        },
      ],
      error: null,
    });

    mockFrom
      .mockImplementationOnce((table: string) => {
        expect(table).toBe("short_link_clicks");
        return allTimeCountChain;
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe("short_link_clicks");
        return redirectCountChain;
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe("short_link_clicks");
        return dataChain;
      });

    const result = await getClickAnalytics("link-1");

    expect(result.stats?.totalClicks).toBe(1);
    expect(result.stats?.uniqueIPs).toBe(1);
    expect(result.stats?.devices.desktop).toBe(1);
    expect(result.clicks).toHaveLength(3);
    expect(result.clicks?.[1]?.event_type).toBe("landing_view");
  });
});
