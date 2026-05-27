import { NextResponse } from "next/server";
import { renewOrderForAccount } from "@/domains/orders";
import { withAccount } from "@/lib/api/with-account";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { hasPermission, resolveUser } from "@/lib/api/rbac";
import { isApplicationError } from "@/lib/utils/errors";

export const POST = withErrorHandler(withAccount<{ id: string }>(async (request, { accountId, params }) => {
  const { id } = await params;
  const user = await resolveUser(request, accountId);
  if (!user) {
    return NextResponse.json({ error: "Không thể xác thực người dùng" }, { status: 401 });
  }
  if (!hasPermission(user.role, "order:update")) {
    return NextResponse.json({ error: "Bạn không có quyền gia hạn đơn hàng" }, { status: 403 });
  }

  const body = await request.json() as {
    durationMonths: number;
    addAmountVnd: number;
    addPaidVnd: number;
    note?: string;
    proofUrls?: string[];
  };

  try {
    const renewal = await renewOrderForAccount({
      accountId,
      orderId: id,
      userEmail: user.email,
      durationMonths: body.durationMonths,
      addAmountVnd: body.addAmountVnd,
      addPaidVnd: body.addPaidVnd,
      note: body.note,
      proofUrls: body.proofUrls,
    });

    if (!renewal) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        newExpiresAt: renewal.newExpiresAt,
        premiumSyncWarning: renewal.premiumSyncWarning ?? null,
      },
    });
  } catch (error) {
    if (isApplicationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    throw error;
  }
}));
