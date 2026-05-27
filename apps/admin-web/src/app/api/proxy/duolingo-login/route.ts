import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage, escapeHtml, resolveTelegramAdminChatId } from "@/lib/utils/telegram";

/**
 * POST /api/proxy/duolingo-login
 * Login to Duolingo → get user profile + subscription + family members.
 * Used for auto-filling warehouse credentials.
 *
 * Body: { identifier: string, password: string }
 * Returns: { userId, username, name, hasPlus, streak, xp, profileUrl, subscription, familyMembers }
 */

// Real Android device models for realistic User-Agent rotation
const ANDROID_DEVICES = [
  "SM-G955N Build/NRD90M.G955NKSU1AQDC",
  "SM-G988N Build/PD1A.180720.030",
  "SM-G973F Build/PPR1.180610.011",
  "SM-N975F Build/SP1A.210812.016",
  "Pixel 6 Build/SD1A.210817.015.A4",
];

// Duodroid versions — keep synced with latest APK
const DUODROID_VERSIONS = ["5.141.7", "5.140.4", "5.138.2", "5.128.3"];

/** Generate a realistic Duodroid User-Agent string */
function randomAndroidUA(): string {
  const device = ANDROID_DEVICES[Math.floor(Math.random() * ANDROID_DEVICES.length)];
  const ver = DUODROID_VERSIONS[Math.floor(Math.random() * DUODROID_VERSIONS.length)];
  return `Duodroid/${ver} Dalvik/2.1.0 (Linux; U; Android 9; ${device})`;
}

/** Generate a UUID v4 for wuuid cookie */
function generateWuuid(): string {
  return crypto.randomUUID();
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.duolingo.com/",
  Origin: "https://www.duolingo.com",
  "Content-Type": "application/json",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

interface FamilyMember {
  id: number;
  username: string;
  name: string;
  isOwner: boolean;
  hasPlus?: boolean;
}

interface DuolingoLoginResult {
  userId: number;
  username: string;
  name: string;
  hasPlus: boolean;
  streak: number;
  totalXp: number;
  gems: number;
  profileUrl: string;
  learningLanguage: string;
  creationDate: string | null;
  subscription: {
    isActive: boolean;
    planType: string | null;
    renewDate: string | null;
    expiresAt: string | null;
    isFamilyPlan: boolean;
    maxFamilyMembers: number;
  };
  familyMembers: FamilyMember[];
  inviteToken: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password } = body as { identifier?: string; password?: string };

    const ADMIN_CHAT_ID = resolveTelegramAdminChatId();

    if (!identifier?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Email và mật khẩu là bắt buộc" },
        { status: 400 }
      );
    }

    const signal = AbortSignal.timeout(25000);
    const trimmedId = identifier.trim();
    const trimmedPass = password.trim();

    // ─── Android API config (matching real Duodroid APK traffic) ───
    const ANDROID_BASE = "https://android-api-cf.duolingo.com";
    const ANDROID_BASE_FALLBACK = "https://android-api.duolingo.com";

    // Generate a valid 16-character hex string (Android ID format)
    const androidId = crypto.randomUUID().replace(/-/g, "").substring(0, 16);
    const wuuid = generateWuuid();

    // Headers matching real Duodroid APK — exact order matters for WAF
    const ANDROID_HEADERS: Record<string, string> = {
      "Host": "android-api-cf.duolingo.com",
      "User-Agent": randomAndroidUA(),
      "Accept": "application/json",
      "x-amzn-trace-id": "User=0",
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    };

    // ─── Step 1: Login via Android API ───
    const loginBody = JSON.stringify({
      distinctId: androidId,
      identifier: trimmedId,
      password: trimmedPass,
    });

    let loginRes = await fetch(
      `${ANDROID_BASE}/2017-06-30/login?fields=id`,
      {
        method: "POST",
        headers: { ...ANDROID_HEADERS, "Content-Length": String(new TextEncoder().encode(loginBody).length) },
        body: loginBody,
        signal,
      }
    );

    // ─── 406 Retry: fallback to alternate endpoint + fresh UA ───
    if (loginRes.status === 406) {
      console.warn("[Duolingo] 406 on CF endpoint, retrying on fallback...");
      const fallbackHeaders = {
        ...ANDROID_HEADERS,
        "Host": "android-api.duolingo.com",
        "User-Agent": randomAndroidUA(),
        "Content-Length": String(new TextEncoder().encode(loginBody).length),
      };
      loginRes = await fetch(
        `${ANDROID_BASE_FALLBACK}/2017-06-30/login?fields=id`,
        {
          method: "POST",
          headers: fallbackHeaders,
          body: loginBody,
          signal,
        }
      );
    }

    if (!loginRes.ok) {
      const status = loginRes.status;
      let errDetail = "";
      try {
        const errData = await loginRes.json();
        errDetail = errData.details ?? errData.error ?? errData.failure ?? "";
      } catch { /* ignore */ }

      if (ADMIN_CHAT_ID) {
        sendTelegramMessage([
          `❌ <b>DUOLINGO LOGIN FAILED</b>`,
          `👤 <b>Input:</b> <code>${escapeHtml(trimmedId)}</code>`,
          `⚠️ <b>HTTP Status:</b> ${status}`,
          `📝 <b>Detail:</b> ${escapeHtml(typeof errDetail === "string" ? errDetail : JSON.stringify(errDetail))}`
        ].join("\\n"), { chatId: ADMIN_CHAT_ID }).catch(()=>{});
      }

      if (status === 403 || status === 401 || (typeof errDetail === "string" && errDetail.toLowerCase().includes("password"))) {
        return NextResponse.json(
          { error: "Sai email hoặc mật khẩu Duolingo" },
          { status: 403 }
        );
      }
      if (status === 406) {
        return NextResponse.json(
          { error: "Duolingo API từ chối request (406 Not Acceptable). Headers không hợp lệ hoặc IP bị chặn. Vui lòng thử lại." },
          { status: 406 }
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: "Duolingo rate-limit: vui lòng thử lại sau vài phút" },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Duolingo login thất bại (HTTP ${status}). ${errDetail}` },
        { status: status >= 400 && status < 600 ? status : 502 }
      );
    }

    const jwt = loginRes.headers.get("jwt") ?? "";
    const loginData = await loginRes.json();
    const userId: number = loginData.id ?? loginData.user_id ?? 0;

    if (!userId || userId === 0) {
      return NextResponse.json(
        { error: "Login thành công nhưng không lấy được user ID" },
        { status: 500 }
      );
    }

    // ─── Step 2: Get full user profile ───
    // IMPORTANT: Duolingo API only returns familyPlanInfo, shopItems when
    // requesting WITHOUT a fields filter. With fields=..., those are omitted.
    // Authenticated headers — match real Duodroid with User=<id> trace and wuuid cookie
    const authHeaders: Record<string, string> = {
      "Host": "android-api-cf.duolingo.com",
      "Authorization": jwt ? `Bearer ${jwt}` : "",
      "x-amzn-trace-id": `User=${userId}`,
      "User-Agent": ANDROID_HEADERS["User-Agent"],
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "Cookie": `wuuid=${wuuid}`,
    };
    // Remove empty Authorization if no JWT
    if (!jwt) delete authHeaders["Authorization"];

    let userProfile: Record<string, unknown> = { id: userId, username: loginData.username ?? "" };

    // First: full profile (no fields filter) to get familyPlanInfo + shopItems
    try {
      let fullRes = await fetch(
        `${ANDROID_BASE}/2017-06-30/users/${userId}`,
        { headers: authHeaders, signal }
      );
      // Retry on 406 with fallback endpoint
      if (fullRes.status === 406) {
        fullRes = await fetch(
          `${ANDROID_BASE_FALLBACK}/2017-06-30/users/${userId}`,
          { headers: { ...authHeaders, "Host": "android-api.duolingo.com" }, signal }
        );
      }
      if (fullRes.ok) {
        userProfile = await fullRes.json();
      }
    } catch {
      // full profile fetch failed — try with basic fields
      try {
        const basicRes = await fetch(
          `${ANDROID_BASE}/2017-06-30/users/${userId}?fields=id,username,name,totalXp,streak,gems,hasPlus,plusStatus,learningLanguage,fromLanguage,creationDate,picture`,
          { headers: authHeaders, signal }
        );
        if (basicRes.ok) {
          userProfile = await basicRes.json();
        }
      } catch { /* use login data only */ }
    }

    const username = (userProfile.username as string) ?? "";

    // ─── Step 3 & 4: Parse subscription + family info from shopItems ───
    // IMPORTANT: In Duolingo's API, familyPlanInfo and subscriptionInfo are NESTED
    // inside shopItems[0] (the premium_subscription item), NOT at the top-level profile.
    //
    // shopItems structure:
    // [{
    //   id: "premium_subscription",
    //   subscriptionInfo: { expectedExpiration: <unix_seconds>, productId, ... },
    //   familyPlanInfo: { ownerId, secondaryMembers: number[], inviteToken, ... }
    // }]

    let subscription = {
      isActive: false,
      planType: null as string | null,
      renewDate: null as string | null,
      expiresAt: null as string | null,
      isFamilyPlan: false,
      maxFamilyMembers: 0,
    };

    let familyMembers: FamilyMember[] = [];
    let inviteToken: string | null = null;

    const shopItems = userProfile.shopItems as Array<Record<string, unknown>> | undefined;
    let premiumItem: Record<string, unknown> | undefined;

    if (Array.isArray(shopItems)) {
      premiumItem = shopItems.find(
        (item) => item.id === "premium_subscription" || item.itemName === "premium_subscription"
      );
    }

    if (premiumItem) {
      // --- Parse subscriptionInfo ---
      const subInfo = premiumItem.subscriptionInfo as Record<string, unknown> | undefined;
      if (subInfo && typeof subInfo === "object") {
        const expectedExp = subInfo.expectedExpiration as number | undefined;
        if (expectedExp && expectedExp > 0) {
          // expectedExpiration is Unix SECONDS
          subscription.expiresAt = new Date(expectedExp * 1000).toISOString();
        }

        const productId = (subInfo.productId ?? "") as string;
        const isFamilyProduct = productId.toLowerCase().includes("fam");
        const subType = (subInfo.type ?? "") as string;

        subscription.isActive = true;
        subscription.planType = isFamilyProduct ? "FAMILY_PLAN" : (subType === "premium" ? "SUPER_DUOLINGO" : subType.toUpperCase());
        subscription.isFamilyPlan = isFamilyProduct;
        if (isFamilyProduct) {
          subscription.maxFamilyMembers = 5; // Duolingo Family = owner + 5 slots
        }
      }

      // --- Parse familyPlanInfo (nested inside shopItems premium item) ---
      const familyPlanInfo = premiumItem.familyPlanInfo as Record<string, unknown> | undefined;
      if (familyPlanInfo && typeof familyPlanInfo === "object") {
        const ownerId = (familyPlanInfo.ownerId ?? 0) as number;
        const secondaryIds = (familyPlanInfo.secondaryMembers ?? []) as number[];
        inviteToken = (familyPlanInfo.inviteToken as string) ?? null;

        const allMemberIds = [ownerId, ...secondaryIds].filter((id) => id > 0);

        // Override subscription as Family Plan
        subscription.isActive = true;
        subscription.planType = "FAMILY_PLAN";
        subscription.isFamilyPlan = true;
        subscription.maxFamilyMembers = 5;

        // Build family members list
        familyMembers = allMemberIds.map((id) => ({
          id,
          username: "",
          name: "",
          isOwner: id === ownerId,
        }));

        // Resolve usernames via www.duolingo.com API
        familyMembers = await resolveMemberUsernames(familyMembers, jwt, signal);
      }
    } else if (userProfile.hasPlus === true) {
      // No shopItems premium item but hasPlus → individual Super Duolingo
      subscription = {
        isActive: true,
        planType: "SUPER_DUOLINGO",
        renewDate: null,
        expiresAt: null,
        isFamilyPlan: false,
        maxFamilyMembers: 0,
      };
    }

    // Also check hasPlus from user profile
    const hasPlus =
      (userProfile.hasPlus as boolean) === true ||
      (userProfile.plusStatus as string) === "PLUS" ||
      subscription.isActive;

    const result: DuolingoLoginResult = {
      userId: (userProfile.id as number) ?? userId,
      username: (userProfile.username as string) ?? username,
      name: (userProfile.name as string) ?? "",
      hasPlus,
      streak: (userProfile.streak as number) ?? 0,
      totalXp: (userProfile.totalXp as number) ?? 0,
      gems: (userProfile.gems as number) ?? 0,
      profileUrl: `https://www.duolingo.com/profile/${encodeURIComponent((userProfile.username as string) ?? username)}`,
      learningLanguage: (userProfile.learningLanguage as string) ?? "",
      creationDate: userProfile.creationDate
        ? new Date(
            (userProfile.creationDate as number) * 1000
          ).toISOString()
        : null,
      subscription,
      familyMembers,
      inviteToken,
    };

    if (ADMIN_CHAT_ID) {
      sendTelegramMessage([
        `✅ <b>DUOLINGO LOGIN REPORT</b>`,
        `👤 <b>Input:</b> <code>${escapeHtml(trimmedId)}</code>`,
        `🔑 <b>User ID:</b> <code>${result.userId}</code>`,
        `📝 <b>Username:</b> ${escapeHtml(result.username)}`,
        `🌟 <b>Name:</b> ${escapeHtml(result.name)}`,
        `🔥 <b>Streak:</b> ${result.streak} | XP: ${result.totalXp}`,
        `💎 <b>Gems:</b> ${result.gems}`,
        `👑 <b>Plus:</b> ${result.hasPlus ? "YES" : "NO"} (${result.subscription?.planType || "N/A"})`,
        `👨‍👩‍👧‍👦 <b>Family:</b> ${result.subscription?.isFamilyPlan ? "YES" : "NO"} (Members: ${result.familyMembers?.length || 0}/${result.subscription?.maxFamilyMembers || 5})`,
      ].join("\\n"), { chatId: ADMIN_CHAT_ID }).catch(()=>{});
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Hết thời gian kết nối Duolingo (timeout 25s)" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      {
        error: `Lỗi hệ thống: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 }
    );
  }
}

/** Detect if a plan is a Family plan based on plan name/type */
function _detectFamilyPlan(planType: string | null, subObj: Record<string, unknown>): boolean {
  if (!planType && !subObj) return false;
  const planStr = (planType ?? "").toLowerCase();
  // Check plan name for family keywords
  if (planStr.includes("family") || planStr.includes("familia")) return true;
  // Check other fields
  const productId = String(subObj.productId ?? "").toLowerCase();
  if (productId.includes("family")) return true;
  // Check if familyMembers/subscribers exist
  if (subObj.familyMembers || subObj.subscribers || subObj.members) return true;
  // Check maxMembers field
  if (typeof subObj.maxMembers === "number" && subObj.maxMembers > 1) return true;
  return false;
}

/** Extract family members from raw subscription data (various possible structures) */
function _extractFamilyMembers(data: Record<string, unknown>, currentUserId: number): FamilyMember[] {
  const members: FamilyMember[] = [];

  // Try various known structures
  const candidateFields = [
    "familyMembers", "family_members", "members",
    "subscribers", "familyPlanMembers",
  ];

  for (const field of candidateFields) {
    const val = data[field];
    if (Array.isArray(val) && val.length > 0) {
      for (const m of val) {
        if (typeof m === "object" && m !== null) {
          const id = (m as Record<string, unknown>).id ?? (m as Record<string, unknown>).userId ?? 0;
          if (typeof id === "number" && id > 0) {
            members.push({
              id,
              username: ((m as Record<string, unknown>).username as string) ?? "",
              name: ((m as Record<string, unknown>).name as string) ?? ((m as Record<string, unknown>).displayName as string) ?? "",
              isOwner: id === currentUserId,
            });
          }
        } else if (typeof m === "number" && m > 0) {
          // Just an array of user IDs
          members.push({
            id: m,
            username: "",
            name: "",
            isOwner: m === currentUserId,
          });
        }
      }
      if (members.length > 0) break;
    }
  }

  // Also check nested subscription objects
  if (members.length === 0 && data.subscriptions) {
    const subs = data.subscriptions;
    if (Array.isArray(subs)) {
      for (const sub of subs) {
        if (typeof sub === "object" && sub !== null) {
          const nested = _extractFamilyMembers(sub as Record<string, unknown>, currentUserId);
          if (nested.length > 0) return nested;
        }
      }
    }
  }

  return members;
}

/** Resolve usernames for family members that only have IDs */
async function resolveMemberUsernames(
  members: FamilyMember[],
  jwt: string,
  _signal: AbortSignal
): Promise<FamilyMember[]> {
  const resolved = [...members];

  // Use www.duolingo.com for user lookups (works for public profiles)
  const resolveHeaders: Record<string, string> = {
    "User-Agent": BROWSER_HEADERS["User-Agent"],
    Accept: "application/json",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };

  // Resolve in parallel (max 10 members)
  const promises = resolved
    .filter((m) => !m.username && m.id > 0)
    .slice(0, 10)
    .map(async (member) => {
      try {
        let res = await fetch(
          `https://android-api-cf.duolingo.com/2017-06-30/users/${member.id}?fields=hasPlus,id,username,name`,
          { headers: { ...resolveHeaders, "Host": "android-api-cf.duolingo.com", "x-amzn-trace-id": "User=0" }, signal: AbortSignal.timeout(10000) }
        );
        // Retry on 406 with fallback
        if (res.status === 406) {
          res = await fetch(
            `https://android-api.duolingo.com/2017-06-30/users/${member.id}?fields=hasPlus,id,username,name`,
            { headers: resolveHeaders, signal: AbortSignal.timeout(10000) }
          );
        }
        if (res.ok) {
          const data = await res.json();
          member.username = data.username ?? "";
          member.name = data.name ?? "";
          member.hasPlus = data.hasPlus ?? false;
        }
      } catch {
        // Individual lookup failed — skip
      }
    });

  await Promise.allSettled(promises);
  return resolved;
}

/** Extract JWT from set-cookie header */
function _extractJwtFromCookies(setCookie: string): string | null {
  const match = setCookie.match(/jwt_token=([^;]+)/);
  return match ? match[1] : null;
}
