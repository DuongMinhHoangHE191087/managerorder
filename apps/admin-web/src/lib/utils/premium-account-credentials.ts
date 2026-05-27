import { createCipheriv, createHash, randomBytes } from "crypto";
import { ApplicationError } from "@/lib/utils/errors";

function getPremiumEncryptionKeyBuffer() {
  const keyHex =
    process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new ApplicationError(
      "PREMIUM_PASSWORD_ENCRYPTION_KEY chưa được cấu hình",
      500,
      "PREMIUM_ENCRYPTION_KEY_MISSING",
    );
  }

  if (/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    return Buffer.from(keyHex, "hex");
  }

  return createHash("sha256").update(keyHex, "utf8").digest();
}

export function encryptPremiumPassword(plaintext: string): string {
  const key = getPremiumEncryptionKeyBuffer();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}
