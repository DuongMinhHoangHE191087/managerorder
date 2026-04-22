import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://localhost:3001";
const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env.local");
const outputDir = path.join(rootDir, "qa-artifacts", "provider-flows-qa");

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
      sub: "codex-provider-qa",
      accountId: testAccountId,
      role: "admin_owner",
      email: "codex-provider-qa@local",
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

async function getFirstProviderId(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/providers");
    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return Array.isArray(payload?.data) && payload.data[0]?.id
      ? payload.data[0].id
      : null;
  });
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
      message: "JWT_SECRET is unavailable for provider flow QA authentication.",
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
    await page.goto(`${baseURL}/providers`);
    await settle(page);
    await saveShot(page, viewport.name, "providers-list");

    const providerId = await getFirstProviderId(page);
    if (!providerId) {
      trackIssue("qa-failure", {
        viewport: viewport.name,
        label: "provider-data",
        url: page.url(),
        message: "No provider data available for provider flow QA.",
      });
      return;
    }

    await page.goto(`${baseURL}/providers/${providerId}`);
    await settle(page);
    await saveShot(page, viewport.name, "provider-detail");

    const createPurchaseOrderButton = page.getByRole("button", {
      name: /Tạo đơn nhập mới/i,
    });

    if (!(await createPurchaseOrderButton.count())) {
      trackIssue("qa-failure", {
        viewport: viewport.name,
        label: "purchase-order-trigger",
        url: page.url(),
        message: "Purchase-order trigger button was not found.",
      });
      return;
    }

    await createPurchaseOrderButton.first().click();
    await settle(page);
    await saveShot(page, viewport.name, "purchase-order-modal");

    const connectInventoryButton = page.getByRole("button", {
      name: /Kết nối kho hàng/i,
    });

    if (await connectInventoryButton.count()) {
      await connectInventoryButton.first().click();
      await settle(page);
      await saveShot(page, viewport.name, "purchase-order-inventory");

      const warehouseSelector = page.locator("button:visible").filter({
        hasText: /Tìm kho theo email|Không tìm thấy kho tương thích/i,
      });

      if (await warehouseSelector.count()) {
        await warehouseSelector.first().click();
        await settle(page);

        const warehouseInput = page.getByPlaceholder(/Tìm kho theo email/i);
        if (await warehouseInput.count()) {
          await warehouseInput.first().fill("a");
          await page.waitForTimeout(500);
        }

        await saveShot(page, viewport.name, "purchase-order-warehouse-selector");

        const createWarehouseButton = page.getByRole("button", {
          name: /Tạo tài khoản kho mới/i,
        });

        if (await createWarehouseButton.count()) {
          await createWarehouseButton.first().click();
          await settle(page);
          await saveShot(page, viewport.name, "purchase-order-create-source-modal");
        }
      }
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

console.log(
  JSON.stringify(
    {
      outputDir,
      reportPath: path.join(outputDir, "report.json"),
    },
    null,
    2,
  ),
);
