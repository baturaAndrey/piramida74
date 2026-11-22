import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./e2e/helpers/auth-state";

/**
 * E2E на production-сборке (то, что реально поедет в Docker: cacheComponents, updateTag,
 * standalone). Окружение — `.env.e2e` (git-ignored, отдельная БД `piramida_e2e`);
 * БД пересоздаётся `pnpm e2e:db`. Значения из `.env.e2e` попадают и в webServer, и в
 * процесс тестов (CRON_SECRET, учётка админа, POSTGRES_URL для SQL-хелперов).
 */
const E2E_ENV_FILE = ".env.e2e";
const e2eEnv: Record<string, string> = existsSync(E2E_ENV_FILE)
  ? (parseEnv(readFileSync(E2E_ENV_FILE, "utf8")) as Record<string, string>)
  : {};
// .env.e2e важнее окружения оболочки (как в scripts/e2e-db.mjs): случайный POSTGRES_URL из shell
// не должен направить SQL-хелперы тестов на рабочую БД
Object.assign(process.env, e2eEnv);

const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // один процесс Next и общая БД; тесты изолируют данные уникальными именами
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", locale: "ru-RU", timezoneId: "Asia/Yekaterinburg" },
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          // standalone-сервер (как в Dockerfile): `next start` с output: standalone не поддерживается
          command: `pnpm build:ci && node scripts/e2e-start.mjs ${PORT}`,
          url: `${baseURL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 600_000,
          stdout: "pipe" as const,
          env: { ...e2eEnv, PORT: String(PORT) },
        },
      }),
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STORAGE_STATE },
      dependencies: ["setup"],
      testIgnore: [/visual-compare/, /auth\.setup\.ts/, /zz-login-rate-limit/],
    },
    {
      // Исчерпывает лимит входа для своего IP — строго после всех остальных тестов
      name: "teardown-rate-limit",
      testMatch: /zz-login-rate-limit\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["chromium"],
    },
    {
      name: "visual",
      testMatch: /visual-compare\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
