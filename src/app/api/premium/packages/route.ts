import { NextRequest as _NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";

export const GET = withFlatAccountHandler(async (request, { accountId }) => {
  const { searchParams } = new URL(request.url);
  const serviceTypeId = searchParams.get("service_type_id");

  let query = supabaseAdmin
    .from("premium_packages")
    .select("*")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (serviceTypeId) {
    query = query.eq("service_type_id", serviceTypeId);
  }

  const { data: basePackages, error } = await query.order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const serviceTypeIds = [
    ...new Set(
      (basePackages ?? [])
        .map((item) => item.service_type_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const serviceTypeMap = await loadRowsByIds<{
    id: string;
    name: string;
    slug: string;
  }>(
    supabaseAdmin,
    "premium_service_types",
    accountId,
    serviceTypeIds,
    "id, name, slug",
  );

  const formattedPackages = (basePackages ?? [])
    .map((item) => ({
      ...item,
      service: serviceTypeMap.get(item.service_type_id) ?? null,
    }))
    .filter((item) => item.service !== null);

  return createFlatSuccessResponse(formattedPackages, {
    meta: { total: formattedPackages.length },
  });
});
