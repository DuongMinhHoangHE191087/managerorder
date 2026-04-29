import fs from "node:fs/promises";
import fsSync from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import jwt from "jsonwebtoken";
import { loadLocalEnv } from "./load-local-env";
import { createZaloBot } from "../src/lib/zalo/sdk";
import { resolveZaloRuntimeConfig } from "../src/lib/zalo/config";
import { ensureBotLiveFixtures, type BotLiveFixtureSummary } from "./bot-live-fixtures";

loadLocalEnv();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const workspaceDir = path.resolve(appDir, "..", "..");
const outputDir = path.join(workspaceDir, "qa-artifacts", "live-bot-verification");
const reportPath = path.join(outputDir, "report.json");
const runtimeStdoutPath = path.join(outputDir, "runtime.stdout.log");
const runtimeStderrPath = path.join(outputDir, "runtime.stderr.log");
const registerLoaderPath = path.join(appDir, "scripts", "register-ts-loader.mjs");
const registerLoaderUrl = pathToFileURL(registerLoaderPath).href;
const runtimeSupervisorPath = path.join(appDir, "scripts", "runtime-supervisor.ts");
const runtimeEntry = `./${path.relative(appDir, runtimeSupervisorPath).split(path.sep).join("/")}`;
const accountId =
  process.env.NEXT_PUBLIC_TEST_ACCOUNT_ID?.trim() ||
  process.env.TELEGRAM_BOT_ACCOUNT_ID?.trim() ||
  process.env.ACCOUNT_ID?.trim() ||
  "550e8400-e29b-41d4-a716-446655440000";
const jwtSecret = process.env.JWT_SECRET?.trim() ?? "";

type VerificationStatus = "passed" | "failed" | "skipped";

type CheckResult = {
  status: VerificationStatus;
  summary: string;
  details?: Record<string, unknown>;
};

type LiveBotVerificationReport = {
  generatedAt: string;
  environment: {
    runtimeBaseUrl: string | null;
    testAccountId: string;
    telegramConfigured: boolean;
    zaloConfigured: boolean;
  };
  fixtures: CheckResult;
  telegram: {
    api: CheckResult;
    outbound: CheckResult;
  };
  zalo: {
    api: CheckResult;
    outbound: CheckResult;
  };
  runtime: {
    boot: CheckResult;
    status: CheckResult;
    lookup: CheckResult;
    contacts: CheckResult;
    customers: CheckResult;
    reminderReadiness: CheckResult;
  };
};

function redactId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return "*".repeat(trimmed.length);
  }

  return `${"*".repeat(Math.max(trimmed.length - 4, 2))}${trimmed.slice(-4)}`;
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function isPortFree(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function pickPort(): Promise<number> {
  for (const candidate of [3002, 3003, 3010, 3011, 3012]) {
    if (await isPortFree(candidate)) {
      return candidate;
    }
  }

  throw new Error("Không tìm được cổng trống để chạy live runtime verification.");
}

async function telegramApi(method: string, body?: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(
      `Telegram ${method} failed with HTTP ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  return payload.result;
}

async function runTelegramApiCheck(): Promise<CheckResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      status: "skipped",
      summary: "Thiếu TELEGRAM_BOT_TOKEN nên bỏ qua Telegram live API check.",
    };
  }

  const me = await telegramApi("getMe");
  const webhookInfo = await telegramApi("getWebhookInfo");

  const webhookUrl =
    typeof webhookInfo?.url === "string" && webhookInfo.url.trim().length > 0
      ? webhookInfo.url.trim()
      : null;

  let webhookHost: string | null = null;
  if (webhookUrl) {
    try {
      webhookHost = new URL(webhookUrl).host;
    } catch {
      webhookHost = "invalid-url";
    }
  }

  return {
    status: "passed",
    summary: "Telegram token hợp lệ và Bot API phản hồi bình thường.",
    details: {
      botId: me?.id ?? null,
      username: me?.username ?? null,
      displayName: me?.first_name ?? null,
      webhookConfigured: Boolean(webhookUrl),
      webhookHost,
      pendingUpdateCount:
        typeof webhookInfo?.pending_update_count === "number"
          ? webhookInfo.pending_update_count
          : null,
    },
  };
}

async function runTelegramOutboundCheck(): Promise<CheckResult> {
  const chatId =
    process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() ||
    process.env.TELEGRAM_CHAT_ID?.trim() ||
    "";

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    return {
      status: "skipped",
      summary: "Thiếu TELEGRAM_BOT_TOKEN nên bỏ qua Telegram outbound check.",
    };
  }

  if (!chatId) {
    return {
      status: "skipped",
      summary: "Thiếu TELEGRAM_ADMIN_CHAT_ID / TELEGRAM_CHAT_ID nên không có nơi gửi test Telegram.",
    };
  }

  const marker = `LIVE-QA-${Date.now()}`;
  const result = await telegramApi("sendMessage", {
    chat_id: chatId,
    text: `ManagerOrder live verification ${marker}\nKênh: Telegram\nThời gian: ${new Date().toLocaleString("vi-VN")}`,
    disable_notification: true,
  });

  return {
    status: "passed",
    summary: "Đã gửi tin test thật tới Telegram admin chat.",
    details: {
      targetChatId: redactId(chatId),
      messageId: result?.message_id ?? null,
      marker,
    },
  };
}

async function runZaloApiCheck(): Promise<CheckResult> {
  const config = resolveZaloRuntimeConfig(process.env);
  if (!config.botToken) {
    return {
      status: "skipped",
      summary: "Thiếu ZALO_BOT_TOKEN nên bỏ qua Zalo live API check.",
    };
  }

  const bot = createZaloBot(config.botToken);
  await bot.initialize();
  const me = await bot.getMe();

  return {
    status: "passed",
    summary: "Zalo token hợp lệ và bot API phản hồi bình thường.",
    details: {
      appName: config.appName,
      accountId: config.accountId || null,
      adminCount: config.adminUserIds.length,
      botId: me.id,
      displayName: me.displayName,
    },
  };
}

async function runZaloOutboundCheck(): Promise<CheckResult> {
  const config = resolveZaloRuntimeConfig(process.env);
  if (!config.botToken) {
    return {
      status: "skipped",
      summary: "Thiếu ZALO_BOT_TOKEN nên bỏ qua Zalo outbound check.",
    };
  }

  const targetChatId = config.adminUserIds[0];
  if (!targetChatId) {
    return {
      status: "skipped",
      summary: "Thiếu ADMIN_ZALO_USER_IDS nên không có nơi gửi test Zalo.",
    };
  }

  const marker = `LIVE-QA-${Date.now()}`;
  const bot = createZaloBot(config.botToken);
  await bot.initialize();
  await bot.sendMessage(
    targetChatId,
    `ManagerOrder live verification ${marker}\nKênh: Zalo\nThời gian: ${new Date().toLocaleString("vi-VN")}`,
  );

  return {
    status: "passed",
    summary: "Đã gửi tin test thật tới Zalo admin.",
    details: {
      targetChatId: redactId(targetChatId),
      marker,
    },
  };
}

async function waitForRuntime(baseUrl: string, timeoutMs = 120_000) {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.status === "ok" && payload?.service === "managerorder-admin-web") {
          return;
        }
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(
    `Runtime không lên sau ${Math.ceil(timeoutMs / 1000)}s. Last error: ${safeError(lastError)}`,
  );
}

function createAuthHeaders(baseUrl: string): HeadersInit {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing.");
  }

  const token = jwt.sign(
    {
      sub: "codex-live-bot-verification",
      accountId,
      role: "admin_owner",
      email: "codex-live-bot-verification@local",
    },
    jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    },
  );

  return {
    Accept: "application/json",
    Cookie: `access_token=${token}`,
    Origin: baseUrl,
  };
}

async function fetchJson(
  url: string,
  options?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function runRuntimeStatusChecksWithFixtures(
  baseUrl: string,
  fixtures: BotLiveFixtureSummary,
): Promise<{
  boot: CheckResult;
  status: CheckResult;
  lookup: CheckResult;
  contacts: CheckResult;
  customers: CheckResult;
  reminderReadiness: CheckResult;
}> {
  const headers = createAuthHeaders(baseUrl);
  const boot: CheckResult = {
    status: "passed",
    summary: "Runtime start mode đã khởi động thành công.",
    details: { baseUrl },
  };

  const statusResponse = await fetchJson(`${baseUrl}/api/settings/bot/status`, {
    headers,
  });

  const statusPayload = statusResponse.body as
    | { data?: Record<string, unknown>; error?: unknown }
    | null;

  if (statusResponse.status !== 200 || !statusPayload?.data) {
    throw new Error(
      `Bot status route failed with HTTP ${statusResponse.status}: ${JSON.stringify(statusResponse.body)}`,
    );
  }

  const statusData = statusPayload.data as Record<string, unknown>;
  const telegramStatus = (statusData.telegram ?? {}) as Record<string, unknown>;
  const telegramRuntime = (telegramStatus.runtime ?? {}) as Record<string, unknown>;
  const zaloStatus = (statusData.zalo ?? {}) as Record<string, unknown>;
  const zaloRuntime = (zaloStatus.runtime ?? {}) as Record<string, unknown>;
  const statusResult: CheckResult = {
    status:
      (!telegramStatus.tokenConfigured || Boolean(telegramRuntime.healthy)) &&
      (!zaloStatus.tokenConfigured || Boolean(zaloRuntime.healthy))
        ? "passed"
        : "failed",
    summary:
      (!telegramStatus.tokenConfigured || Boolean(telegramRuntime.healthy)) &&
      (!zaloStatus.tokenConfigured || Boolean(zaloRuntime.healthy))
        ? "Đọc được trạng thái runtime bot từ app."
        : "Runtime bot phản hồi nhưng còn ít nhất một kênh chưa healthy.",
    details: {
      telegram: {
        configured: Boolean(telegramStatus.tokenConfigured),
        actualTransport: telegramRuntime.actualTransport ?? null,
        healthy: Boolean(telegramRuntime.healthy),
        webhookUrlConfigured: Boolean(telegramRuntime.webhookUrl),
        pendingUpdateCount: telegramRuntime.pendingUpdateCount ?? null,
        lastErrorMessage: telegramRuntime.lastErrorMessage ?? null,
      },
      zalo: {
        configured: Boolean(zaloStatus.tokenConfigured),
        actualTransport: zaloRuntime.actualTransport ?? null,
        healthy: Boolean(zaloRuntime.healthy),
        lastErrorMessage: zaloRuntime.lastErrorMessage ?? null,
      },
      contacts: statusData.contacts ?? null,
      operational: statusData.operational ?? null,
    },
  };

  const lookupResponse = await fetchJson(`${baseUrl}/api/settings/bot/test-lookup`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: fixtures.lookupPhone }),
  });

  const lookupPayload = lookupResponse.body as
    | { data?: Record<string, unknown>; error?: unknown }
    | null;

  if (lookupResponse.status !== 200 || !lookupPayload?.data) {
    throw new Error(
      `Bot test-lookup route failed with HTTP ${lookupResponse.status}: ${JSON.stringify(lookupResponse.body)}`,
    );
  }

  const lookupData = lookupPayload.data as Record<string, unknown>;
  const lookupResult: CheckResult = {
    status: Number(lookupData.count ?? 0) > 0 ? "passed" : "failed",
    summary:
      Number(lookupData.count ?? 0) > 0
        ? "Route test lookup của bot phản hồi thành công với dữ liệu thật."
        : "Route test lookup phản hồi nhưng chưa tìm thấy dữ liệu fixture.",
    details: {
      query: lookupData.query ?? fixtures.lookupPhone,
      count: lookupData.count ?? 0,
      replyPreviewLength:
        typeof lookupData.replyPreview === "string"
          ? lookupData.replyPreview.length
          : 0,
    },
  };

  const zaloContactsResponse = await fetchJson(
    `${baseUrl}/api/settings/bot/contacts?channel=zalo&matched=true`,
    { headers },
  );
  const telegramContactsResponse = await fetchJson(
    `${baseUrl}/api/settings/bot/contacts?channel=telegram&matched=true`,
    { headers },
  );

  const zaloContactsPayload = zaloContactsResponse.body as
    | { data?: Array<Record<string, unknown>>; error?: unknown }
    | null;
  const telegramContactsPayload = telegramContactsResponse.body as
    | { data?: Array<Record<string, unknown>>; error?: unknown }
    | null;

  const zaloContacts = Array.isArray(zaloContactsPayload?.data)
    ? zaloContactsPayload.data
    : [];
  const telegramContacts = Array.isArray(telegramContactsPayload?.data)
    ? telegramContactsPayload.data
    : [];

  const matchedZalo = zaloContacts.find((contact) => contact.customerId === fixtures.customerId);
  const matchedTelegram = telegramContacts.find((contact) => contact.customerId === fixtures.customerId);

  const contactsResult: CheckResult = {
    status:
      matchedZalo && matchedTelegram && Boolean(matchedZalo.autoReminderEnabled)
        ? "passed"
        : "failed",
    summary:
      matchedZalo && matchedTelegram && Boolean(matchedZalo.autoReminderEnabled)
        ? "Bot contacts đã có dữ liệu match thật cho Telegram/Zalo."
        : "Bot contacts chưa phản ánh đầy đủ fixture match/reminder.",
    details: {
      zaloMatchedCount: zaloContacts.length,
      telegramMatchedCount: telegramContacts.length,
      fixtureZaloAutoReminderEnabled: matchedZalo?.autoReminderEnabled ?? false,
      fixtureTelegramMatched: Boolean(matchedTelegram),
    },
  };

  const customersResponse = await fetchJson(
    `${baseUrl}/api/settings/bot/customers?q=${encodeURIComponent(fixtures.customerName)}`,
    { headers },
  );
  const customersPayload = customersResponse.body as
    | { data?: Array<Record<string, unknown>>; error?: unknown }
    | null;
  const customerCandidates = Array.isArray(customersPayload?.data)
    ? customersPayload.data
    : [];

  const customersResult: CheckResult = {
    status: customerCandidates.some((candidate) => candidate.id === fixtures.customerId)
      ? "passed"
      : "failed",
    summary: customerCandidates.some((candidate) => candidate.id === fixtures.customerId)
      ? "Customer matching trả về fixture thật."
      : "Customer matching chưa trả về fixture đã seed.",
    details: {
      query: fixtures.customerName,
      count: customerCandidates.length,
    },
  };

  const reminderReadiness: CheckResult = {
    status:
      Boolean(fixtures.reminderReady) &&
      Boolean(matchedZalo?.autoReminderEnabled) &&
      Number(lookupData.count ?? 0) > 0
        ? "passed"
        : "failed",
    summary:
      Boolean(fixtures.reminderReady) &&
      Boolean(matchedZalo?.autoReminderEnabled) &&
      Number(lookupData.count ?? 0) > 0
        ? "Lookup, reminder và handoff đã có dữ liệu fixture thật để vận hành."
        : "Fixture reminder/handoff chưa đủ điều kiện để coi là ready.",
    details: {
      orderCode: fixtures.orderCode,
      expiresAt: fixtures.expiresAt,
      lookupPhone: fixtures.lookupPhone,
      matchedZaloAutoReminderEnabled: matchedZalo?.autoReminderEnabled ?? false,
      adminHandoffConfigured: resolveZaloRuntimeConfig(process.env).adminUserIds.length > 0,
    },
  };

  return {
    boot,
    status: statusResult,
    lookup: lookupResult,
    contacts: contactsResult,
    customers: customersResult,
    reminderReadiness,
  };
}

async function stopChild(child: ReturnType<typeof spawn> | null) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill("SIGTERM");
  });
}

async function main() {
  await ensureDir(outputDir);
  await fs.rm(runtimeStdoutPath, { force: true }).catch(() => undefined);
  await fs.rm(runtimeStderrPath, { force: true }).catch(() => undefined);

  const report: LiveBotVerificationReport = {
    generatedAt: new Date().toISOString(),
    environment: {
      runtimeBaseUrl: null,
      testAccountId: accountId,
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      zaloConfigured: Boolean(process.env.ZALO_BOT_TOKEN?.trim()),
    },
    fixtures: { status: "skipped", summary: "Chưa chạy." },
    telegram: {
      api: { status: "skipped", summary: "Chưa chạy." },
      outbound: { status: "skipped", summary: "Chưa chạy." },
    },
    zalo: {
      api: { status: "skipped", summary: "Chưa chạy." },
      outbound: { status: "skipped", summary: "Chưa chạy." },
    },
    runtime: {
      boot: { status: "skipped", summary: "Chưa chạy." },
      status: { status: "skipped", summary: "Chưa chạy." },
      lookup: { status: "skipped", summary: "Chưa chạy." },
      contacts: { status: "skipped", summary: "Chưa chạy." },
      customers: { status: "skipped", summary: "Chưa chạy." },
      reminderReadiness: { status: "skipped", summary: "Chưa chạy." },
    },
  };

  let runtimeChild: ReturnType<typeof spawn> | null = null;
  let stdoutStream: fsSync.WriteStream | null = null;
  let stderrStream: fsSync.WriteStream | null = null;
  let fixtures: BotLiveFixtureSummary | null = null;

  try {
    fixtures = await ensureBotLiveFixtures(process.env);
    report.fixtures = {
      status: "passed",
      summary: "Đã seed/đồng bộ fixture bot live cho lookup, matching và reminder.",
      details: {
        customerId: fixtures.customerId,
        orderId: fixtures.orderId,
        orderCode: fixtures.orderCode,
        telegramContactId: fixtures.telegramContactId,
        zaloContactId: fixtures.zaloContactId,
      },
    };

    report.telegram.api = await runTelegramApiCheck().catch((error) => ({
      status: "failed",
      summary: "Telegram live API check thất bại.",
      details: { error: safeError(error) },
    }));
    report.telegram.outbound = await runTelegramOutboundCheck().catch((error) => ({
      status: "failed",
      summary: "Telegram outbound live check thất bại.",
      details: { error: safeError(error) },
    }));

    report.zalo.api = await runZaloApiCheck().catch((error) => ({
      status: "failed",
      summary: "Zalo live API check thất bại.",
      details: { error: safeError(error) },
    }));
    report.zalo.outbound = await runZaloOutboundCheck().catch((error) => ({
      status: "failed",
      summary: "Zalo outbound live check thất bại.",
      details: { error: safeError(error) },
    }));

    const port = await pickPort();
    const baseUrl = `http://localhost:${port}`;
    report.environment.runtimeBaseUrl = baseUrl;

    stdoutStream = fsSync.createWriteStream(runtimeStdoutPath, { flags: "a" });
    stderrStream = fsSync.createWriteStream(runtimeStderrPath, { flags: "a" });
    const runtimeEnv = {
      ...process.env,
      PORT: String(port),
      BASE_URL: baseUrl,
      RUNTIME_BASE_URL: baseUrl,
      TELEGRAM_RUNTIME_MODE:
        process.env.TELEGRAM_RUNTIME_MODE?.trim() || "polling",
      ZALO_RUNTIME_MODE: process.env.ZALO_RUNTIME_MODE?.trim() || "polling",
    };

    runtimeChild = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--import",
        registerLoaderUrl,
        runtimeEntry,
        "--mode=start",
      ],
      {
        cwd: appDir,
        env: runtimeEnv,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    runtimeChild.stdout?.pipe(stdoutStream);
    runtimeChild.stderr?.pipe(stderrStream);

    await waitForRuntime(baseUrl);
    report.runtime.boot = {
      status: "passed",
      summary: "Runtime start mode đã khởi động thành công.",
      details: { baseUrl },
    };
    const runtimeResults = await runRuntimeStatusChecksWithFixtures(baseUrl, fixtures);
    report.runtime.status = runtimeResults.status;
    report.runtime.lookup = runtimeResults.lookup;
    report.runtime.contacts = runtimeResults.contacts;
    report.runtime.customers = runtimeResults.customers;
    report.runtime.reminderReadiness = runtimeResults.reminderReadiness;
  } catch (error) {
    if (report.fixtures.status === "skipped") {
      report.fixtures = {
        status: "failed",
        summary: "Seed fixture bot live thất bại.",
        details: { error: safeError(error) },
      };
    }
    if (report.runtime.boot.status === "skipped") {
      report.runtime.boot = {
        status: "failed",
        summary: "Runtime live verification thất bại trước khi hoàn tất boot.",
        details: { error: safeError(error) },
      };
    }

    if (report.runtime.status.status === "skipped") {
      report.runtime.status = {
        status: "failed",
        summary: "Không đọc được trạng thái runtime bot từ app.",
        details: { error: safeError(error) },
      };
    }
  } finally {
    await stopChild(runtimeChild);
    stdoutStream?.end();
    stderrStream?.end();
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  }

  const allChecks = [
    report.telegram.api,
    report.telegram.outbound,
    report.zalo.api,
    report.zalo.outbound,
    report.fixtures,
    report.runtime.boot,
    report.runtime.status,
    report.runtime.lookup,
    report.runtime.contacts,
    report.runtime.customers,
    report.runtime.reminderReadiness,
  ];
  const failedChecks = allChecks.filter((check) => check.status === "failed");

  console.log(
    JSON.stringify(
      {
        reportPath,
        failedChecks: failedChecks.length,
        telegram: report.telegram,
        zalo: report.zalo,
        runtime: report.runtime,
      },
      null,
      2,
    ),
  );

  if (failedChecks.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch(async (error) => {
  await ensureDir(outputDir);
  const fallbackReport = {
    generatedAt: new Date().toISOString(),
    fatal: safeError(error),
  };
  await fs.writeFile(reportPath, JSON.stringify(fallbackReport, null, 2), "utf8");
  console.error("[live-bot-verification]", error);
  process.exit(1);
});
