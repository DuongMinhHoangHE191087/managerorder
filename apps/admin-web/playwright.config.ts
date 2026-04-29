import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.local for Supabase credentials
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";
const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";

/**
 * Playwright Configuration — ManagerOrder E2E Tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  expect: {
    timeout: 60_000,
  },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Auth setup — runs before all test projects
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // Desktop Chrome
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },

    // Desktop Firefox
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },

    // Mobile Chrome
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: skipWebServer
    ? undefined
    : {
        command: "pnpm exec next dev --webpack -H 127.0.0.1 -p 3000",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          E2E_MOCK_SESSION: "1",
        },
        timeout: 300_000,
      },
});
