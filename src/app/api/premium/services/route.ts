import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { ApplicationError, ConflictError } from "@/lib/utils/errors";

const createServiceSchema = z.object({
  name: z.string().min(1, "Tên dịch vụ không được để trống"),
  slug: z
    .string()
    .min(1, "Slug không được để trống")
    .regex(/^[a-z0-9-]+$/, "Slug chỉ chứa chữ thường, số và dấu gạch ngang"),
  category: z.string().optional(),
  description: z.string().optional(),
});

export const GET = withFlatAccountHandler(async (_request, { accountId }) => {
  const { data: baseServices, error } = await supabaseAdmin
    .from("premium_service_types")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const { data: packages } = await supabaseAdmin
    .from("premium_packages")
    .select("id, service_type_id")
    .eq("account_id", accountId)
    .is("deleted_at", null);

  const packageCountByServiceType = new Map<string, number>();
  for (const row of packages ?? []) {
    packageCountByServiceType.set(
      row.service_type_id,
      (packageCountByServiceType.get(row.service_type_id) ?? 0) + 1,
    );
  }

  const formattedData = (baseServices ?? []).map((item) => ({
    ...item,
    packages: [{ count: packageCountByServiceType.get(item.id) ?? 0 }],
    package_count: packageCountByServiceType.get(item.id) ?? 0,
  }));

  return createFlatSuccessResponse(formattedData, {
    meta: { total: formattedData.length },
  });
});

export const POST = withFlatAccountHandler(async (request, { accountId }) => {
  const body = await request.json();
  const parsed = createServiceSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApplicationError(
      parsed.error.issues[0]?.message ?? "Dữ liệu đầu vào không hợp lệ",
      400,
      "VALIDATION_ERROR",
    );
  }

  const validated = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("premium_service_types")
    .insert([
      {
        account_id: accountId,
        name: validated.name,
        slug: validated.slug,
        category: validated.category || "other",
        description: validated.description || "",
      },
    ])
    .select()
    .single();

  if (error?.code === "23505") {
    throw new ConflictError("Slug dịch vụ đã tồn tại.");
  }

  if (error) {
    throw error;
  }

  return createFlatSuccessResponse(data, { status: 201 });
});
