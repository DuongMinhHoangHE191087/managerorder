import { createCipheriv, randomBytes } from "crypto";
import { ApplicationError } from "@/lib/utils/errors";

function getPremiumEncryptionKey() {
  const keyHex =
    process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new ApplicationError(
      "PREMIUM_PASSWORD_ENCRYPTION_KEY chưa được cấu hình",
      500,
      "PREMIUM_ENCRYPTION_KEY_MISSING",
    );
  }

  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new ApplicationError(
      "PREMIUM_PASSWORD_ENCRYPTION_KEY phải là chuỗi hex 64 ký tự",
      500,
      "PREMIUM_ENCRYPTION_KEY_INVALID",
    );
  }

  return keyHex;
}

export function encryptPremiumPassword(plaintext: string): string {
  const key = Buffer.from(getPremiumEncryptionKey(), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}
