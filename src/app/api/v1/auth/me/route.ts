import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/utils/jwt";
import { successResponse, handleError } from "@/lib/utils/api";
import { AuthenticationError } from "@/lib/utils/errors";
import { AuthRepository } from "@/lib/services/auth";

const authRepo = new AuthRepository();

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      throw new AuthenticationError("No token provided");
    }

    const payload = verifyToken(token);
    const user = await authRepo.findUserById(payload.sub as string);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    return NextResponse.json(
      successResponse({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accountId: user.accountId,
      })
    );
  } catch (error) {
    return handleError(error);
  }
}
