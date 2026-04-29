import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { chromium } from "@playwright/test";

const root = path.resolve(process.cwd());
const baseURL = "http://127.0.0.1:3000";
const outputDir = path.resolve(root, "browser-check");
const authStatePath = path.resolve(root, "e2e/.auth/user.json");
const envPath = path.resolve(root, ".env.local");

fs.mkdirSync(outputDir, { recursive: true });

function readJwtSecret() {
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/^JWT_SECRET="?(.+?)"?$/m);
  if (!match) {
    throw new Error("JWT_SECRET missing from .env.local");
  }
  return match[1];
}

function readMockAccountId() {
  const state = JSON.parse(fs.readFileSync(authStatePath, "utf8"));
  const accessToken = state.cookies.find((cookie) => cookie.name === "access_token")?.value;
  if (!accessToken) {
    return "550e8400-e29b-41d4-a716-446655440000";
  }
  const decoded = jwt.decode(accessToken);
  return typeof decoded === "object" && decoded && typeof decoded.accountId === "string"
    ? decoded.accountId
    : "550e8400-e29b-41d4-a716-446655440000";
}

function makeTokens() {
  const secret = readJwtSecret();
  const accountId = readMockAccountId();
  const payload = {
    sub: "00000000-0000-4000-8000-000000000002",
    accountId,
    role: "admin_owner",
    email: "e2e-mock@managerorder.local",
  };

  return {
    accessToken: jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "24h" }),
    refreshToken: jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "7d" }),
  };
}

async function bootstrapAuth(context) {
  const { accessToken, refreshToken } = makeTokens();
  await context.addCookies([
    {
      name: "access_token",
      value: accessToken,
      domain: "127.0.0.1",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "refresh_token",
      value: refreshToken,
      domain: "127.0.0.1",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
  await bootstrapAuth(context);
  let page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const createdProducts = [];

  function attachListeners(targetPage) {
    targetPage.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    targetPage.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    targetPage.on("response", (response) => {
      const url = response.url();
      if (!url.startsWith(baseURL) || response.status() < 400) {
        return;
      }
      const parsed = new URL(url);
      failedResponses.push(`${response.status()} ${parsed.pathname}${parsed.search}`);
    });
  }

  attachListeners(page);

  await page.goto(`${baseURL}/products`, { waitUntil: "domcontentloaded" });
  const authResult = await page.evaluate(async (origin) => {
    const response = await fetch(origin + "/api/auth/session/mock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: "{}",
    });
    return {
      status: response.status,
      ok: response.ok,
      body: await response.json().catch(() => ({})),
    };
  }, baseURL);
  console.log("AUTH_RESULT", JSON.stringify(authResult));
  await page.waitForTimeout(1000);

  async function screenshot(name) {
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
  }

  async function waitForAppReady() {
    await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
    try {
      await page.waitForFunction(() => {
        const row = document.querySelector("tbody tr");
        return Boolean(row) && !row.className.includes("animate-pulse");
      }, null, { timeout: 20_000 });
      return true;
    } catch {
      return false;
    }
  }

  async function dumpRows() {
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    const texts = [];
    for (let i = 0; i < Math.min(count, 3); i += 1) {
      texts.push((await rows.nth(i).innerText()).replace(/\s+/g, " ").trim());
    }
    return { count, texts };
  }

  async function createProduct(name) {
    const body = await page.evaluate(async ({ payload, origin }) => {
      const response = await fetch(origin + "/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      return {
        status: response.status,
        ok: response.ok,
        body: await response.json().catch(() => ({})),
      };
    }, {
      payload: {
        name,
        mode: "slot",
        buyPriceVnd: 1000,
        sellPriceVnd: 2000,
        durationType: "days",
        durationValue: 1,
        isActive: true,
      },
      origin: baseURL,
    });
    if (!body.ok) {
      throw new Error(`createProduct failed (${body.status}): ${JSON.stringify(body.body)}`);
    }
    createdProducts.push(body.body?.data?.id ?? name);
    return body.body?.data ?? null;
  }

  await page.goto(`${baseURL}/products`, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2500);

  const uniqueSuffix = String(Date.now());
  const productNameA = `Browser Verify Product A ${uniqueSuffix}`;
  const productNameB = `Browser Verify Product B ${uniqueSuffix}`;

  await createProduct(productNameA);
  await createProduct(productNameB);

  await page.goto(`${baseURL}/products`, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2500);
  await screenshot("products");
  console.log("PRODUCTS_URL", page.url());
  console.log("PRODUCTS_BODY", (await page.locator("body").innerText()).slice(0, 2000));
  console.log("CREATED_PRODUCTS", JSON.stringify(createdProducts));
  const directProducts = await page.evaluate(async (origin) => {
    const response = await fetch(origin + "/api/products", {
      credentials: "include",
    });
    return {
      status: response.status,
      ok: response.ok,
      body: await response.json().catch(() => ({})),
    };
  }, baseURL);
  console.log("DIRECT_PRODUCTS", JSON.stringify(directProducts));
  await page.close();
  page = await context.newPage();
  attachListeners(page);
  await page.goto(`${baseURL}/products`, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2500);
  await screenshot("products-fresh");
  console.log("PRODUCTS_FRESH_URL", page.url());
  console.log("PRODUCTS_FRESH_BODY", (await page.locator("body").innerText()).slice(0, 2000));
  await page.waitForFunction((names) => {
    const text = document.body.innerText;
    return names.every((name) => text.includes(name));
  }, [productNameA, productNameB], { timeout: 30_000 }).catch(() => null);
  const productRowCount = await page.locator('[data-testid="product-row"]').count();
  console.log("PRODUCT_ROW_COUNT", String(productRowCount));
  const productRowsText = await page.locator('[data-testid="product-row"]').evaluateAll((nodes) =>
    nodes.slice(0, 4).map((node) => (node.textContent || "").replace(/\s+/g, " ").trim()),
  );
  console.log("PRODUCT_ROWS", JSON.stringify(productRowsText));
  const firstProductRowHtml = await page.locator('[data-testid="product-row"]').first().evaluate((node) => node.outerHTML);
  console.log("FIRST_PRODUCT_ROW_HTML", firstProductRowHtml.slice(0, 3000));
  const firstProductButtons = await page.locator('[data-testid="product-row"]').first().locator("button").evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: (node.textContent || "").trim(),
      aria: node.getAttribute("aria-label"),
      title: node.getAttribute("title"),
    })),
  );
  console.log("FIRST_PRODUCT_BUTTONS", JSON.stringify(firstProductButtons));
  await screenshot("products-created");

  const createdRows = page.locator('[data-testid="product-row"]');
  for (const productName of [productNameA, productNameB]) {
    const row = createdRows.filter({ hasText: productName }).first();
    await row.waitFor({ state: "visible", timeout: 30_000 });
    await row.getByRole("button", { name: "Thao tác" }).click();
    await page.getByRole("button", { name: "Xóa sản phẩm" }).click();
    await page.getByRole("button", { name: "Xóa vĩnh viễn" }).click();
    await page.waitForTimeout(1500);
  }

  await page.goto(`${baseURL}/trash?type=products`, { waitUntil: "domcontentloaded" });
  const productsReady = await waitForAppReady();
  await screenshot("trash-products");
  console.log("TRASH_PRODUCTS_URL", page.url());
  console.log("TRASH_PRODUCTS_READY", String(productsReady));
  console.log("TRASH_PRODUCTS_BODY", (await page.locator("body").innerText()).slice(0, 2000));
  const productRows = await dumpRows();
  console.log("TRASH_PRODUCTS_ROWS", JSON.stringify(productRows));
  if (!productsReady) {
    console.log("FAILED_RESPONSES", JSON.stringify(failedResponses));
    console.log("CONSOLE_ERRORS", JSON.stringify(consoleErrors));
    console.log("PAGE_ERRORS", JSON.stringify(pageErrors));
    await browser.close();
    return;
  }

  if (productRows.count > 1) {
    await page.locator("tbody tr").nth(1).click();
    await page.waitForTimeout(1000);
    await screenshot("trash-products-row2-selected");
  }

  const firstActionButton = page.locator("tbody tr").first().getByRole("button", { name: "Thao tác" });
  await firstActionButton.click();
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  await page.waitForTimeout(1500);
  await screenshot("trash-product-detail-route");
  console.log("PRODUCT_DETAIL_URL", page.url());
  console.log("PRODUCT_DETAIL_ACTIONS", JSON.stringify({
    restore: await page.getByRole("button", { name: "Khôi phục" }).count(),
    purge: await page.getByRole("button", { name: "Xóa vĩnh viễn" }).count(),
  }));

  await page.getByRole("button", { name: "Khôi phục" }).click();
  await page.waitForTimeout(2000);
  await page.goto(`${baseURL}/trash?type=products`, { waitUntil: "domcontentloaded" });
  await waitForAppReady();
  await screenshot("trash-products-after-restore-one");

  const remainingRows = await dumpRows();
  if (remainingRows.count > 0) {
    const remainingActionButton = page.locator("tbody tr").first().getByRole("button", { name: "Thao tác" });
    await remainingActionButton.click();
    await page.getByRole("button", { name: "Khôi phục" }).click();
    await page.waitForTimeout(2000);
  }

  await page.goto(`${baseURL}/products`, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2500);
  await screenshot("products-after-restore");

  console.log("FAILED_RESPONSES", JSON.stringify(failedResponses));
  console.log("CONSOLE_ERRORS", JSON.stringify(consoleErrors));
  console.log("PAGE_ERRORS", JSON.stringify(pageErrors));

  await browser.close();
  return;
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
