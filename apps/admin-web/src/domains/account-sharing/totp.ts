import { createHmac } from "node:crypto";

const DEFAULT_PERIOD = 30;
const DEFAULT_DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface TotpResult {
  code: string;
  remainingSeconds: number;
  period: number;
}

export interface ParsedTotpSecret {
  secret: string;
  period: number;
  digits: number;
}

export function parseTotpSecret(value: string, fallbackPeriod = DEFAULT_PERIOD): ParsedTotpSecret {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("TOTP secret is empty");
  }

  if (trimmed.startsWith("otpauth://")) {
    const url = new URL(trimmed);
    const secret = url.searchParams.get("secret");
    if (!secret) {
      throw new Error("TOTP URI is missing secret");
    }

    const period = Number(url.searchParams.get("period") ?? fallbackPeriod);
    const digits = Number(url.searchParams.get("digits") ?? DEFAULT_DIGITS);
    return {
      secret,
      period: Number.isFinite(period) && period > 0 ? period : fallbackPeriod,
      digits: Number.isFinite(digits) && digits > 0 ? digits : DEFAULT_DIGITS,
    };
  }

  if (trimmed.toLowerCase().startsWith("totp:")) {
    return {
      secret: trimmed.slice("totp:".length),
      period: fallbackPeriod,
      digits: DEFAULT_DIGITS,
    };
  }

  return {
    secret: trimmed,
    period: fallbackPeriod,
    digits: DEFAULT_DIGITS,
  };
}

export function isTotpCredentialValue(value: string, format?: string | null): boolean {
  const trimmed = value.trim();
  return format === "totp_secret"
    || trimmed.startsWith("otpauth://")
    || trimmed.toLowerCase().startsWith("totp:");
}

export function generateTotp(value: string, options: { nowMs?: number; period?: number } = {}): TotpResult {
  const parsed = parseTotpSecret(value, options.period ?? DEFAULT_PERIOD);
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const counter = Math.floor(nowSeconds / parsed.period);
  const code = hotp(base32Decode(parsed.secret), counter, parsed.digits);
  const elapsed = nowSeconds % parsed.period;

  return {
    code,
    remainingSeconds: parsed.period - elapsed,
    period: parsed.period,
  };
}

export function base32Decode(input: string): Buffer {
  const normalized = input
    .replace(/\s+/g, "")
    .replace(/=+$/g, "")
    .toUpperCase();
  if (!normalized) {
    throw new Error("Base32 secret is empty");
  }

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 secret");
    }

    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function hotp(secret: Buffer, counter: number, digits: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}
