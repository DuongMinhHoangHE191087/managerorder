import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://localhost:3001";
const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env.local");
const outputDir = path.join(rootDir, "qa-artifacts", "visual-qa");

const viewports = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 1024 },
];

const report = {
  baseURL,
  generatedAt: new Date().toISOString(),
  screenshots: [],
  issues: [],
};

await fs.mkdir(outputDir, { recursive: true });

const envSource = await fs.readFile(envPath, "utf8").catch(() => "");

function readEnvValue(name) {
  const match = envSource.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) {
    return undefined;
  }

  return match[1].trim().replace(/^"|"$/g, "");
}

const jwtSecret = process.env.JWT_SECRET ?? readEnvValue("JWT_SECRET");
const testAccountId =
  process.env.NEXT_PUBLIC_TEST_ACCOUNT_ID ??
  readEnvValue("NEXT_PUBLIC_TEST_ACCOUNT_ID") ??
  "550e8400-e29b-41d4-a716-446655440000";

function createAccessToken() {
  if (!jwtSecret) {
    return null;
  }

  return jwt.sign(
    {
      sub: "codex-visual-qa",
      accountId: testAccountId,
      role: "admin_owner",
      email: "codex-visual-qa@local",
    },
    jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: "24h",
    },
  );
}

function trackIssue(kind, payload) {
  const key = JSON.stringify([kind, payload.viewport, payload.label, payload.url, payload.message]);
  if (report.issues.some((issue) => issue.key === key)) {
    return;
  }

  report.issues.push({
    key,
    kind,
    ...payload,
  });
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function saveShot(page, viewportName, label) {
  const fileName = `${viewportName}-${label}.png`;
  const filePath = path.join(outputDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  report.screenshots.push(filePath);
}

async function openCommandPalette(page) {
  const trigger = page.locator('[aria-label="Mở tìm nhanh"]:visible');
  if (await trigger.count()) {
    await trigger.first().click();
    return true;
  }
  return false;
}

async function openNotifications(page) {
  const trigger = page.locator('[aria-label="Thông báo"]:visible');
  if (await trigger.count()) {
    await trigger.first().click();
    return true;
  }
  return false;
}

async function openFirstProviderDetails(page) {
  const cards = page.locator("div.cursor-pointer");
  if (!(await cards.count())) {
    return false;
  }

  await cards.first().click();
  await settle(page);
  return true;
}

async function openFirstCustomerDetails(page) {
  const cards = page.locator("div.cursor-pointer");
  if (!(await cards.count())) {
    return false;
  }

  await cards.first().click();
  await settle(page);
  return true;
}

async function openFirstInventorySourceAccountDetails(page) {
  const cards = page.locator("article");
  if (!(await cards.count())) {
    return false;
  }

  await cards.first().click();
  await settle(page);
  return true;
}

async function runViewport(viewport) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const accessToken = createAccessToken();

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
    trackIssue("qa-failure", {
      viewport: viewport.name,
      label: "auth",
      url: baseURL,
      message: "JWT_SECRET is unavailable for visual QA authentication.",
    });
  }

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
    if (!response.url().startsWith(baseURL) || response.status() < 400) {
      return;
    }

    trackIssue("http-error", {
      viewport: viewport.name,
      label: "network",
      url: response.url(),
      message: `HTTP ${response.status()}`,
    });
  });

  try {
    await page.goto(`${baseURL}/dashboard`);
    await settle(page);
    await saveShot(page, viewport.name, "dashboard");

    await page.goto(`${baseURL}/short-links`);
    await settle(page);
    await saveShot(page, viewport.name, "short-links");

    const shortLinkDetail = page.getByRole("link", { name: /Chi tiết/i });
    if (await shortLinkDetail.count()) {
      await shortLinkDetail.first().click();
      await settle(page);
      await saveShot(page, viewport.name, "short-links-detail");
    }

    await page.goto(`${baseURL}/settings/bot`);
    await settle(page);
    await saveShot(page, viewport.name, "settings-bot");

    await page.goto(`${baseURL}/premium/accounts`);
    await settle(page);
    await saveShot(page, viewport.name, "premium-accounts");

    if (await openNotifications(page)) {
      await settle(page);
      await saveShot(page, viewport.name, "notifications");
      await page.keyboard.press("Escape");
    }

    if (await openCommandPalette(page)) {
      await settle(page);
      const paletteInput = page.getByPlaceholder(/Tìm nhanh/i);
      if (await paletteInput.count()) {
        await paletteInput.first().fill("kho");
        await page.waitForTimeout(500);
      }
      await saveShot(page, viewport.name, "command-palette");
      await page.keyboard.press("Escape");
    }

    const createPremiumButton = page.getByRole("button", {
      name: /Thêm Tài Khoản Gốc/i,
    });
    if (await createPremiumButton.count()) {
      await createPremiumButton.first().click();
      await settle(page);
      await saveShot(page, viewport.name, "premium-create-modal");
      await page.keyboard.press("Escape");
    }

    await page.goto(`${baseURL}/inventory`);
    await settle(page);
    const createInventoryButton = page.getByRole("button", { name: /Thêm tài khoản/i });
    if (await createInventoryButton.count()) {
      await createInventoryButton.first().click();
      await settle(page);
      await saveShot(page, viewport.name, "inventory-create-modal");
      await page.keyboard.press("Escape");
    }

    await page.goto(`${baseURL}/orders/new`);
    await settle(page);
    const warehouseButtons = page.getByRole("button", { name: /Kết nối kho hàng/i });
    if (await warehouseButtons.count()) {
      await warehouseButtons.first().click();
      await settle(page);
      const warehouseInput = page.getByPlaceholder(/Tìm kho theo email/i);
      if (await warehouseInput.count()) {
        await warehouseInput.first().fill("a");
        await page.waitForTimeout(500);
      }
      await saveShot(page, viewport.name, "orders-warehouse-selector");
      await page.keyboard.press("Escape");
    }

    await page.goto(`${baseURL}/premium/migrations?status=pending`);
    await settle(page);
    await saveShot(page, viewport.name, "premium-migrations");

    await page.goto(`${baseURL}/providers`);
    await settle(page);
    if (await openFirstProviderDetails(page)) {
      await saveShot(page, viewport.name, "provider-detail");
      const createPurchaseOrderButton = page.getByRole("button", {
        name: /Tạo đơn nhập mới/i,
      });
      if (await createPurchaseOrderButton.count()) {
        await createPurchaseOrderButton.first().click();
        await settle(page);
        const warehouseButtons = page.getByRole("button", {
          name: /Kết nối kho hàng/i,
        });
        if (await warehouseButtons.count()) {
          await warehouseButtons.first().click();
          await page.waitForTimeout(500);
        }
        await saveShot(page, viewport.name, "purchase-order-modal");
      }
    }

    await page.goto(`${baseURL}/customers`);
    await settle(page);
    await saveShot(page, viewport.name, "customers");
    if (await openFirstCustomerDetails(page)) {
      await saveShot(page, viewport.name, "customer-detail");
    }

    await page.goto(`${baseURL}/inventory`);
    await settle(page);
    if (await openFirstInventorySourceAccountDetails(page)) {
      await saveShot(page, viewport.name, "inventory-source-account-detail");
    }
  } catch (error) {
    trackIssue("qa-failure", {
      viewport: viewport.name,
      label: "script",
      url: page.url(),
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

for (const viewport of viewports) {
  await runViewport(viewport);
}

await fs.writeFile(
  path.join(outputDir, "report.json"),
  JSON.stringify(
    {
      ...report,
      issues: report.issues.map(({ key: _key, ...issue }) => issue),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(JSON.stringify({ outputDir, reportPath: path.join(outputDir, "report.json") }, null, 2));
