import { createCipheriv, randomBytes } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createFlatSuccessResponse,
  withFlatAccountHandler,
} from "@/lib/api/flat-response";
import { ApplicationError, ConflictError } from "@/lib/utils/errors";
import { loadRowsByIds } from "@/app/api/premium/relation-fallback";
import {
  buildLocalPremiumAccounts,
  shouldUseLocalPremiumFallback,
} from "@/app/api/premium/local-fixtures";

type PremiumAccountWithRelations = {
  service?: {
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
  package?: {
    name: string;
    slug: string;
    total_slots: number;
  } | null;
};

const createAccountSchema = z.object({
  service_type_id: z.string().uuid("Dịch vụ không hợp lệ"),
  package_id: z.string().uuid("Gói cước không hợp lệ"),
  primary_email: z.string().email("Email không hợp lệ"),
  primary_password_encrypted: z.string().min(1, "Mật khẩu không được để trống"),
  total_slots: z.number().min(1, "Số slot phải lớn hơn 0"),
  subscription_start_date: z
    .string()
    .optional()
    .refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      "Ngày bắt đầu không hợp lệ",
    ),
  subscription_expiry_date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Ngày hết hạn không hợp lệ"),
});

function formatPremiumAccountRow<T extends PremiumAccountWithRelations>(account: T): T {
  return {
    ...account,
    service: account.service
      ? {
          name: account.service.name,
          slug: account.service.slug,
          logo_url: account.service.logo_url,
        }
      : null,
    package: account.package
      ? {
          name: account.package.name,
          slug: account.package.slug,
          total_slots: account.package.total_slots,
        }
      : null,
  };
}

function getPremiumEncryptionKey() {
  const keyHex =
    process.env.PREMIUM_PASSWORD_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new ApplicationError(
      "PREMIUM_PASSWORD_ENCRYPTION_KEY chưa được cấu hình",
      500,
      "PREMIUM_ENCRYPTION_KEY_MISSING",
    );
  }

  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new ApplicationError(
      "PREMIUM_PASSWORD_ENCRYPTION_KEY phải là chuỗi hex 64 ký tự",
      500,
      "PREMIUM_ENCRYPTION_KEY_INVALID",
    );
  }

  return keyHex;
}

function encryptPassword(plaintext: string): string {
  const key = Buffer.from(getPremiumEncryptionKey(), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export const GET = withFlatAccountHandler(async (_request, { accountId }) => {
  const preferLocalPremiumFixtures =
    process.env.NODE_ENV === "development" &&
    process.env.CODEX_DISABLE_LOCAL_FALLBACK !== "1";

  if (preferLocalPremiumFixtures) {
    const fallbackAccounts = buildLocalPremiumAccounts(accountId);
    return createFlatSuccessResponse(fallbackAccounts, {
      meta: { total: fallbackAccounts.length },
    });
  }

  try {
    const { data: baseAccounts, error } = await supabaseAdmin
      .from("premium_accounts")
      .select("*")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const serviceTypeIds = [
      ...new Set(
        (baseAccounts ?? [])
          .map((item) => item.service_type_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const packageIds = [
      ...new Set(
        (baseAccounts ?? [])
          .map((item) => item.package_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [serviceMap, packageMap] = await Promise.all([
      loadRowsByIds<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
      }>(
        supabaseAdmin,
        "premium_service_types",
        accountId,
        serviceTypeIds,
        "id, name, slug, logo_url",
      ),
      loadRowsByIds<{
        id: string;
        name: string;
        slug: string;
        total_slots: number;
      }>(
        supabaseAdmin,
        "premium_packages",
        accountId,
        packageIds,
        "id, name, slug, total_slots",
      ),
    ]);

    const formattedData = (baseAccounts ?? []).map((item) =>
      formatPremiumAccountRow({
        ...item,
        service: serviceMap.get(item.service_type_id) ?? null,
        package: packageMap.get(item.package_id) ?? null,
      }),
    );

    return createFlatSuccessResponse(formattedData, {
      meta: { total: formattedData.length },
    });
  } catch (error) {
    if (shouldUseLocalPremiumFallback(error)) {
      const fallbackAccounts = buildLocalPremiumAccounts(accountId);
      return createFlatSuccessResponse(fallbackAccounts, {
        meta: { total: fallbackAccounts.length },
      });
    }

    if (process.env.CODEX_DEBUG_API_ERRORS === "1") {
      console.error("[API /premium/accounts]", error);
    }
    throw error;
  }
});

export const POST = withFlatAccountHandler(async (request, { accountId }) => {
  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApplicationError(
      parsed.error.issues[0]?.message ?? "Dữ liệu đầu vào không hợp lệ",
      400,
      "VALIDATION_ERROR",
    );
  }

  const validated = parsed.data;
  const encryptedPassword = encryptPassword(validated.primary_password_encrypted);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("premium_accounts")
    .insert([
      {
        account_id: accountId,
        service_type_id: validated.service_type_id,
        package_id: validated.package_id,
        primary_email: validated.primary_email,
        primary_password_encrypted: encryptedPassword,
        total_slots: validated.total_slots,
        used_slots: 0,
        subscription_start_date:
          validated.subscription_start_date ?? new Date().toISOString(),
        subscription_expiry_date: validated.subscription_expiry_date,
        status: "active",
        connection_status: "manual_check_needed",
      },
    ])
    .select("id")
    .single();

  if (insertError?.code === "23505") {
    throw new ConflictError("Email tài khoản này đã tồn tại trong hệ thống.");
  }

  if (insertError) {
    throw insertError;
  }

  if (!inserted?.id) {
    throw new ApplicationError(
      "Không thể tạo tài khoản premium",
      500,
      "PREMIUM_ACCOUNT_CREATE_FAILED",
    );
  }

  const { data: baseAccount, error: baseError } = await supabaseAdmin
    .from("premium_accounts")
    .select("*")
    .eq("id", inserted.id)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .single();

  if (baseError || !baseAccount) {
    throw baseError ?? new ApplicationError(
      "Không thể tải tài khoản premium vừa tạo",
      500,
      "PREMIUM_ACCOUNT_CREATE_FAILED",
    );
  }

  const serviceMap = await loadRowsByIds<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  }>(
    supabaseAdmin,
    "premium_service_types",
    accountId,
    [baseAccount.service_type_id],
    "id, name, slug, logo_url",
  );

  const packageMap = await loadRowsByIds<{
    id: string;
    name: string;
    slug: string;
    total_slots: number;
  }>(
    supabaseAdmin,
    "premium_packages",
    accountId,
    [baseAccount.package_id],
    "id, name, slug, total_slots",
  );

  return createFlatSuccessResponse(
    formatPremiumAccountRow({
      ...baseAccount,
      service: serviceMap.get(baseAccount.service_type_id) ?? null,
      package: packageMap.get(baseAccount.package_id) ?? null,
    }),
    { status: 201 },
  );
});
