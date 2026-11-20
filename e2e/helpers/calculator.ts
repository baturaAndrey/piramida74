import { expect, type Locator, type Page } from "@playwright/test";

/** Смета калькулятора (секция «Ваш расчёт»). */
export function summary(page: Page): Locator {
  return page.getByRole("region", { name: "Ваш расчёт" });
}

/** Значение «Итого» сметы в рублях (форматирование ru-RU с неразрывными пробелами отбрасывается). */
export async function readTotal(page: Page): Promise<number> {
  const text = await summary(page).locator('dt:text-is("Итого") + dd').textContent();
  return Number((text ?? "").replace(/\D/g, ""));
}

/** Ждёт, пока «Итого» станет равным `expected`. */
export async function expectTotal(page: Page, expected: number) {
  await expect.poll(() => readTotal(page)).toBe(expected);
}

/** Открывает /calculator с параметрами и ждёт клиентский калькулятор. */
export async function openCalculator(page: Page, params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const query = qs.toString();
  await page.goto(`/calculator${query ? `?${query}` : ""}`);
  await expect(summary(page)).toBeVisible();
}

/** Кнопка «+»/«−» степпера, подписанного `<Label htmlFor>` (Гости, Столов, Длительность). */
export function stepperButton(page: Page, label: string, which: "Увеличить" | "Уменьшить") {
  return page
    .getByLabel(label, { exact: true })
    .locator("xpath=..")
    .getByRole("button", { name: which });
}
