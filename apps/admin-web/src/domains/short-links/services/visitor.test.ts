import { describe, expect, it } from "vitest";
import {
  detectDeviceType,
  detectIpVersion,
  extractVisitorIp,
  getShortLinkVisitorFingerprint,
} from "./visitor";

describe("short-link visitor detection", () => {
  it("extracts the first trusted IPv4 from forwarding headers", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    });

    expect(extractVisitorIp(headers)).toEqual({
      ipAddress: "203.0.113.10",
      ipVersion: "IPv4",
      ipSource: "x-forwarded-for",
    });
  });

  it("extracts IPv6 from RFC Forwarded headers", () => {
    const headers = new Headers({
      forwarded: 'for="[2001:db8::1]:443";proto=https',
    });

    expect(extractVisitorIp(headers)).toEqual({
      ipAddress: "2001:db8::1",
      ipVersion: "IPv6",
      ipSource: "forwarded",
    });
  });

  it("normalizes IPv4-mapped IPv6 addresses", () => {
    const headers = new Headers({
      "true-client-ip": "::ffff:203.0.113.8",
    });

    expect(extractVisitorIp(headers)).toEqual({
      ipAddress: "203.0.113.8",
      ipVersion: "IPv4",
      ipSource: "true-client-ip",
    });
  });

  it("detects bots before mobile/tablet patterns", () => {
    expect(detectDeviceType("TelegramBot (iPhone; Mobile)")).toBe("bot");
    expect(detectDeviceType("curl/8.0.1")).toBe("bot");
    expect(detectDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(detectDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobile");
  });

  it("does not classify real mobile social webviews as bots", () => {
    expect(detectDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Zalo/24.01")).toBe("mobile");
    expect(detectDeviceType("Mozilla/5.0 (Linux; Android 14) Mobile WhatsApp/2.24")).toBe("mobile");
    expect(detectDeviceType("ZaloPreview/1.0")).toBe("bot");
  });

  it("marks empty user-agent visits as automated", () => {
    const visitor = getShortLinkVisitorFingerprint(new Headers({
      "cf-connecting-ip": "2001:db8::5",
    }));

    expect(visitor.ipVersion).toBe("IPv6");
    expect(visitor.isAutomated).toBe(true);
    expect(visitor.suspiciousReason).toBe("empty_user_agent");
  });

  it("classifies IPv4, IPv6, and invalid addresses", () => {
    expect(detectIpVersion("127.0.0.1")).toBe("IPv4");
    expect(detectIpVersion("2001:db8::1")).toBe("IPv6");
    expect(detectIpVersion("1:2:3:4:5:6:7:8:9")).toBe("unknown");
    expect(detectIpVersion("not-an-ip")).toBe("unknown");
  });
});
