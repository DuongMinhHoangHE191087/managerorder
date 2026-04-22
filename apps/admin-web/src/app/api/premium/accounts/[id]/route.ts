import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApplicationError } from "@/lib/utils/errors";

export const DELETE = withFlatAccountHandler<{ id: string }>(
  async (_request, { params, accountId }) => {
    const { id } = await params;

    if (!id) {
      throw new ApplicationError("Thiếu ID tài khoản", 400, "MISSING_ID");
    }

    const { error } = await supabaseAdmin
      .from("premium_accounts")
      .delete()
      .eq("id", id)
      .eq("account_id", accountId);

    if (error?.code === "23503") {
      throw new ApplicationError(
        "Tài khoản đang được liên kết dữ liệu khác, không thể xóa.",
        409,
        "PREMIUM_ACCOUNT_IN_USE",
      );
    }

    if (error) {
      throw error;
    }

    return createFlatSuccessResponse({ id }, { status: 200 });
  },
);
