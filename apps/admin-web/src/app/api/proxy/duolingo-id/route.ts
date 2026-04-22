/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/proxy/duolingo-id?username=<username>
 *
 * Multi-strategy Duolingo ID lookup.
 * Cloud WAF (Cloudflare) chặn IP cloud providers → cần fallback.
 *
 * Strategy 1: API trực tiếp  → nhanh nhất, có thể bị 406 từ cloud
 * Strategy 2: Scrape duome.eu → bên thứ ba, parse avatar URL
 * Strategy 3: Scrape profile  → parse HTML Duolingo profile
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function extractUsername(raw: string): string | null {
  let u = raw.trim();
  u = u.replace(/^https?:\/\/(www\.)?duolingo\.com\/profile\//i, "");
  u = u.replace(/[/?#].*$/, "");
  if (u.startsWith("@")) u = u.substring(1);
  if (!u || !/^[a-zA-Z0-9._\-]{1,50}$/.test(u)) return null;
  return u;
}

// ─── Safe Fetch with Timeout Helper ─────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}


// ─── Strategy 1: Duolingo API direct ────────────────────────

async function strategy1_API(
  username: string
): Promise<{ id: number; username: string } | null> {
  try {
    const url = `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(username)}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.duolingo.com/",
        Origin: "https://www.duolingo.com",
      },
      cache: "no-store",
    }, 10000);
    if (!res.ok) {
      console.log(`[DuolingoProxy] Strategy 1 failed for ${username}: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const users = Array.isArray(data?.users) ? data.users : [];
    
    // Exact match is preferred
    let user = users.find(
      (u: any) =>
        String(u.username ?? "").toLowerCase() === username.toLowerCase()
    );

    // Fallback if exactly matching username field is not found (sometimes Duolingo API responds with weird casing)
    if (!user && users.length > 0) {
      user = users[0];
    }

    if (user?.id) {
      return { id: Number(user.id), username: user.username ?? username };
    }
  } catch (err: any) {
    console.log(`[DuolingoProxy] Strategy 1 error for ${username}:`, err.message);
  }
  return null;
}

// ─── Strategy 2: Scrape duome.eu ────────────────────────────

async function strategy2_Duome(
  username: string
): Promise<{ id: number; username: string } | null> {
  try {
    const res = await fetchWithTimeout(`https://duome.eu/${encodeURIComponent(username)}`, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }, 10000);
    if (!res.ok) return null;

    const html = await res.text();

    // Strategy A: simg-ssl.duolingo.com/avatars/USER_ID/...
    const avatarMatch = html.match(/simg-ssl\.duolingo\.com\/(?:ssr-)?avatars\/(\d+)\//);
    if (avatarMatch) {
      return { id: parseInt(avatarMatch[1], 10), username };
    }

    // Strategy B: data-id="USER_ID"
    const dataIdMatch = html.match(/data-(?:duo-)?id=['"](\d+)['"]/i);
    if (dataIdMatch) {
      return { id: parseInt(dataIdMatch[1], 10), username };
    }

    // Strategy C: looking for any numbers near "duolingo.com/avatars/"
    const genericIdMatch = html.match(/\/avatars\/(\d+)\//);
    if (genericIdMatch) {
      return { id: parseInt(genericIdMatch[1], 10), username };
    }
  } catch (err: any) {
    console.log(`[DuolingoProxy] Strategy 2 error for ${username}:`, err.message);
  }
  return null;
}

// ─── Strategy 3: Scrape Duolingo profile page ───────────────

async function strategy3_ProfileScrape(
  username: string
): Promise<{ id: number; username: string } | null> {
  try {
    const res = await fetchWithTimeout(
      `https://www.duolingo.com/profile/${encodeURIComponent(username)}`,
      {
        headers: {
          "User-Agent": UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      10000
    );
    if (!res.ok) return null;

    const html = await res.text();

    // __NEXT_DATA__ JSON
    const ndMatch = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (ndMatch) {
      try {
        const nd = JSON.parse(ndMatch[1]);
        const user =
          nd?.props?.pageProps?.initialData?.user ??
          nd?.props?.pageProps?.user;
        if (user?.id && user.id > 0) {
          return { id: user.id, username: user.username ?? username };
        }
      } catch {
        /* parse failed */
      }
    }

    // Avatar URL pattern in HTML
    const avatarMatch = html.match(
      /simg-ssl\.duolingo\.com\/(?:ssr-)?avatars\/(\d+)\//
    );
    if (avatarMatch) {
      return { id: parseInt(avatarMatch[1], 10), username };
    }
  } catch {
    // Strategy 3 failed
  }
  return null;
}

// ─── Strategy 4: CORS Proxy fallback (bypasses Cloudflare WAF) ──

async function strategy4_ProxyAPI(
  username: string
): Promise<{ id: number; username: string } | null> {
  try {
    const duoUrl = `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(username)}`;
    const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(duoUrl)}`;
    const res = await fetchWithTimeout(proxyUrl, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    }, 15000);
    if (!res.ok) {
      console.log(`[DuolingoProxy] Strategy 4 failed for ${username}: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const users = Array.isArray(data?.users) ? data.users : [];
    let user = users.find(
      (u: any) => String(u.username ?? "").toLowerCase() === username.toLowerCase()
    );
    if (!user && users.length > 0) user = users[0];
    if (user?.id) {
      return { id: Number(user.id), username: user.username ?? username };
    }
  } catch (err: any) {
    console.log(`[DuolingoProxy] Strategy 4 error for ${username}:`, err.message);
  }
  return null;
}

// ─── Main handler ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get("username")?.trim();

  if (!raw) {
    return NextResponse.json(
      { error: "username parameter is required" },
      { status: 400 }
    );
  }

  const username = extractUsername(raw);
  if (!username) {
    return NextResponse.json(
      { error: "Username không hợp lệ" },
      { status: 400 }
    );
  }

  // Try all strategies in order (4 = proxy fallback for WAF bypass)
  const result =
    (await strategy1_API(username)) ??
    (await strategy2_Duome(username)) ??
    (await strategy3_ProfileScrape(username)) ??
    (await strategy4_ProxyAPI(username));

  if (!result) {
    return NextResponse.json(
      { error: `Không tìm thấy user "${username}" trên Duolingo` },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { id: result.id, username: result.username },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
  );
}
