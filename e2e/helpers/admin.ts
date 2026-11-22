import { expect, type Locator, type Page } from "@playwright/test";

/** Ожидание toast (sonner) с текстом. */
export async function expectToast(page: Page, text: string | RegExp): Promise<Locator> {
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: text }).first();
  await expect(toast).toBeVisible();
  return toast;
}

/** Строка таблицы админки, содержащая текст. */
export function rowByText(page: Page, text: string | RegExp): Locator {
  return page.getByRole("row").filter({ hasText: text }).first();
}

/** Контекст без cookie (для неавторизованных проверок): `test.use(ANON)`. */
export const ANON: { storageState: { cookies: []; origins: [] } } = {
  storageState: { cookies: [], origins: [] },
};
