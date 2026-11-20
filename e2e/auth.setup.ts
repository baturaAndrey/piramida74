import { expect, test as setup } from "@playwright/test";
const ADMIN_STORAGE_STATE = "e2e/.auth/admin.json";

// Better Auth ограничивает /sign-in/email (5 попыток в минуту) — входим ОДИН раз за прогон,
// остальные тесты используют сохранённый storageState.
setup("вход администратора", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD не заданы (.env.e2e)");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: /войти/i }).click();
  await expect(page).toHaveURL(/\/admin/);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
