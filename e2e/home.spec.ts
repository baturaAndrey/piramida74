import { expect, test, type Page } from "@playwright/test";
import { ANON } from "./helpers/admin";
import { trackConsoleErrors } from "./helpers/console";
import { opDatePlus } from "./helpers/dates";
import { sql } from "./helpers/db";

// Публичная главная — без cookie админа (как у обычного посетителя)
test.use(ANON);

/** Секции главной в порядке старого сайта + новые блоки «Калькулятор» и «Из блога» */
const SECTION_ORDER = [
  "#discount",
  "#service",
  "#reasons",
  "#portfolio",
  "#price",
  "#calculator",
  "#clientsc",
  "#worksteps",
  "#getconsultation",
  "#blog",
  "#contacts",
] as const;

/** Пункты меню шапки, ведущие на якоря главной */
const MENU_ANCHORS = [
  ["Акции", "#discount"],
  ["Услуги клуба", "#service"],
  ["Турниры", "#reasons"],
  ["Бар и кухня", "#portfolio"],
  ["Прайс-лист", "#price"],
  ["Контакты", "#contacts"],
] as const;

/** Цены из сида (task-05), которые должны быть в аккордеоне «Прайс-лист» */
const SEED_PRICES = [580, 640, 680, 760, 3500, 1400, 4800, 200, 250];

const RU_EVENT_DATE = /^\d{1,2}(–\d{1,2})? [а-я]+$|^\d{1,2} [а-я]+ – \d{1,2} [а-я]+$/;

/** Главная со всеми стриминговыми секциями (последняя — «Контакты»). */
async function openHome(page: Page) {
  const response = await page.goto("/");
  await expect(page.locator("#contacts")).toBeAttached();
  return response;
}

/** Отказ от cookie, чтобы плашка не перекрывала элементы (кроме теста Метрики). */
async function dismissCookieBanner(page: Page) {
  const banner = page.getByRole("dialog", { name: "Cookie" });
  await banner.getByRole("button", { name: "Только необходимые" }).click();
  await expect(banner).toBeHidden();
}

test.describe("Главная", () => {
  test("отвечает 200, есть H1 и кнопка «Забронировать стол»", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await openHome(page);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: /Бильярдный клуб «Пирамида» в Челябинске/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Забронировать стол", exact: true }).first()
    ).toBeVisible();
    expect(errors()).toEqual([]);
  });

  test("секции идут в порядке старого сайта", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openHome(page);
    await expect(page.getByRole("heading", { name: "Калькулятор стоимости" })).toBeVisible();

    const positions: { selector: string; y: number }[] = [];
    for (const selector of SECTION_ORDER) {
      const section = page.locator(selector);
      // «Из блога» может отсутствовать без статей: пустая обёртка не участвует в проверке порядка
      if (selector === "#blog") {
        const hasArticles = (await section.locator("section").count()) > 0;
        if (!hasArticles) continue;
      }
      await expect(section, `секция ${selector}`).toBeAttached();
      const box = await section.boundingBox();
      expect(box, `секция ${selector} имеет размеры`).not.toBeNull();
      positions.push({ selector, y: box!.y });
    }

    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1]!;
      const cur = positions[i]!;
      expect(cur.y, `${cur.selector} ниже ${prev.selector}`).toBeGreaterThan(prev.y);
    }
    expect(errors()).toEqual([]);
  });

  test("пункты меню шапки прокручивают к своим секциям", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openHome(page);
    await dismissCookieBanner(page);
    const nav = page.getByRole("navigation", { name: "Основное меню" });

    for (const [label, hash] of MENU_ANCHORS) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${hash}$`));
      const section = page.locator(hash);
      await expect(section, `${label} → ${hash}`).toBeInViewport();
      // Плавная прокрутка: ждём, пока верх секции окажется у верха окна (или страница — в конце)
      await expect
        .poll(
          () =>
            section.evaluate((el) => {
              const top = el.getBoundingClientRect().top;
              const atBottom =
                window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
              return (top >= -2 && top <= 200) || atBottom;
            }),
          { message: `${label}: секция ${hash} у верха окна` }
        )
        .toBe(true);
    }
    expect(errors()).toEqual([]);
  });

  test("«Календарный план»: до 5 предстоящих событий, даты по-русски", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openHome(page);
    const rows = page.locator("#reasons article");
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(5);

    const today = opDatePlus(0);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const time = row.locator("time");
      const label = (await time.innerText()).trim();
      expect(label, `дата события #${i + 1}`).toMatch(RU_EVENT_DATE);

      const startDate = await time.getAttribute("datetime");
      const title = (await row.getByRole("heading").innerText()).trim();
      const matches = await sql()<{ end_date: string }[]>`
        select end_date::text as end_date from tournaments
        where title = ${title} and start_date = ${startDate} and is_published`;
      expect(matches.length, `турнир «${title}» ${startDate} есть в БД`).toBeGreaterThan(0);
      // Хотя бы одна запись с таким названием/датой не закончилась (повторы названий допустимы)
      expect(
        matches.some((m) => m.end_date >= today),
        `«${title}»: endDate >= ${today}`
      ).toBe(true);
    }
    expect(errors()).toEqual([]);
  });

  test("прайс: аккордеон раскрывается, цены совпадают с сидом", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openHome(page);
    await dismissCookieBanner(page);
    const price = page.locator("#price");
    const groups = price.locator("details");
    const total = await groups.count();
    expect(total).toBeGreaterThan(1);

    // Первая группа открыта по умолчанию, остальные раскрываются кликом
    await expect(groups.first()).toHaveAttribute("open", "");
    const second = groups.nth(1);
    await expect(second).not.toHaveAttribute("open", "");
    await second.locator("summary").click();
    await expect(second).toHaveAttribute("open", "");
    await expect(second.locator("summary + div")).toBeVisible();

    for (let i = 0; i < total; i++) {
      const group = groups.nth(i);
      if ((await group.getAttribute("open")) === null) await group.locator("summary").click();
    }
    // Разделитель тысяч в ru-RU — (узкий) неразрывный пробел: «3 500» → «3500»
    const text = (await price.innerText()).replace(/(\d)[   ](?=\d{3}\b)/g, "$1");
    for (const amount of SEED_PRICES) {
      expect(text, `цена ${amount}`).toMatch(new RegExp(`(^|\\s)${amount} руб`));
    }
    expect(errors()).toEqual([]);
  });

  test("CTA «Хотите забронировать стол?»: фото из галереи cta или статика, все отвечают 200", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await openHome(page);
    const cta = page.locator("#getconsultation");
    await expect(cta.getByText("Хотите забронировать стол?")).toBeVisible();
    await cta.scrollIntoViewIfNeeded();

    const [row] = await sql()<{ count: number }[]>`
      select count(*)::int as count from gallery_items gi
      join galleries g on g.id = gi.gallery_id where g.key = 'cta'`;
    const count = row?.count ?? 0;
    const expected = count > 0 ? /^\/media\// : /\/images\/home\//;

    const images = cta.locator("img");
    const total = await images.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      const img = images.nth(i);
      // Ждём загрузки (у мобильного фото может быть lazy — проверяем именно src)
      const src = await img.evaluate((el: HTMLImageElement) => el.currentSrc || el.src);
      const path = new URL(src).pathname + decodeURIComponent(new URL(src).search);
      expect(path, `фото CTA #${i + 1}`).toMatch(expected);
      const res = await page.request.get(src);
      expect(res.status(), `${src} → 200`).toBe(200);
    }
    expect(errors()).toEqual([]);
  });

  test("в документе canonical и JSON-LD LocalBusiness/SportsActivityLocation", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await openHome(page);
    // generateMetadata главной динамический: Next 16 стримит метаданные в <body> для браузеров
    // (в <head> — только для ботов из htmlLimitedBots), поэтому ищем по всему документу.
    // То же для JSON-LD — он внутри Suspense.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\//);

    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ""));
    const types = jsonLd.flatMap((raw) => {
      const data = JSON.parse(raw) as { "@type"?: string | string[] };
      return ([] as string[]).concat(data["@type"] ?? []);
    });
    expect(types.some((t) => t === "LocalBusiness" || t === "SportsActivityLocation")).toBe(true);

    // Поисковому боту метаданные отдаются блокирующе — canonical именно в <head>
    const botHtml = await (
      await page.request.get("/", {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; YandexBot/3.0)" },
      })
    ).text();
    const head = botHtml.slice(0, botHtml.indexOf("</head>"));
    expect(head).toMatch(/<link rel="canonical" href="https?:\/\/[^"]+"/);
    expect(errors()).toEqual([]);
  });

  test("Яндекс Метрика не загружается до согласия на cookie", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const metrikaRequests: string[] = [];
    page.on("request", (req) => {
      if (/mc\.yandex\.(ru|com)/.test(req.url())) metrikaRequests.push(req.url());
    });
    await openHome(page);
    await expect(page.getByRole("dialog", { name: "Cookie" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(metrikaRequests).toEqual([]);
    expect(errors()).toEqual([]);
  });

  test("Яндекс Метрика загружается после «Принять»", async ({ page }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_YM_ID,
      "NEXT_PUBLIC_YM_ID пуст в e2e-сборке — счётчик отключён, проверка загрузки невозможна"
    );
    const errors = trackConsoleErrors(page);
    await openHome(page);
    const tagRequest = page.waitForRequest(/mc\.yandex\.ru\/metrika\/tag\.js/);
    await page
      .getByRole("dialog", { name: "Cookie" })
      .getByRole("button", { name: "Принять" })
      .click();
    await tagRequest;
    expect(errors()).toEqual([]);
  });

  test("мобильный 375: нет горизонтального скролла, бургер открывается и закрывается", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await openHome(page);
    await dismissCookieBanner(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

    const burger = page.getByRole("button", { name: "Меню", exact: true });
    const menu = page.getByRole("dialog", { name: "Меню сайта" });

    await burger.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Прайс-лист" })).toBeVisible();
    await menu.getByRole("button", { name: "Закрыть меню" }).click();
    await expect(menu).toBeHidden();

    // Повторно: закрытие по Esc
    await burger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(errors()).toEqual([]);
  });
});
