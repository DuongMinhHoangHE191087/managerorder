import fs from "fs";
import path from "path";
import { chromium } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";
const root = process.cwd();
const outputDir = path.resolve(root, "browser-check");
const authStatePath = path.resolve(outputDir, "ui-auth-state.json");

fs.mkdirSync(outputDir, { recursive: true });

function uniqueName(prefix) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 8)}`;
}

async function createProduct(page, name, sellPrice) {
  const response = await page.request.post(`${baseURL}/api/products`, {
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify({
      name,
      mode: "slot",
      buyPriceVnd: 1000,
      sellPriceVnd: sellPrice,
      durationType: "days",
      durationValue: 1,
      isActive: true,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok()) {
    throw new Error(`Create product failed (${response.status()}): ${JSON.stringify(body)}`);
  }

  console.log("CREATED", JSON.stringify({ name, id: body?.data?.id ?? null }));
  return body.data;
}

async function deleteProductFromList(page, name) {
  const row = page.locator('[data-testid="product-row"]').filter({ hasText: name }).first();
  await row.waitFor({ state: "visible", timeout: 15_000 });
  await row.getByRole("button", { name: "Thao tác" }).click();
  await page.getByRole("button", { name: /^Xóa/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Xóa/ }).click();
  await page.waitForTimeout(1200);
}

async function openTrashDetailFor(page, name) {
  const row = page.locator("tbody tr").filter({ hasText: name }).first();
  await row.waitFor({ state: "visible", timeout: 15_000 });
  await row.getByRole("button", { name: "Thao tác" }).click();
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  await page.waitForTimeout(800);
}

async function verifyDetailDialog(page, name) {
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 15_000 });
  const dialogText = await dialog.innerText();
  console.log("DETAIL_HAS_NAME", JSON.stringify({ name, present: dialogText.includes(name) }));
  console.log("DETAIL_BUTTONS", JSON.stringify({
    restore: await dialog.getByRole("button", { name: "Khôi phục" }).count(),
    purge: await dialog.getByRole("button", { name: "Xóa vĩnh viễn" }).count(),
  }));
}

function trashPreviewPanel(page) {
  return page.locator("section").filter({ hasText: "Chi tiết khôi phục" }).last();
}

async function verifyPreviewSelection(page, expectedName, label) {
  const panel = trashPreviewPanel(page);
  const text = await panel.innerText();
  console.log(label, JSON.stringify({ expectedName, present: text.includes(expectedName) }));
}

async function restoreFromDetail(page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Khôi phục" }).click();
  await page.waitForTimeout(1500);
}

async function cleanupProducts(page, products) {
  const [productsRes, trashRes] = await Promise.all([
    page.request.get(`${baseURL}/api/products`),
    page.request.get(`${baseURL}/api/trash?type=products`),
  ]);

  const productsJson = await productsRes.json().catch(() => ({ data: [] }));
  const trashJson = await trashRes.json().catch(() => ({ data: [] }));
  const currentProducts = Array.isArray(productsJson.data) ? productsJson.data : [];
  const currentTrash = Array.isArray(trashJson.data) ? trashJson.data : [];

  for (const product of products) {
    const stillTrash = currentTrash.find((item) => item.id === product.id);
    const stillProduct = currentProducts.find((item) => item.id === product.id);

    if (!stillProduct && stillTrash) {
      const restoreRes = await page.request.post(`${baseURL}/api/trash/restore`, {
        data: { type: "products", ids: [product.id] },
      });
      console.log("CLEANUP_RESTORE", JSON.stringify({
        name: product.name,
        status: restoreRes.status(),
      }));
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: authStatePath,
    viewport: { width: 1600, height: 1400 },
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && url.startsWith(baseURL)) {
      const parsed = new URL(url);
      failedResponses.push(`${response.status()} ${parsed.pathname}${parsed.search}`);
    }
  });

  const productA = await createProduct(page, uniqueName("Verify Product A"), 2000);
  const productB = await createProduct(page, uniqueName("Verify Product B"), 3000);

  await page.goto(`${baseURL}/products`, { waitUntil: "commit", timeout: 90_000 });
  await page.waitForSelector('[data-testid="product-row"]', { timeout: 20_000 });
  await page.getByText(productA.name, { exact: false }).waitFor({ state: "visible", timeout: 20_000 });
  await page.getByText(productB.name, { exact: false }).waitFor({ state: "visible", timeout: 20_000 });

  await page.screenshot({ path: path.join(outputDir, "products-created.png"), fullPage: true });
  console.log("PRODUCT_ROW_COUNT", await page.locator('[data-testid="product-row"]').count());

  await deleteProductFromList(page, productA.name);
  await deleteProductFromList(page, productB.name);

  await page.goto(`${baseURL}/trash?type=products`, { waitUntil: "commit", timeout: 90_000 });
  const trashRowA = page.locator("tbody tr").filter({ hasText: productA.name }).first();
  const trashRowB = page.locator("tbody tr").filter({ hasText: productB.name }).first();
  await Promise.all([
    trashRowA.waitFor({ state: "visible", timeout: 30_000 }),
    trashRowB.waitFor({ state: "visible", timeout: 30_000 }),
  ]);
  const trashRows = page.locator("tbody tr");
  const trashCount = await trashRows.count();
  console.log("TRASH_COUNT", trashCount);
  await verifyPreviewSelection(page, productB.name, "PREVIEW_INITIAL");

  await trashRowA.click();
  await page.waitForTimeout(400);
  await verifyPreviewSelection(page, productA.name, "PREVIEW_AFTER_ROW_A");

  await trashRowB.click();
  await page.waitForTimeout(400);
  await verifyPreviewSelection(page, productB.name, "PREVIEW_AFTER_ROW_B");

  await openTrashDetailFor(page, productB.name);
  await verifyDetailDialog(page, productB.name);
  await page.screenshot({ path: path.join(outputDir, "trash-detail-b.png"), fullPage: true });
  await restoreFromDetail(page);

  await page.goto(`${baseURL}/trash?type=products`, { waitUntil: "commit", timeout: 90_000 });
  const trashRowAAfterRestore = page.locator("tbody tr").filter({ hasText: productA.name }).first();
  await trashRowAAfterRestore.waitFor({ state: "visible", timeout: 30_000 });
  await openTrashDetailFor(page, productA.name);
  await verifyDetailDialog(page, productA.name);
  await page.screenshot({ path: path.join(outputDir, "trash-detail-a.png"), fullPage: true });
  await restoreFromDetail(page);

  await cleanupProducts(page, [productA, productB]);

  const [finalProductsRes, finalTrashRes] = await Promise.all([
    page.request.get(`${baseURL}/api/products`),
    page.request.get(`${baseURL}/api/trash?type=products`),
  ]);
  const finalProductsJson = await finalProductsRes.json().catch(() => ({ data: [] }));
  const finalTrashJson = await finalTrashRes.json().catch(() => ({ data: [] }));
  const finalProducts = Array.isArray(finalProductsJson.data) ? finalProductsJson.data : [];
  const finalTrash = Array.isArray(finalTrashJson.data) ? finalTrashJson.data : [];

  console.log("FINAL_PRODUCT_MATCHES", JSON.stringify(finalProducts.filter((item) => [productA.name, productB.name].includes(item.name)).map((item) => ({ id: item.id, name: item.name }))));
  console.log("FINAL_TRASH_MATCHES", JSON.stringify(finalTrash.filter((item) => [productA.name, productB.name].includes(item.name)).map((item) => ({ id: item.id, name: item.name }))));

  await page.goto(`${baseURL}/products`, { waitUntil: "commit", timeout: 90_000 });
  await page.waitForSelector('[data-testid="product-row"]', { timeout: 20_000 });
  await page.screenshot({ path: path.join(outputDir, "products-restored.png"), fullPage: true });

  console.log("FINAL_FAILED_RESPONSES", JSON.stringify(failedResponses));
  console.log("FINAL_CONSOLE_ERRORS", JSON.stringify(consoleErrors));
  console.log("FINAL_PAGE_ERRORS", JSON.stringify(pageErrors));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
