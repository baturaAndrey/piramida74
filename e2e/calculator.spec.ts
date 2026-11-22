import { expect, test, type Page, type Route } from "@playwright/test";
import { expectTotal, openCalculator, stepperButton, summary } from "./helpers/calculator";
import { trackConsoleErrors, uniq, uniqueIp } from "./helpers/console";
import { nextWeekday } from "./helpers/dates";
import {
  expectThankYou,
  fillLeadForm,
  leadsByPhone,
  randomPhone,
  waitForLead,
} from "./helpers/leads";

/**
 * Калькулятор на сиде: общий зал 12 столов × 4 места; Вс–Чт 09–16: 580, 16–02: 640;
 * Пт–Сб 09–16: 680, 16–02: 760; ежедневно 02–09: 3500; VIP 1400; пенсионный 09–12: 200.
 * Даты — ближайшие понедельник/пятница, чтобы тест не «протухал».
 */
const MONDAY = nextWeekday(1);
const FRIDAY = nextWeekday(5);

test.describe("Калькулятор", () => {
  let consoleErrors: () => string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = trackConsoleErrors(page);
  });

  test.afterEach(() => {
    expect(consoleErrors()).toEqual([]);
  });

  test("URL воспроизводит расчёт: пн 12:00, 2 ч, 4 гостя → 1160 ₽", async ({ page }) => {
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2, g: 4 });
    await expectTotal(page, 1160);
    await expect(page.getByLabel("Столов", { exact: true })).toHaveText("1");
  });

  test("диалог отправки расчёта возвращает фокус на кнопку «Отправить расчёт в клуб»", async ({
    page,
  }) => {
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2, g: 4 });
    const sendButton = summary(page).getByRole("button", { name: "Отправить расчёт в клуб" });
    const dialog = page.getByRole("dialog", { name: "Отправить расчёт в клуб" });

    await sendButton.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(sendButton).toBeFocused();
  });

  test("переход тарифа посреди брони: пн 15:00, 2 ч → 580 + 640 = 1220 ₽", async ({ page }) => {
    await openCalculator(page, { d: MONDAY, t: "15:00", h: 2 });
    await expectTotal(page, 1220);
  });

  test("пт 23:00, 3 ч (через полночь) → 760 × 3 = 2280 ₽", async ({ page }) => {
    await openCalculator(page, { d: FRIDAY, t: "23:00", h: 3 });
    await expectTotal(page, 2280);
  });

  test("пт 01:00 (ночь на субботу), 2 ч → 760 + 3500 = 4260 ₽; ночные слоты подписаны", async ({
    page,
  }) => {
    await openCalculator(page, { d: FRIDAY, t: "01:00", h: 2 });
    await expectTotal(page, 4260);
    await expect(page.getByText("Это ночь после выбранной даты")).toBeVisible();

    await page.getByRole("combobox", { name: "Время начала" }).click();
    await expect(
      page.getByRole("option", { name: /^01:00 — ночь на \d{1,2} [а-я]+/ })
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "12:00", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("полчаса: пн 12:00, 0,5 ч → 290 ₽", async ({ page }) => {
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 0.5 });
    await expectTotal(page, 290);
  });

  test("столы: 8 гостей → 2 стола; ручное число пишется в URL, «Сбросить на авто» убирает", async ({
    page,
  }) => {
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2, g: 8 });
    const tables = page.getByLabel("Столов", { exact: true });
    await expect(tables).toHaveText("2");
    await expectTotal(page, 2 * 2 * 580);

    await stepperButton(page, "Столов", "Увеличить").click();
    await expect(tables).toHaveText("3");
    await expect(page).toHaveURL(/[?&]tables=3(&|$)/);
    await expectTotal(page, 3 * 2 * 580);

    await page.getByRole("button", { name: "Сбросить на авто" }).click();
    await expect(tables).toHaveText("2");
    await expect(page).not.toHaveURL(/[?&]tables=/);
  });

  test("VIP-комната: «Столов» скрыто, расчёт = цена комнаты", async ({ page }) => {
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2, g: 6 });
    await page.getByRole("combobox", { name: "Зал" }).click();
    await page.getByRole("option", { name: "VIP 1", exact: true }).click();

    await expect(page).toHaveURL(/[?&]hall=vip-1(&|$)/);
    await expect(page.getByLabel("Столов", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Цена за комнату целиком, стол в комнате один")).toBeVisible();
    await expectTotal(page, 2 * 1400);
  });

  test("пенсионер: пн 10:00–12:00 → 200 ₽/ч", async ({ page }) => {
    await openCalculator(page, { d: MONDAY, t: "10:00", h: 2 });
    await expectTotal(page, 2 * 580);

    const pensioner = page.getByRole("checkbox", { name: /Пенсионер/ });
    await expect(pensioner).toBeVisible();
    await pensioner.check();
    await expect(page).toHaveURL(/[?&]p=true(&|$)/);
    await expectTotal(page, 2 * 200);
    await expect(summary(page).getByText(/2 × 200\s₽/)).toBeVisible();
  });

  test("меню: поиск, вариант, счётчик; сет per_person с количеством = гостям", async ({ page }) => {
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2, g: 8 });
    const rental = 2 * 2 * 580;
    await expectTotal(page, rental);

    await page.getByRole("searchbox", { name: "Поиск по меню" }).fill("Жигули");
    await page.getByRole("button", { name: "Добавить: Жигули, Больший объём, 420 ₽" }).click();
    await expect(summary(page).getByText("Жигули")).toBeVisible();
    await expectTotal(page, rental + 420);

    await page
      .getByRole("group", { name: "Количество: Жигули, Больший объём" })
      .getByRole("button", { name: "Увеличить" })
      .click();
    await expect(page).toHaveURL(/[?&]i=[a-z0-9]+%3A2|[?&]i=[a-z0-9]+:2/);
    await expectTotal(page, rental + 2 * 420);

    // per_person: при добавлении количество = число гостей (8)
    const setCard = page.getByRole("listitem").filter({ hasText: "Фуршетный сет на 6 гостей" });
    await setCard.getByRole("button", { name: "Добавить" }).click();
    await expect(setCard.getByRole("group", { name: /^Персон:/ }).locator("output")).toHaveText(
      "8"
    );
    await expect(summary(page).getByText("Фуршетный сет на 6 гостей")).toBeVisible();
    await expect(summary(page).getByText(/^8 × 590\s₽$/)).toBeVisible();
    await expectTotal(page, rental + 2 * 420 + 8 * 590);
  });

  test("сетка цен: уровень пишется в URL как <item>-<tier>:1, ссылка и лид дают тот же итог", async ({
    page,
    context,
  }) => {
    await page.setExtraHTTPHeaders({ "x-real-ip": uniqueIp() });
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2 });

    await page.getByRole("searchbox", { name: "Поиск по меню" }).fill("Малина со сливками");
    // Своих вариантов у чая нет — показываются уровни сетки «Фирменные чаи»
    await expect(
      page.getByRole("button", { name: /Малина со сливками, 0,5 л, 450/ })
    ).toBeVisible();
    await page.getByRole("button", { name: /Малина со сливками, 0,8 л, 600/ }).click();

    await expect(page).toHaveURL(/[?&]i=[a-z0-9]+-[a-z0-9]+(%3A|:)1(&|$)/);
    const i = new URL(page.url()).searchParams.get("i");
    expect(i).toMatch(/^[a-z0-9]+-[a-z0-9]+:1$/);
    await expect(summary(page).getByText(/^1 × 600\s₽$/)).toBeVisible();
    const expected = 1160 + 600;
    await expectTotal(page, expected);

    // Та же ссылка в новой странице → та же смета
    const other = await context.newPage();
    const otherErrors = trackConsoleErrors(other);
    await other.goto(page.url());
    await expect(summary(other)).toBeVisible();
    await expect(summary(other).getByText("Малина со сливками")).toBeVisible();
    await expectTotal(other, expected);
    expect(otherErrors()).toEqual([]);
    await other.close();

    // Лид пересчитывается сервером с тем же итогом
    const phone = randomPhone();
    await submitQuote(page, phone);
    const lead = await waitForLead(phone);
    expect(lead.type).toBe("calculator");
    expect(lead.quote_total).toBe(expected);
  });

  test("«Скопировать ссылку» копирует URL, по нему открывается та же смета", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openCalculator(page, { d: FRIDAY, t: "18:00", h: 2.5, g: 6 });
    const expected = 2 * 2.5 * 760;
    await expectTotal(page, expected);

    await page.getByRole("button", { name: "Скопировать ссылку" }).click();
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: "Ссылка скопирована" })
    ).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(page.url());
    expect(new URL(copied).searchParams.get("h")).toBe("2.5");

    const other = await context.newPage();
    const otherErrors = trackConsoleErrors(other);
    await other.goto(copied);
    await expect(summary(other)).toBeVisible();
    await expectTotal(other, expected);
    expect(otherErrors()).toEqual([]);
    await other.close();
  });

  test("некорректный URL не ломает страницу: значения клампятся/игнорируются", async ({ page }) => {
    const response = await page.goto("/calculator?g=-5&h=99&d=abc&i=zzz:1&t=25:00&tables=0");
    expect(response?.status()).toBe(200);
    await expect(summary(page)).toBeVisible();
    // Значения по умолчанию: 4 гостя, 3 ч, 19:00, сегодня; неизвестная позиция не попадает в смету
    await expect(page.getByLabel("Гости", { exact: true })).toHaveText("4");
    await expect(page.getByLabel("Длительность", { exact: true })).toHaveText("3 ч");
    await expect(page.getByRole("combobox", { name: "Время начала" })).toHaveText("19:00");
    await expect(page.getByLabel("Столов", { exact: true })).toHaveText("1");
    await expect(summary(page).getByText("Меню", { exact: true })).toHaveCount(0);
    await expect.poll(async () => (await summary(page).textContent()) ?? "").toMatch(/Итого/);
  });

  test("отправка расчёта: лид с серверной суммой и снимком в админке", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-real-ip": uniqueIp() });
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2, g: 4 });
    await expectTotal(page, 1160);

    const phone = randomPhone();
    const name = `E2E Калькулятор ${uniq()}`;
    await submitQuote(page, phone, name);
    const lead = await waitForLead(phone);
    expect(lead.type).toBe("calculator");
    expect(lead.quote_total).toBe(1160);
    expect(lead.quote_snapshot?.quote?.total).toBe(1160);

    await page.goto(`/admin/leads/${lead.id}`);
    await expect(page.getByRole("heading", { name: `Заявка #${lead.number}` })).toBeVisible();
    await expect(page.getByText("Снимок расчёта калькулятора на момент заявки")).toBeVisible();
    const totals = page.locator("dl", { has: page.locator('dt:text-is("Итого")') }).last();
    await expect(totals.locator('dt:text-is("Итого") + dd')).toHaveText(/^1\s160\s₽$/);
    await expect(page.getByText("Рассчитано на сервере")).toBeVisible();
  });

  test("подмена расчёта в запросе: сумма в БД = серверный пересчёт, дробное количество отклоняется", async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ "x-real-ip": uniqueIp() });
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2, g: 4 });
    await expectTotal(page, 1160);

    // 1) Клиент «дописывает» в расчёт свои суммы — сервер их игнорирует
    const phone = randomPhone();
    await tamperQuote(page, (quote, payload) => {
      Object.assign(quote, { total: 1, rentalTotal: 1, lines: [], price: 1 });
      Object.assign(payload, { quoteTotal: 1, total: 1 });
    });
    await submitQuote(page, phone);
    const lead = await waitForLead(phone);
    expect(lead.quote_total).toBe(1160);

    // 2) Подменённое количество (дробное) — расчёт отклоняется целиком, лид не создаётся
    const phone2 = randomPhone();
    await openCalculator(page, { d: MONDAY, t: "12:00", h: 2, g: 4 });
    await tamperQuote(page, (quote) => {
      quote.tables = 1.5;
    });
    await page.getByRole("button", { name: "Отправить расчёт в клуб" }).click();
    const dialog = page.getByRole("dialog", { name: "Отправить расчёт в клуб" });
    await fillLeadForm(dialog, { name: "E2E Подмена", phone: phone2 });
    await dialog.getByRole("button", { name: "Отправить расчёт в клуб" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Не удалось прочитать расчёт");
    expect(await leadsByPhone(phone2)).toHaveLength(0);
  });
});

/** «Отправить расчёт в клуб» → диалог → имя/телефон/согласие → /spasibo. */
async function submitQuote(page: Page, phone: string, name = `E2E Расчёт ${uniq()}`) {
  await page.getByRole("button", { name: "Отправить расчёт в клуб" }).click();
  const dialog = page.getByRole("dialog", { name: "Отправить расчёт в клуб" });
  await expect(dialog).toBeVisible();
  await fillLeadForm(dialog, { name, phone });
  await dialog.getByRole("button", { name: "Отправить расчёт в клуб" }).click();
  await expectThankYou(page);
}

type Json = Record<string, unknown>;

/**
 * Перехватывает следующий вызов Server Action со страницы калькулятора и меняет его тело:
 * аргумент submitLead — JSON-массив `[payload]`, где `payload.quote` — строка JSON QuoteInput.
 */
async function tamperQuote(page: Page, mutate: (quote: Json, payload: Json) => void) {
  let done = false;
  const handler = async (route: Route) => {
    const request = route.request();
    if (done || request.method() !== "POST" || !request.headers()["next-action"]) {
      await route.fallback();
      return;
    }
    const args = JSON.parse(request.postData() ?? "[]") as Json[];
    const payload = args[0];
    if (!payload || typeof payload.quote !== "string") {
      await route.fallback();
      return;
    }
    const quote = JSON.parse(payload.quote) as Json;
    mutate(quote, payload);
    payload.quote = JSON.stringify(quote);
    done = true; // подменяем только один вызов
    await route.continue({ postData: JSON.stringify(args) });
  };
  await page.route("**/calculator*", handler);
}
