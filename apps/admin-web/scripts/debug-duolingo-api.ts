// FINAL verification: simulate exact new backend logic
import { writeFileSync } from "fs";

const ANDROID_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "User-Agent": "Duodroid/5.152.1 Dalvik/2.1.0 (Linux; U; Android 13)",
  Accept: "application/json",
};
const ANDROID_BASE = "https://android-api-cf.duolingo.com";

async function main() {
  const loginRes = await fetch(`${ANDROID_BASE}/2017-06-30/login?fields=id`, {
    method: "POST",
    headers: ANDROID_HEADERS,
    body: JSON.stringify({
      distinctId: crypto.randomUUID(),
      identifier: "Duolingoadmin45@edny.net",
      password: "@Phan9999",
    }),
  });
  const jwt = loginRes.headers.get("jwt") ?? "";
  const loginData = await loginRes.json();
  const userId = loginData.id ?? 0;
  const authHeaders = { ...ANDROID_HEADERS, Authorization: `Bearer ${jwt}` };

  // Full profile (no fields filter) — same as new backend
  const fullRes = await fetch(`${ANDROID_BASE}/2017-06-30/users/${userId}`, { headers: authHeaders });
  const userProfile = await fullRes.json();

  // ── NEW BACKEND LOGIC ──
  const shopItems = userProfile.shopItems as Array<Record<string, unknown>> | undefined;
  let premiumItem: Record<string, unknown> | undefined;

  if (Array.isArray(shopItems)) {
    premiumItem = shopItems.find(
      (item) => item.id === "premium_subscription" || item.itemName === "premium_subscription"
    );
  }

  let expiresAt: string | null = null;
  let inviteToken: string | null = null;
  let isFamilyPlan = false;
  let maxFamilyMembers = 0;
  let memberCount = 0;

  if (premiumItem) {
    // Parse subscriptionInfo
    const subInfo = premiumItem.subscriptionInfo as Record<string, unknown> | undefined;
    if (subInfo) {
      const expectedExp = subInfo.expectedExpiration as number | undefined;
      if (expectedExp && expectedExp > 0) {
        expiresAt = new Date(expectedExp * 1000).toISOString();
      }
      const productId = (subInfo.productId ?? "") as string;
      isFamilyPlan = productId.toLowerCase().includes("fam");
      if (isFamilyPlan) maxFamilyMembers = 5;
    }

    // Parse familyPlanInfo
    const familyPlanInfo = premiumItem.familyPlanInfo as Record<string, unknown> | undefined;
    if (familyPlanInfo) {
      const ownerId = (familyPlanInfo.ownerId ?? 0) as number;
      const secondaryIds = (familyPlanInfo.secondaryMembers ?? []) as number[];
      inviteToken = (familyPlanInfo.inviteToken as string) ?? null;
      memberCount = [ownerId, ...secondaryIds].filter(id => id > 0).length;
    }
  }

  const result = {
    userId,
    username: userProfile.username,
    inviteToken,
    inviteUrl: inviteToken ? `https://invite.duolingo.com/family-plan/${inviteToken}` : null,
    expiresAt,
    isFamilyPlan,
    maxFamilyMembers,
    memberCount,
    freeSlots: Math.max(0, maxFamilyMembers - memberCount),
  };

  console.log("\n✅ === FINAL VERIFICATION RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  writeFileSync("scripts/verify-result.json", JSON.stringify(result, null, 2));
}

main().catch(console.error);
