export const SHORT_LINK_RELAY_COOKIE_NAME = "sl_relay";
export const SHORT_LINK_RELAY_MAX_AGE_SECONDS = 60 * 5;

type ShortLinkRelayPayload = {
  exp: number;
  slug: string;
  token: string | null;
  ua: string;
};

function getShortLinkRelaySecret(env: Record<string, string | undefined> = process.env) {
  return env.SHORT_LINK_RELAY_SECRET ?? env.JWT_SECRET ?? null;
}

function encodeBase64Url(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return atob(padded);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return encodeBase64Url(binary);
}

function base64UrlToBytes(value: string) {
  const binary = decodeBase64Url(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importRelayKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest)).slice(0, 24);
}

export function isShortLinkRelayEnabled(env: Record<string, string | undefined> = process.env) {
  return Boolean(getShortLinkRelaySecret(env));
}

export async function createShortLinkRelayCookieValue(
  input: { slug: string; token?: string | null; userAgent: string | null },
  env: Record<string, string | undefined> = process.env,
) {
  const secret = getShortLinkRelaySecret(env);
  if (!secret) {
    return null;
  }

  const payload: ShortLinkRelayPayload = {
    exp: Date.now() + SHORT_LINK_RELAY_MAX_AGE_SECONDS * 1000,
    slug: input.slug,
    token: input.token ?? null,
    ua: await sha256((input.userAgent ?? "").trim().toLowerCase()),
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const key = await importRelayKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyShortLinkRelayCookieValue(
  value: string | null | undefined,
  input: { userAgent: string | null },
  env: Record<string, string | undefined> = process.env,
) {
  if (!value) {
    return null;
  }

  const secret = getShortLinkRelaySecret(env);
  if (!secret) {
    return null;
  }

  const [encodedPayload, encodedSignature] = value.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  try {
    const key = await importRelayKey(secret, ["verify"]);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );

    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as ShortLinkRelayPayload;
    if (!payload?.slug || typeof payload.exp !== "number" || typeof payload.ua !== "string") {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    const currentUaHash = await sha256((input.userAgent ?? "").trim().toLowerCase());
    if (currentUaHash !== payload.ua) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
