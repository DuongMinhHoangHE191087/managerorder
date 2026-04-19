// ============================================================
// CREDENTIAL ENCRYPTION — AES-256-GCM (Reversible)
// ============================================================
// Encrypt/Decrypt sensitive credential data (passwords, 2FA, etc.)
// Format: "aes256gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>"
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16; // GCM standard
const PREFIX = "aes256gcm";

/**
 * Get encryption key from environment variable.
 * Key must be 64 hex characters (32 bytes).
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function getKey(): Buffer {
  const keyHex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is not set. " +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (keyHex.length !== 64) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Check if a value is already encrypted (has our prefix).
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

/**
 * Encrypt a plaintext string.
 * Returns format: "aes256gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext || plaintext.trim() === "") return plaintext;

  // Skip if already encrypted
  if (isEncrypted(plaintext)) return plaintext;

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return `${PREFIX}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string back to plaintext.
 * If the value is not encrypted (no prefix), returns it as-is (backward compatible).
 */
export function decryptCredential(encrypted: string): string {
  if (!encrypted || encrypted.trim() === "") return encrypted;

  // Backward compatible: if not encrypted, return as-is
  if (!isEncrypted(encrypted)) return encrypted;

  const parts = encrypted.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted format");
  }

  const [, ivHex, tagHex, cipherHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(cipherHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt all sensitive fields in a credentials array.
 * Encrypts: password values, 2fa, 2fa_backup
 */
export function encryptCredentials(
  credentials: Array<{ type: string; value: string; label?: string }>
): Array<{ type: string; value: string; label?: string }> {
  const sensitiveTypes = new Set(["2fa", "2fa_backup"]);

  return credentials.map((cred) => {
    if (sensitiveTypes.has(cred.type) && cred.value) {
      return { ...cred, value: encryptCredential(cred.value) };
    }
    return cred;
  });
}

/**
 * Decrypt all sensitive fields in a credentials array.
 */
export function decryptCredentials(
  credentials: Array<{ type: string; value: string; label?: string }>
): Array<{ type: string; value: string; label?: string }> {
  return credentials.map((cred) => {
    if (cred.value && isEncrypted(cred.value)) {
      return { ...cred, value: decryptCredential(cred.value) };
    }
    return cred;
  });
}

/**
 * Encrypt notes object — encrypts password and sensitive credentials.
 */
export function encryptNotes(notes: Record<string, unknown>): Record<string, unknown> {
  const result = { ...notes };

  // Encrypt password
  if (typeof result.password === "string" && result.password) {
    result.password = encryptCredential(result.password);
  }

  // Encrypt sensitive credentials
  if (Array.isArray(result.credentials)) {
    result.credentials = encryptCredentials(
      result.credentials as Array<{ type: string; value: string; label?: string }>
    );
  }

  return result;
}

/**
 * Decrypt notes object — decrypts password and credentials.
 */
export function decryptNotes(notes: Record<string, unknown>): Record<string, unknown> {
  const result = { ...notes };

  // Decrypt password
  if (typeof result.password === "string" && result.password) {
    result.password = decryptCredential(result.password);
  }

  // Decrypt credentials
  if (Array.isArray(result.credentials)) {
    result.credentials = decryptCredentials(
      result.credentials as Array<{ type: string; value: string; label?: string }>
    );
  }

  return result;
}
