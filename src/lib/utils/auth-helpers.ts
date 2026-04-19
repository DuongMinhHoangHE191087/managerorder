import { NextRequest } from "next/server";
import { verifyToken } from "./jwt";
import { AuthenticationError } from "./errors";
import type { JWTPayload } from "@/lib/types/auth";

export function extractTokenFromHeader(request: NextRequest): string {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.split(" ")[1];

  if (!token) {
    throw new AuthenticationError("No token provided");
  }

  return token;
}

export function verifyTokenFromRequest(request: NextRequest): JWTPayload {
  const token = extractTokenFromHeader(request);
  return verifyToken(token);
}
