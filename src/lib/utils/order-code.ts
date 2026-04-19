// ============================================
// ORDER CODE GENERATOR — v2
// ============================================
// Format: DMH_XXXXXX_ddmmyy
//   - DMH_ = prefix cố định
//   - XXXXXX = 6 random chars (collision-safe charset)
//   - _ddmmyy = ngày hết hạn (expires_at)
//
// Example: DMH_A3F8K2_150626 → hết hạn 15/06/2026

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I to avoid confusion

/**
 * Generate a unique order code with expiry date suffix.
 *
 * @param expiresAt - Date string or Date object of order expiration
 * @returns Order code like "DMH_A3F8K2_150626"
 *
 * Collision probability: 30^6 = ~729 million combinations per expiry date.
 * DB has unique compound index (account_id, order_code) as safety net.
 */
export function generateOrderCode(expiresAt?: string | Date | null): string {
  // 6 random chars for maximum uniqueness
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }

  // Format expiry date as ddmmyy
  const dateSuffix = formatDateSuffix(expiresAt);

  return dateSuffix
    ? `DMH_${randomPart}_${dateSuffix}`
    : `DMH_${randomPart}`;
}

/**
 * Format a date into ddmmyy suffix.
 * Returns null if the date is invalid or missing.
 */
function formatDateSuffix(dateInput?: string | Date | null): string | null {
  if (!dateInput) return null;

  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return null;

    // Use UTC consistently to avoid timezone-dependent suffix drift.
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  } catch {
    return null;
  }
}
