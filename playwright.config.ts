import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", locale: "ru-RU", timezoneId: "Asia/Yekaterinburg" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Если E2E_BASE_URL не задан — поднимаем dev-сервер сами (нужны .env и запущенная БД)
  // (условный spread, т.к. exactOptionalPropertyTypes запрещает webServer: undefined)
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          // readiness probe: "/" may 404 (Playwright waits for 2xx/3xx), health also confirms the DB
          url: `${baseURL}/api/health`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
