import jwt, { type SignOptions } from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("FATAL: JWT_SECRET environment variable is required. Set it in .env.local");
  }
  return secret;
}

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_TOKEN_EXPIRY || "24h";
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_TOKEN_EXPIRY || "7d";

export interface TokenPayload {
  sub: string;
  accountId: string;
  role: string;
  email: string;
}

export function generateAccessToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  const opts: SignOptions = { expiresIn: ACCESS_TOKEN_EXPIRY as SignOptions["expiresIn"], algorithm: "HS256" };
  return jwt.sign(payload as Record<string, unknown>, getJwtSecret(), opts);
}

export function generateRefreshToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  const opts: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRY as SignOptions["expiresIn"], algorithm: "HS256" };
  return jwt.sign(payload as Record<string, unknown>, getJwtSecret(), opts);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as TokenPayload;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}
