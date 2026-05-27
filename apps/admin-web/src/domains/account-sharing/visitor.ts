import type { NextRequest } from "next/server";
import type { ShareVisitorContext } from "./types";

function normalizeIpCandidate(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim().replace(/^"|"$/g, "");
  if (!candidate || candidate.toLowerCase() === "unknown") return null;

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  }

  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) return ipv4WithPort[1] ?? null;
  if (candidate.startsWith("::ffff:")) {
    const mapped = candidate.slice("::ffff:".length);
    if (isIpv4(mapped)) return mapped;
  }
  return candidate;
}

function isIpv4(ip: string): boolean {
  const parts = ip.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function isIpv6(ip: string): boolean {
  if (!ip.includes(":") || !/^[0-9a-f:.]+$/i.test(ip)) return false;
  if (ip.includes(":::")) return false;
  if ((ip.match(/::/g) ?? []).length > 1) return false;
  const sections = ip.split(":");
  if (ip.includes("::")) {
    return sections.length <= 8 && sections.every((section) => section === "" || section.length <= 4);
  }
  return sections.length === 8 && sections.every((section) => /^[0-9a-f]{1,4}$/i.test(section));
}

function detectIpVersion(ip: string | null): ShareVisitorContext["ipVersion"] {
  if (!ip) return "unknown";
  if (isIpv4(ip)) return "IPv4";
  if (isIpv6(ip)) return "IPv6";
  return "unknown";
}

function extractIp(headers: Headers): string | null {
  const priority = [
    "cf-connecting-ip",
    "true-client-ip",
    "x-real-ip",
    "x-client-ip",
    "x-vercel-forwarded-for",
    "x-forwarded-for",
  ];

  for (const name of priority) {
    const raw = headers.get(name);
    const candidates = name.includes("forwarded") ? (raw ?? "").split(",") : [raw];
    for (const candidate of candidates) {
      const ip = normalizeIpCandidate(candidate);
      if (ip && detectIpVersion(ip) !== "unknown") return ip;
    }
  }

  return null;
}

export function getShareVisitorContext(request: NextRequest): ShareVisitorContext {
  const ipAddress = extractIp(request.headers);
  return {
    ipAddress,
    ipVersion: detectIpVersion(ipAddress),
    userAgent: request.headers.get("user-agent"),
  };
}
