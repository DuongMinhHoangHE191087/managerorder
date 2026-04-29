import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { detectRuntimeBaseURL } from "./detect-base-url.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const workspaceDir = path.resolve(appDir, "..", "..");
const envPath = path.join(appDir, ".env.local");
const outputDir = path.join(workspaceDir, "qa-artifacts", "admin-premium-runtime");

const routes = [
  { label: "customers", path: "/customers" },
  { label: "customers-new", path: "/customers/new" },
  { label: "trash", path: "/trash" },
  { label: "premium-accounts", path: "/premium/accounts" },
  { label: "premium-account-detail", path: "/premium/accounts/premium-local-spotify" },
  { label: "premium-renewals", path: "/premium/renewals" },
  { label: "premium-migrations", path: "/premium/migrations" },
  { label: "premium-subscriptions", path: "/premium/subscriptions" },
  { label: "premium-health-checks", path: "/premium/health-checks" },
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 960 },
];

const SEEDED_RENEWAL_REQUEST_CUSTOMER = "Seed Renewal Request QA";
const SEEDED_RENEWAL_PENDING_CUSTOMER = "Seed Renewal Pending QA";
const requireSeededModalScenarios = process.env.REQUIRE_PREMIUM_SEEDED_MODALS === "1";

const blockedTextPattern =
  /(?:Ã[\u0080-\u00bf\u00a0-\u00ff]|Â[\u0080-\u00bf\u00a0-\u00ff]|Ä[\u0080-\u00bf\u00a0-\u00ff]|Å[\u0080-\u00bf\u00a0-\u00ff]|Æ[\u0080-\u00bf\u00a0-\u00ff]|â(?:€|€™|€œ|€�|€¢|€“|€”|€¦|„|¢)|á[º»¼½¾¿])/;

const report = {
  baseURL: "",
  generatedAt: new Date().toISOString(),
  routes: [],
  screenshots: [],
  apiChecks: [],
  issues: [],
};

await fs.mkdir(outputDir, { recursive: true });
const baseURL = await detectRuntimeBaseURL();
report.baseURL = baseURL;

const envSource = await fs.readFile(envPath, "utf8").catch(() => "");

function readEnvValue(name) {
  const match = envSource.match(new RegExp(`^${name}=(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^"|"$/g, "");
}

const jwtSecret = process.env.JWT_SECRET ?? readEnvValue("JWT_SECRET");
const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  readEnvValue("SUPABASE_URL") ??
  readEnvValue("NEXT_PUBLIC_SUPABASE_URL");
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  readEnvValue("SUPABASE_SERVICE_ROLE_KEY") ??
  readEnvValue("SUPABASE_SERVICE_KEY");
const testAccountId =
  process.env.NEXT_PUBLIC_TEST_ACCOUNT_ID ??
  readEnvValue("NEXT_PUBLIC_TEST_ACCOUNT_ID") ??
  "550e8400-e29b-41d4-a716-446655440000";

function createAccessToken(adminUser) {
  if (!jwtSecret) {
    return null;
  }

  const payload = {
    accountId: adminUser?.account_id ?? testAccountId,
    role: adminUser?.role ?? "admin_owner",
    email: adminUser?.email ?? "codex-admin-runtime-qa@local",
  };

  if (adminUser?.id) {
    payload.sub = adminUser.id;
  }

  return jwt.sign(payload, jwtSecret, {
    algorithm: "HS256",
    expiresIn: "24h",
  });
}

function issueKey(kind, payload) {
  return JSON.stringify([kind, payload.viewport, payload.label, payload.url, payload.message]);
}

function trackIssue(kind, payload) {
  const key = issueKey(kind, payload);
  if (report.issues.some((issue) => issue.key === key)) {
    return;
  }

  report.issues.push({ key, kind, ...payload });
}

async function resolveQaAdminUser() {
  if (!supabaseUrl || !supabaseServiceKey) {
    trackIssue("auth-warning", {
      viewport: "setup",
      label: "qa-admin",
      url: baseURL,
      message: "Supabase service env is unavailable; JWT will fall back to email-only identity.",
    });
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("admin_users")
      .select("id,email,role,account_id")
      .eq("account_id", testAccountId)
      .limit(1)
      .maybeSingle();

    if (error) {
      trackIssue("auth-warning", {
        viewport: "setup",
        label: "qa-admin",
        url: baseURL,
        message: `Unable to resolve admin_users row: ${error.message}`,
      });
      return null;
    }

    if (!data) {
      trackIssue("auth-warning", {
        viewport: "setup",
        label: "qa-admin",
        url: baseURL,
        message: `No admin_users row found for account ${testAccountId}.`,
      });
      return null;
    }

    return data;
  } catch (error) {
    trackIssue("auth-warning", {
      viewport: "setup",
      label: "qa-admin",
      url: baseURL,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function captureRoute(page, viewport, route) {
  const url = `${baseURL}${route.path}`;
  const routeResult = {
    viewport: viewport.name,
    label: route.label,
    url,
    status: "unknown",
    title: "",
    textLength: 0,
    hasOverlay: false,
    horizontalOverflow: false,
    mojibake: false,
    screenshot: "",
  };

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);

    const screenshotPath = path.join(outputDir, `${viewport.name}-${route.label}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const diagnostics = await page.evaluate((patternSource) => {
      const text = document.body.innerText.trim();
      const overlay = document.querySelector(
        "[data-nextjs-dialog], .nextjs-portal, .vite-error-overlay, #webpack-dev-server-client-overlay",
      );
      const doc = document.documentElement;
      const overflowingNodes = Array.from(document.querySelectorAll("body *"))
        .filter((node) => {
          const element = /** @type {HTMLElement} */ (node);
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.right > window.innerWidth + 2;
        })
        .slice(0, 8)
        .map((node) => {
          const element = /** @type {HTMLElement} */ (node);
          return {
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 160),
            text: element.innerText?.trim().slice(0, 120) ?? "",
            right: Math.round(element.getBoundingClientRect().right),
          };
        });

      const mojibakeRegex = new RegExp(patternSource, "g");
      const mojibakeContexts = [];
      let match;
      while ((match = mojibakeRegex.exec(text)) && mojibakeContexts.length < 6) {
        mojibakeContexts.push(text.slice(Math.max(0, match.index - 80), match.index + 120));
      }

      return {
        title: document.title,
        textLength: text.length,
        hasOverlay: Boolean(overlay),
        overlayText: overlay?.textContent?.slice(0, 1200) ?? "",
        horizontalOverflow: doc.scrollWidth > window.innerWidth + 2,
        overflowWidth: doc.scrollWidth,
        viewportWidth: window.innerWidth,
        overflowingNodes,
        mojibake: mojibakeContexts.length > 0,
        mojibakeContexts,
        mojibakeSample: mojibakeContexts[0] ?? "",
      };
    }, blockedTextPattern.source);

    routeResult.status = response ? String(response.status()) : "no-response";
    routeResult.title = diagnostics.title;
    routeResult.textLength = diagnostics.textLength;
    routeResult.hasOverlay = diagnostics.hasOverlay;
    routeResult.horizontalOverflow = diagnostics.horizontalOverflow;
    routeResult.mojibake = diagnostics.mojibake;
    routeResult.screenshot = screenshotPath;

    report.screenshots.push(screenshotPath);

    if (!response || response.status() >= 400) {
      trackIssue("route-http-error", {
        viewport: viewport.name,
        label: route.label,
        url,
        message: response ? `HTTP ${response.status()}` : "No navigation response",
      });
    }

    if (diagnostics.textLength < 80) {
      trackIssue("blank-or-thin-page", {
        viewport: viewport.name,
        label: route.label,
        url,
        message: `Only ${diagnostics.textLength} visible characters rendered.`,
      });
    }

    if (diagnostics.hasOverlay) {
      trackIssue("framework-overlay", {
        viewport: viewport.name,
        label: route.label,
        url,
        message: diagnostics.overlayText || "Framework error overlay detected.",
      });
    }

    if (diagnostics.horizontalOverflow) {
      trackIssue("horizontal-overflow", {
        viewport: viewport.name,
        label: route.label,
        url,
        message: `scrollWidth=${diagnostics.overflowWidth}, viewport=${diagnostics.viewportWidth}, nodes=${JSON.stringify(
          diagnostics.overflowingNodes,
        )}`,
      });
    }

    if (diagnostics.mojibake) {
      trackIssue("mojibake", {
        viewport: viewport.name,
        label: route.label,
        url,
        message: `Detected corrupted text: ${diagnostics.mojibakeContexts.join(" || ")}`,
      });
    }
  } catch (error) {
    routeResult.status = "failed";
    trackIssue("route-failure", {
      viewport: viewport.name,
      label: route.label,
      url,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  report.routes.push(routeResult);
}

async function saveScenarioScreenshot(page, viewport, label) {
  const screenshotPath = path.join(outputDir, `${viewport.name}-${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  report.screenshots.push(screenshotPath);
  return screenshotPath;
}

function findRowByText(page, text) {
  return page
    .locator("article, tr, [role='row'], .glass-card, .app-card")
    .filter({ hasText: text })
    .first();
}

async function captureSeededRenewalRequestModal(page, viewport) {
  const url = `${baseURL}/premium/subscriptions`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);
    const marker = page.getByText(SEEDED_RENEWAL_REQUEST_CUSTOMER, { exact: false }).first();
    const hasSeededScenario = await marker.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSeededScenario) {
      if (requireSeededModalScenarios) {
        trackIssue("seeded-modal-missing", {
          viewport: viewport.name,
          label: "premium-subscriptions-renewal-modal-seeded",
          url,
          message: `Seed customer "${SEEDED_RENEWAL_REQUEST_CUSTOMER}" was not visible.`,
        });
      }
      return;
    }

    const row = findRowByText(page, SEEDED_RENEWAL_REQUEST_CUSTOMER);
    const actionButton = row.getByRole("button", { name: "Gia hạn" }).first();
    await actionButton.click();
    await page.getByRole("heading", { name: "Tạo yêu cầu gia hạn premium" }).waitFor({
      state: "visible",
      timeout: 20_000,
    });
    await page.waitForTimeout(400);
    await saveScenarioScreenshot(page, viewport, "premium-subscriptions-renewal-modal-seeded");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  } catch (error) {
    trackIssue("seeded-modal-failure", {
      viewport: viewport.name,
      label: "premium-subscriptions-renewal-modal-seeded",
      url,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function captureSeededRenewalConfirmModal(page, viewport) {
  const url = `${baseURL}/premium/renewals`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await settle(page);
    const marker = page.getByText(SEEDED_RENEWAL_PENDING_CUSTOMER, { exact: false }).first();
    const hasSeededScenario = await marker.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasSeededScenario) {
      if (requireSeededModalScenarios) {
        trackIssue("seeded-modal-missing", {
          viewport: viewport.name,
          label: "premium-renewals-confirm-modal-seeded",
          url,
          message: `Seed customer "${SEEDED_RENEWAL_PENDING_CUSTOMER}" was not visible.`,
        });
      }
      return;
    }

    const row = findRowByText(page, SEEDED_RENEWAL_PENDING_CUSTOMER);
    const actionButton = row.getByRole("button", { name: "Xác nhận" }).first();
    await actionButton.click();
    await page.getByRole("heading", { name: "Xác nhận gia hạn premium" }).waitFor({
      state: "visible",
      timeout: 20_000,
    });
    await page.waitForTimeout(400);
    await saveScenarioScreenshot(page, viewport, "premium-renewals-confirm-modal-seeded");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  } catch (error) {
    trackIssue("seeded-modal-failure", {
      viewport: viewport.name,
      label: "premium-renewals-confirm-modal-seeded",
      url,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runApiChecks(context) {
  const checks = [
    {
      label: "premium-local-account-detail",
      method: "GET",
      path: "/api/premium/accounts/premium-local-spotify",
    },
    {
      label: "auto-renewal-history-filtered",
      method: "GET",
      path: "/api/premium/renewals/auto-run/history?page=1&limit=5&created_by=system",
    },
    {
      label: "trash-short-links",
      method: "GET",
      path: "/api/trash?type=short_links",
    },
  ];

  for (const check of checks) {
    const url = `${baseURL}${check.path}`;
    try {
      const response = await context.request.fetch(url, { method: check.method, timeout: 60_000 });
      const bodyText = await response.text();
      const result = {
        label: check.label,
        method: check.method,
        url,
        status: response.status(),
        bodyPreview: bodyText.slice(0, 500),
      };
      report.apiChecks.push(result);

      if (response.status() >= 400) {
        trackIssue("api-http-error", {
          viewport: "api",
          label: check.label,
          url,
          message: `HTTP ${response.status()}: ${bodyText.slice(0, 500)}`,
        });
      }
    } catch (error) {
      trackIssue("api-failure", {
        viewport: "api",
        label: check.label,
        url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function runViewport(browser, viewport, accessToken) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });

  if (accessToken) {
    await context.addCookies([
      {
        name: "access_token",
        value: accessToken,
        url: baseURL,
        sameSite: "Lax",
      },
    ]);
  } else {
    trackIssue("auth-failure", {
      viewport: viewport.name,
      label: "auth",
      url: baseURL,
      message: "JWT_SECRET is unavailable for visual QA authentication.",
    });
  }

  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    trackIssue("console-error", {
      viewport: viewport.name,
      label: "console",
      url: page.url(),
      message: message.text(),
    });
  });

  page.on("pageerror", (error) => {
    trackIssue("page-error", {
      viewport: viewport.name,
      label: "page",
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
      viewport: viewport.name,
      label: "network",
      url,
      message: `HTTP ${response.status()}`,
    });
  });

  for (const route of routes) {
    await captureRoute(page, viewport, route);
  }

  await captureSeededRenewalRequestModal(page, viewport);
  await captureSeededRenewalConfirmModal(page, viewport);

  await context.close();
}

const qaAdminUser = await resolveQaAdminUser();
const accessToken = createAccessToken(qaAdminUser);
const browser = await chromium.launch({ headless: true });

try {
  const apiContext = await browser.newContext();
  if (accessToken) {
    await apiContext.addCookies([
      {
        name: "access_token",
        value: accessToken,
        url: baseURL,
        sameSite: "Lax",
      },
    ]);
  }
  await runApiChecks(apiContext);
  await apiContext.close();

  for (const viewport of viewports) {
    await runViewport(browser, viewport, accessToken);
  }
} finally {
  await browser.close();
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
