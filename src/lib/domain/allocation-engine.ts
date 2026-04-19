import type {
  AllocationSuggestion,
  LicenseKey,
  OrderItem,
  ProductService,
  SourceAccount,
} from "@/lib/domain/types";

interface AllocationContext {
  orderId: string;
  orderItem: OrderItem;
  product: ProductService;
  sourceAccounts: SourceAccount[];
  licenseKeys: LicenseKey[];
}

export interface AccountSuggestion {
  sourceAccountId: string;
  email: string;
  score: number;
  reason: string;
  availableSlots: number;
  expiresAt: string;
  daysLeft: number;
}

export function daysUntil(isoDate: string): number {
  const now = new Date();
  const end = new Date(isoDate);

  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const startOfTarget = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );

  return Math.trunc((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
}

/**
 * Enhanced scoring algorithm for source accounts.
 *
 * Scoring criteria (higher = better):
 * 1. Nick match bonus (+100000) — exact match with preferred customer nick
 * 2. Fill-first bonus — fewer free slots → higher score (pack accounts full)
 * 3. FIFO bonus — closer to expiry → higher score (use expiring accounts first)
 * 4. Expired penalty (-999999) — never suggest expired accounts
 */
export function scoreSourceAccount(
  account: SourceAccount,
  preferredNick?: string | null,
): number {
  const freeSlots = account.maxSlots - account.usedSlots;
  const expiryDays = daysUntil(account.expiresAt);

  // Expired accounts get hard penalty
  if (expiryDays < 0) return -999999;

  // Base score: available capacity
  let score = freeSlots * 10;

  // FIFO bonus: prefer accounts expiring sooner (inverse: fewer days = more bonus)
  // Max bonus = 500 (for accounts expiring today), decreasing to 0 at 365+ days
  const fifoBonusCap = 500;
  score += Math.max(0, fifoBonusCap - expiryDays);

  // Fill-first bonus: prefer accounts with fewer free slots (pack them full)
  // Accounts with 1 slot free get 200 bonus, 2 gets 180, etc.
  const fillBonus = Math.max(0, 220 - freeSlots * 20);
  score += fillBonus;

  // Nick match: massive bonus for exact match
  if (
    preferredNick &&
    account.email.toLowerCase() === preferredNick.toLowerCase()
  ) {
    score += 100000;
  }

  return score;
}

/**
 * Suggest top N source accounts for a given product + quantity.
 * Returns sorted suggestions with human-readable reasons.
 */
export function suggestTopAccounts(
  productId: string,
  quantity: number,
  accounts: SourceAccount[],
  preferredNick?: string | null,
  topN: number = 3,
): AccountSuggestion[] {
  const now = Date.now();

  // Filter: must support the product, have enough slots, not expired
  const candidates = accounts.filter((a) => {
    if (!a.productIds.includes(productId)) return false;
    if (a.maxSlots - a.usedSlots < quantity) return false;
    if (new Date(a.expiresAt).getTime() < now) return false;
    return true;
  });

  // Score and sort descending
  const scored = candidates
    .map((a) => {
      const score = scoreSourceAccount(a, preferredNick);
      const expiryDays = daysUntil(a.expiresAt);
      const freeSlots = a.maxSlots - a.usedSlots;
      const reasons: string[] = [];

      // Build reason text
      if (
        preferredNick &&
        a.email.toLowerCase() === preferredNick.toLowerCase()
      ) {
        reasons.push("Khớp nick khách hàng");
      }
      if (expiryDays <= 30) {
        reasons.push(`FIFO: hết hạn ${expiryDays}d`);
      }
      if (freeSlots <= 3) {
        reasons.push(`Gần đầy (${freeSlots} slot trống)`);
      }
      if (reasons.length === 0) {
        reasons.push(`${freeSlots} slot trống, còn ${expiryDays}d`);
      }

      return {
        sourceAccountId: a.id,
        email: a.email,
        score,
        reason: reasons.join(" · "),
        availableSlots: freeSlots,
        expiresAt: a.expiresAt,
        daysLeft: expiryDays,
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

export function createAllocationSuggestion(
  context: AllocationContext,
): AllocationSuggestion {
  const { orderId, orderItem, product, sourceAccounts, licenseKeys } = context;
  const warnings: string[] = [];

  const requiresSlot = product.mode === "slot" || product.mode === "hybrid";
  const requiresKey = product.mode === "key" || product.mode === "hybrid";

  const candidateSourceAccount = sourceAccounts
    .filter((account) => account.productIds.includes(product.id))
    .filter(
      (account) =>
        account.maxSlots - account.usedSlots >= orderItem.quantity,
    )
    .sort(
      (left, right) =>
        scoreSourceAccount(right, orderItem.customerNickUsed) -
        scoreSourceAccount(left, orderItem.customerNickUsed),
    )[0];

  const candidateKey = licenseKeys.find(
    (licenseKey) =>
      licenseKey.productId === product.id && licenseKey.status === "available",
  );

  if (requiresSlot && !candidateSourceAccount) {
    warnings.push("Khong tim thay account nguon du slot cho don hang nay.");
  }

  if (requiresKey && !candidateKey) {
    warnings.push("Khong con license key trong kho cho san pham nay.");
  }

  return {
    orderId,
    sourceAccountId: candidateSourceAccount?.id,
    licenseKeyId: candidateKey?.id,
    isValid: warnings.length === 0,
    warnings,
  };
}
