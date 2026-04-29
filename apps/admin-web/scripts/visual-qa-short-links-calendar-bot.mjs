import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import {
  createAdminHeaders,
  createAdminToken,
  createSupabaseAdminClient,
  detectBaseURL,
  parseJsonResponse,
} from "./short-link-runtime-utils.mjs";

const baseURL = await detectBaseURL();
const outputDir = path.join(process.cwd(), "qa-artifacts", "short-links-calendar-bot");
const blockedTextPattern =
  /(?:Ã[\u0080-\u00bf\u00a0-\u00ff]|Â[\u0080-\u00bf\u00a0-\u00ff]|Ä[\u0080-\u00bf\u00a0-\u00ff]|Å[\u0080-\u00bf\u00a0-\u00ff]|Æ[\u0080-\u00bf\u00a0-\u00ff]|â(?:€|€™|€œ|€�|€¢|€“|€”|€¦|„|¢)|á[º»¼½¾¿])/;

const report = {
  baseURL,
  generatedAt: new Date().toISOString(),
  screenshots: [],
  publicChecks: [],
  adminChecks: [],
  issues: [],
};

const adminHeaders = createAdminHeaders();
const accessToken = createAdminToken();
const supabaseAdmin = createSupabaseAdminClient();
const createdShortLinkIds = [];

await fs.mkdir(outputDir, { recursive: true });

function issueKey(kind, payload) {
  return JSON.stringify([kind, payload.label, payload.url, payload.message]);
}

function trackIssue(kind, payload) {
  const key = issueKey(kind, payload);
  if (report.issues.some((issue) => issue.key === key)) {
    return;
  }

  report.issues.push({ key, kind, ...payload });
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 });
  await page.waitForTimeout(1000);
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function apiJson(routePath, init = {}) {
  const response = await fetch(`${baseURL}${routePath}`, {
    ...init,
    headers: {
      ...adminHeaders,
      ...(init.headers ?? {}),
    },
    redirect: init.redirect ?? "manual",
  });

  const parsed = await parseJsonResponse(response);
  return {
    response,
    body: parsed.json,
    text: parsed.text,
  };
}

function unwrapData(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }

  return payload;
}

async function saveShot(page, label) {
  const filePath = path.join(outputDir, `${label}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  report.screenshots.push(filePath);
  return filePath;
}

function attachPageDiagnostics(page, scope) {
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    trackIssue("console-error", {
      label: `${scope}-console`,
      url: page.url(),
      message: message.text(),
    });
  });

  page.on("pageerror", (error) => {
    trackIssue("page-error", {
      label: `${scope}-pageerror`,
      url: page.url(),
      message: error.message,
    });
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(baseURL) || response.status() < 400) {
      return;
    }

    trackIssue("network-http-error", {
      label: `${scope}-network`,
      url,
      message: `HTTP ${response.status()}`,
    });
  });
}

async function createExpiredShortLink({
  title,
  failureTemplateKey,
  sellerContactUrl,
}) {
  const createResult = await apiJson("/api/short-links", {
    method: "POST",
    body: JSON.stringify({
      target_url: "https://example.com/codex-qa",
      title,
      expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      delivery_mode: "landing_page",
      require_token: false,
      notify_clicks: false,
      failure_template_key: failureTemplateKey,
      ...(sellerContactUrl ? { seller_contact_url: sellerContactUrl } : {}),
    }),
  });

  if (createResult.response.status !== 201) {
    throw new Error(`Unable to create short-link for QA: ${createResult.response.status} ${createResult.text}`);
  }

  const link = unwrapData(createResult.body);
  if (!link?.id || !link?.slug) {
    throw new Error("Short-link QA seed returned incomplete payload");
  }

  createdShortLinkIds.push(link.id);
  return link;
}

async function capturePublicPage(page, {
  label,
  routePath,
  allowedStatuses = [200],
  expectedText,
  minTextLength = 120,
}) {
  const url = `${baseURL}${routePath}`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await settle(page);
  const screenshot = await saveShot(page, label);
  const text = await page.locator("body").innerText();

  report.publicChecks.push({
    label,
    url,
    status: response?.status() ?? null,
    screenshot,
    textLength: text.length,
  });

  const status = response?.status() ?? 0;
  if (status > 0 && !allowedStatuses.includes(status)) {
    trackIssue("public-http-error", {
      label,
      url,
      message: `Unexpected HTTP ${status}`,
    });
  }

  if (text.length < minTextLength) {
    trackIssue("public-thin-page", {
      label,
      url,
      message: `Only ${text.length} visible characters rendered.`,
    });
  }

  if (blockedTextPattern.test(text)) {
    trackIssue("public-mojibake", {
      label,
      url,
      message: text.slice(0, 400),
    });
  }

  if (expectedText && !expectedText.test(text)) {
    trackIssue("public-missing-copy", {
      label,
      url,
      message: `Expected copy ${expectedText} was not rendered.`,
    });
  }
}

async function runPublicShortLinkChecks(browser) {
  const sellerLink = await createExpiredShortLink({
    title: `QA seller ${Date.now()}`,
    failureTemplateKey: "seller_unlock_request",
    sellerContactUrl: "https://zalo.me/duongminhhoang",
  });

  const customerLink = await createExpiredShortLink({
    title: `QA customer ${Date.now()}`,
    failureTemplateKey: "customer_offer_wall",
    sellerContactUrl: null,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  attachPageDiagnostics(page, "public");

  try {
    await capturePublicPage(page, {
      label: "short-link-expired-seller",
      routePath: `/s/${sellerLink.slug}`,
      expectedText: /Hãy gửi yêu cầu đến người bán để mở lại/i,
    });

    await capturePublicPage(page, {
      label: "short-link-expired-customer",
      routePath: `/s/${customerLink.slug}`,
      expectedText: /duongminhhoang\.store|Mua hàng tại duongminhhoang\.store/i,
    });

    await capturePublicPage(page, {
      label: "short-link-unknown-slug",
      routePath: `/s/codex-missing-${Date.now()}`,
      allowedStatuses: [200, 404],
      minTextLength: 80,
    });
  } finally {
    await context.close();
  }
}

async function runCalendarAndBotChecks(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  await context.addCookies([
    {
      name: "access_token",
      value: accessToken,
      url: baseURL,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  attachPageDiagnostics(page, "admin");

  let createdEventId = null;

  try {
    await page.goto(`${baseURL}/calendar`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);

    const eventTitle = `QA Calendar ${Date.now()}`;
    const createResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/calendar") && response.request().method() === "POST",
    );

    await page.getByRole("button", { name: /Thêm sự kiện/i }).click();
    await page.waitForTimeout(400);

    const modal = page.locator("div.fixed.inset-0").last();
    await modal.locator('input:not([type="date"]):not([type="time"])').first().fill(eventTitle);
    await modal.getByRole("button", { name: /Tạo/i }).last().click();

    const createResponse = await createResponsePromise;
    const createJson = await createResponse.json().catch(() => null);
    const createdEvent = unwrapData(createJson);
    createdEventId = createdEvent?.id ?? null;

    if (!createResponse.ok || !createdEventId) {
      trackIssue("calendar-create-error", {
        label: "calendar-create",
        url: `${baseURL}/calendar`,
        message: `Unexpected create response: ${createResponse.status()} ${JSON.stringify(createJson).slice(0, 400)}`,
      });
    }

    try {
      await page.getByText(eventTitle, { exact: true }).first().waitFor({ timeout: 12_000 });
    } catch (error) {
      trackIssue("calendar-create-not-visible", {
        label: "calendar-create",
        url: `${baseURL}/calendar`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const calendarShot = await saveShot(page, "calendar-create-optimistic");
    report.adminChecks.push({
      label: "calendar-create",
      url: `${baseURL}/calendar`,
      screenshot: calendarShot,
      createdEventId,
      createdEventTitle: eventTitle,
    });

    await page.goto(`${baseURL}/settings/bot`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);

    const lookupQuery = `DMH-CODEX-${Date.now()}`;
    const lookupResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/settings/bot/test-lookup") && response.request().method() === "POST",
    );

    await page.getByPlaceholder(/Nhập mã đơn hoặc SĐT/i).fill(lookupQuery);
    await page.getByRole("button", { name: /Chạy kiểm tra/i }).click();

    const lookupResponse = await lookupResponsePromise;
    const lookupJson = await lookupResponse.json().catch(() => null);
    const lookupPayload = unwrapData(lookupJson);

    if (!lookupResponse.ok || !lookupPayload?.replyPreview) {
      trackIssue("bot-lookup-error", {
        label: "bot-test-lookup",
        url: `${baseURL}/settings/bot`,
        message: `Unexpected lookup response: ${lookupResponse.status()} ${JSON.stringify(lookupJson).slice(0, 500)}`,
      });
    } else {
      await page.locator("pre").first().waitFor({ timeout: 12_000 });
      const previewText = await page.locator("pre").first().innerText();
      if (!previewText.includes(lookupQuery) && !/Không tìm thấy đơn|Kết quả tra cứu/i.test(previewText)) {
        trackIssue("bot-lookup-preview-mismatch", {
          label: "bot-test-lookup",
          url: `${baseURL}/settings/bot`,
          message: previewText.slice(0, 500),
        });
      }
    }

    const botShot = await saveShot(page, "bot-test-lookup");
    report.adminChecks.push({
      label: "bot-test-lookup",
      url: `${baseURL}/settings/bot`,
      screenshot: botShot,
      query: lookupQuery,
      lookupStatus: lookupResponse.status(),
    });
  } finally {
    if (createdEventId) {
      await page.evaluate(async (eventId) => {
        await fetch(`/api/calendar?id=${eventId}`, { method: "DELETE" }).catch(() => null);
      }, createdEventId);
    }

    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });

try {
  await runPublicShortLinkChecks(browser);
  await runCalendarAndBotChecks(browser);
} finally {
  await browser.close();

  if (createdShortLinkIds.length > 0) {
    await supabaseAdmin
      .from("short_link_clicks")
      .delete()
      .in("short_link_id", createdShortLinkIds);

    await supabaseAdmin
      .from("short_links")
      .delete()
      .in("id", createdShortLinkIds);
  }
}

const publicReport = {
  ...report,
  issues: report.issues.map(({ key: _key, ...issue }) => issue),
};

const reportPath = path.join(outputDir, "report.json");
await fs.writeFile(reportPath, JSON.stringify(publicReport, null, 2), "utf8");

console.log(JSON.stringify({ outputDir, reportPath, issueCount: publicReport.issues.length }, null, 2));

if (publicReport.issues.length > 0) {
  process.exit(1);
}
