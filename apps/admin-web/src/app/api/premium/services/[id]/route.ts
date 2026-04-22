import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApplicationError, ConflictError } from "@/lib/utils/errors";

export const DELETE = withFlatAccountHandler<{ id: string }>(
  async (_request, { params, accountId }) => {
    const { id } = await params;

    if (!id) {
      throw new ApplicationError("Thiếu ID dịch vụ", 400, "MISSING_ID");
    }

    const { error } = await supabaseAdmin
      .from("premium_service_types")
      .delete()
      .eq("id", id)
      .eq("account_id", accountId);

    if (error?.code === "23503") {
      throw new ConflictError(
        "Không thể xóa dịch vụ này vì đang có gói cước hoặc tài khoản sử dụng.",
      );
    }

    if (error) {
      throw error;
    }

    return createFlatSuccessResponse({ id }, { status: 200 });
  },
);

export const PUT = withFlatAccountHandler<{ id: string }>(
  async (request, { params, accountId }) => {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      throw new ApplicationError("Thiếu ID dịch vụ", 400, "MISSING_ID");
    }

    const { data, error } = await supabaseAdmin
      .from("premium_service_types")
      .update({
        name: body.name,
        slug: body.slug,
        category: body.category,
        description: body.description,
        is_active: body.is_active,
      })
      .eq("id", id)
      .eq("account_id", accountId)
      .select()
      .single();

    if (error?.code === "23505") {
      throw new ConflictError("Slug dịch vụ đã tồn tại.");
    }

    if (error) {
      throw error;
    }

    return createFlatSuccessResponse(data);
  },
);
