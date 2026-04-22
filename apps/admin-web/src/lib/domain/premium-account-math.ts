export function calculateAvailableSlots(
  totalSlots: number,
  usedSlots: number,
): number {
  return Math.max(0, totalSlots - usedSlots);
}

export function hasAvailableSlots(
  totalSlots: number,
  usedSlots: number,
): boolean {
  return usedSlots < totalSlots;
}

export function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
}

export function isExpiringSoon(
  expiryDate: string,
  daysThreshold = 7,
): boolean {
  const today = new Date();
  const expiryDateObj = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil(
    (expiryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  return daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
}

export function getDaysRemaining(expiryDate: string): number {
  const today = new Date();
  const expiryDateObj = new Date(expiryDate);
  const daysRemaining = Math.ceil(
    (expiryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  return Math.max(0, daysRemaining);
}

export function calculateProratedRefund(
  originalPrice: number,
  startDate: string,
  expiryDate: string,
): number {
  const start = new Date(startDate);
  const expiry = new Date(expiryDate);
  const today = new Date();

  if (today >= expiry) {
    return 0;
  }

  const totalDays = Math.ceil(
    (expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const remainingDays = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const refund = (remainingDays / totalDays) * originalPrice;
  return Math.round(refund * 100) / 100;
}
