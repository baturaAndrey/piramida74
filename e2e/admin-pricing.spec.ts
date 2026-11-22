import { expect, test, type Page } from "@playwright/test";
import { expectToast, rowByText } from "./helpers/admin";
import { expectTotal, openCalculator } from "./helpers/calculator";
import { trackConsoleErrors } from "./helpers/console";
import { nextWeekday } from "./helpers/dates";
import { sql } from "./helpers/db";

/**
 * Правка цены в админке → сайт и калькулятор (проверка updateTag без перезапуска сервера).
 * Сид: общий зал, Вс–Чт 09:00–16:00 — 580 ₽/час. Другие спеки параллельно проверяют 580 на главной,
 * поэтому окно с 590 держим коротким и всегда возвращаем цену в finally.
 */
const SEED_PRICE = 580;
const NEW_PRICE = 590;
const TARIFF_LABEL = "Вс–Чт, день (09:00–16:00)";

type TariffRow = { id: string; price: number };

async function seedTariff(): Promise<TariffRow> {
  const [row] = await sql()<TariffRow[]>`
    select t.id, t.price from rental_tariffs t join halls h on h.id = t.hall_id
    where h.slug = 'obshchiy-zal' and t.label = ${TARIFF_LABEL}`;
  if (!row) throw new Error(`Тариф «${TARIFF_LABEL}» не найден в сиде`);
  return row;
}

/** Строка тарифа в таблице «Общий зал» (по подписи тарифа из сида). */
function tariffRow(page: Page) {
  return rowByText(page, TARIFF_LABEL);
}

/** Меню «Действия с тарифом» → «Изменить» → новая цена → «Сохранить». */
async function setTariffPrice(page: Page, price: number) {
  await page.goto("/admin/pricing?tab=tariffs");
  const row = tariffRow(page);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Действия с тарифом" }).click();
  await page.getByRole("menuitem", { name: "Изменить" }).click();
  const dialog = page.getByRole("dialog", { name: "Изменить тариф" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Цена, ₽").fill(String(price));
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expectToast(page, "Тариф сохранён");
  await expect(dialog).toBeHidden();
  await expect(tariffRow(page)).toContainText(new RegExp(`${price}\\s₽/час`));
}

test.describe("Админка: цены", () => {
  let consoleErrors: () => string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = trackConsoleErrors(page);
  });

  test.afterEach(() => {
    expect(consoleErrors()).toEqual([]);
  });

  test("580 → 590: цена сразу на /prices, на главной и в калькуляторе; затем возврат", async ({
    page,
  }) => {
    const before = await seedTariff();
    expect(before.price).toBe(SEED_PRICE);

    try {
      await setTariffPrice(page, NEW_PRICE);
      expect((await seedTariff()).price).toBe(NEW_PRICE);

      await page.goto("/prices");
      await expect(page.getByRole("cell", { name: `${NEW_PRICE} ₽/час` }).first()).toBeVisible();
      await expect(page.getByRole("cell", { name: `${SEED_PRICE} ₽/час` })).toHaveCount(0);

      await page.goto("/");
      // Первая группа аккордеона («Аренда») раскрыта по умолчанию
      await expect(page.locator("#price").getByText(`${NEW_PRICE} руб/час`).first()).toBeVisible();

      await openCalculator(page, { d: nextWeekday(1), t: "12:00", h: 2 });
      await expectTotal(page, 2 * NEW_PRICE);
    } finally {
      // Возврат через UI (сбрасывает кэш); SQL — только страховка, если UI недоступен
      try {
        if ((await seedTariff()).price !== SEED_PRICE) await setTariffPrice(page, SEED_PRICE);
      } catch (error) {
        await sql()`update rental_tariffs set price = ${SEED_PRICE} where id = ${before.id}`;
        throw error;
      }
    }

    expect((await seedTariff()).price).toBe(SEED_PRICE);
    await page.goto("/prices");
    await expect(page.getByRole("cell", { name: `${SEED_PRICE} ₽/час` }).first()).toBeVisible();
  });

  test("пересекающийся тариф для того же зала и дней отклоняется с ошибкой", async ({ page }) => {
    await page.goto("/admin/pricing?tab=tariffs");
    await page.getByRole("button", { name: "Добавить тариф" }).click();
    const dialog = page.getByRole("dialog", { name: "Новый тариф" });
    await expect(dialog).toBeVisible();

    // По умолчанию: Вс–Чт 09:00–16:00 — ровно поверх тарифа сида для общего зала
    await dialog.getByRole("combobox", { name: "Зал" }).click();
    await page.getByRole("option", { name: "Общий зал", exact: true }).click();
    const label = `E2E пересечение ${Date.now()}`;
    await dialog.getByLabel("Подпись").fill(label);
    await dialog.getByLabel("Цена, ₽").fill("100");
    await expect(dialog.getByText(/Это интервал Вс–Чт, 09:00–16:00/)).toBeVisible();
    await dialog.getByRole("button", { name: "Сохранить" }).click();

    await expectToast(page, /Пересечение с тарифом/);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Отмена" }).click();
    await expect(dialog).toBeHidden();

    expect(await sql()`select id from rental_tariffs where label = ${label}`).toHaveLength(0);
  });
});
